import { Command } from 'commander';
import path from 'path';
import { stat, copy, rename, remove, ensureDir } from 'fs-extra';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { getProjectConfigDir } from '../utils/path';
import { ClaudyError } from '../types';
import { glob } from 'glob';
import { ErrorCodes, ErrorMessages, wrapError } from '../types/errors';
import { handleFileOperation, withRetry, handleError } from '../utils/errorHandler';

interface LoadOptions {
  verbose?: boolean;
  force?: boolean;
}

interface ConflictAction {
  action: 'backup' | 'overwrite' | 'cancel';
}

export function registerLoadCommand(program: Command): void {
  program
    .command('load <name>')
    .description('保存済みの設定セットを現在のディレクトリに展開')
    .option('-f, --force', '確認なしで上書き')
    .addHelpText('after', `
使用例:
  $ claudy load frontend           # "frontend"セットを展開
  $ claudy load backend -f         # 既存ファイルを強制上書き
  $ cd ~/projects/new-app && claudy load template  # 別ディレクトリで展開

既存ファイルの処理:
  - バックアップを作成 (.bakファイル)
  - 上書き
  - キャンセル`)
    .action(async (name: string, options: LoadOptions) => {
      const globalOptions = program.opts();
      options.verbose = globalOptions.verbose || false;
      
      try {
        await executeLoadCommand(name, options);
      } catch (error) {
        await handleError(error, ErrorCodes.LOAD_ERROR);
      }
    });
}

export async function executeLoadCommand(name: string, options: LoadOptions): Promise<void> {
  try {
    logger.setVerbose(options.verbose || false);
    
    // セット名のバリデーション
    if (!name || name.trim().length === 0) {
      throw new ClaudyError(
        ErrorMessages[ErrorCodes.INVALID_SET_NAME],
        ErrorCodes.INVALID_SET_NAME,
        { setName: name }
      );
    }
    
    // 現在のプロジェクトの設定ディレクトリから読み込み
    const currentProjectPath = process.cwd();
    const projectConfigDir = getProjectConfigDir(currentProjectPath);
    const setDir = path.join(projectConfigDir, name);

    // セットの存在確認
    try {
      await stat(setDir);
    } catch (error) {
      const systemError = error as NodeJS.ErrnoException;
      if (systemError.code === 'ENOENT') {
        throw new ClaudyError(
          `セット "${name}" が見つかりません`,
          ErrorCodes.SET_NOT_FOUND,
          { setName: name, path: setDir }
        );
      }
      throw wrapError(error, ErrorCodes.FILE_READ_ERROR, undefined, { path: setDir });
    }

    logger.info(`設定セット "${name}" を展開します`);

    // 展開対象ファイルの取得
    const files = await getSetFiles(setDir);
    logger.debug(`展開対象ファイル数: ${files.length}`);

    // 既存ファイルとの衝突チェック
    const conflicts = await checkConflicts(files);
    
    if (conflicts.length > 0 && !options.force) {
      logger.warn('以下のファイルが既に存在します:');
      conflicts.forEach(file => {
        logger.warn(`  - ${file}`);
      });

      const answer = await inquirer.prompt<ConflictAction>([
        {
          type: 'list',
          name: 'action',
          message: '既存ファイルをどのように処理しますか？',
          choices: [
            { name: 'バックアップを作成して展開', value: 'backup' },
            { name: '上書きして展開', value: 'overwrite' },
            { name: 'キャンセル', value: 'cancel' }
          ],
          default: 'backup'
        }
      ]);

      if (answer.action === 'cancel') {
        logger.info('展開をキャンセルしました');
        return;
      }

      if (answer.action === 'backup') {
        await createBackups(conflicts);
      }
    }

    // ファイルの展開
    await expandFiles(files, setDir);

    // 結果の表示
    logger.success(`✓ セット "${name}" の展開が完了しました`);
    logger.info(`展開されたファイル:`);
    files.forEach(file => {
      logger.info(`  - ${file}`);
    });
    
    if (conflicts.length > 0) {
      logger.info('\nバックアップファイル:');
      conflicts.forEach(file => {
        logger.info(`  - ${file}.bak`);
      });
    }
  } catch (error) {
    if (error instanceof ClaudyError) {
      throw error;
    }
    throw wrapError(error, ErrorCodes.LOAD_ERROR, '設定セットの読み込み中にエラーが発生しました', { setName: name });
  }
}

async function getSetFiles(setDir: string): Promise<string[]> {
  const patterns = [
    'CLAUDE.md',
    '.claude/**/*.md'
  ];

  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: setDir,
      nodir: true,
      dot: true
    });
    files.push(...matches);
  }

  return files;
}

async function checkConflicts(files: string[]): Promise<string[]> {
  const conflicts: string[] = [];
  
  for (const file of files) {
    const targetPath = path.join(process.cwd(), file);
    try {
      await stat(targetPath);
      conflicts.push(file);
    } catch {
      // ファイルが存在しない場合は衝突なし
    }
  }

  return conflicts;
}

async function createBackups(files: string[]): Promise<void> {
  for (const file of files) {
    const targetPath = path.join(process.cwd(), file);
    const backupPath = `${targetPath}.bak`;
    
    try {
      await handleFileOperation(
        () => rename(targetPath, backupPath),
        ErrorCodes.BACKUP_FAILED,
        targetPath
      );
      logger.debug(`バックアップ作成: ${file} -> ${file}.bak`);
    } catch (error) {
      if (error instanceof ClaudyError) {
        const details = { 
          ...(typeof error.details === 'object' && error.details !== null ? error.details : {}), 
          file, 
          backupPath 
        };
        throw new ClaudyError(error.message, error.code, details);
      }
      throw error;
    }
  }
}

async function expandFiles(files: string[], setDir: string): Promise<void> {
  const expandedFiles: string[] = [];
  const errors: Array<{ file: string; error: unknown }> = [];

  for (const file of files) {
    const sourcePath = path.join(setDir, file);
    const targetPath = path.join(process.cwd(), file);
    const targetDir = path.dirname(targetPath);
    
    try {
      // ディレクトリを作成
      await handleFileOperation(
        () => ensureDir(targetDir),
        ErrorCodes.DIR_CREATE_ERROR,
        targetDir
      );
      
      // ファイルをコピー（リトライ機能付き）
      await withRetry(
        () => handleFileOperation(
          () => copy(sourcePath, targetPath, {
            overwrite: true,
            preserveTimestamps: true
          }),
          ErrorCodes.FILE_COPY_ERROR,
          sourcePath
        ),
        { maxAttempts: 3, delay: 500 }
      );
      
      expandedFiles.push(file);
      logger.debug(`展開完了: ${file}`);
    } catch (error) {
      errors.push({ file, error });
      logger.debug(`展開失敗: ${file} - ${error}`);
    }
  }

  // エラーがある場合はロールバック
  if (errors.length > 0) {
    logger.error('ファイルの展開中にエラーが発生しました');
    logger.info('ロールバックを実行しています...');
    
    // 展開済みファイルを削除（ロールバック）
    const rollbackErrors: string[] = [];
    for (const file of expandedFiles) {
      try {
        const targetPath = path.join(process.cwd(), file);
        await handleFileOperation(
          () => remove(targetPath),
          ErrorCodes.FILE_DELETE_ERROR,
          targetPath
        );
        logger.debug(`ロールバック: ${file}`);
      } catch {
        rollbackErrors.push(file);
        logger.warn(`ロールバック失敗: ${file}`);
      }
    }

    const errorDetails = {
      errors,
      rollbackErrors: rollbackErrors.length > 0 ? rollbackErrors : undefined
    };

    throw new ClaudyError(
      ErrorMessages[ErrorCodes.EXPAND_FAILED],
      ErrorCodes.EXPAND_FAILED,
      errorDetails
    );
  }
}