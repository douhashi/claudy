import { Command } from 'commander';
import path from 'path';
import fsExtra from 'fs-extra';
const { stat, copy, rename, remove, ensureDir } = fsExtra;
import inquirer from 'inquirer';
import { logger } from '../utils/logger.js';
import { getSetDir, validateSetName, getHomeDir } from '../utils/path.js';
import { ClaudyError } from '../types/index.js';
import { glob } from 'glob';
import { ErrorCodes, ErrorMessages, wrapError } from '../types/errors.js';
import { handleFileOperation, withRetry, handleError } from '../utils/errorHandler.js';

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
  $ claudy load node/cli           # 階層的なセット名から展開
  $ claudy load backend -f         # 既存ファイルを強制上書き
  $ cd ~/projects/new-app && claudy load template  # 別ディレクトリで展開

階層的なセット名:
  スラッシュ (/) を使用した階層的なセットを読み込めます:
  $ claudy load node/express       # Node.js Express用の設定
  $ claudy load python/django      # Python Django用の設定
  $ claudy load test/unit          # ユニットテスト用の設定

既存ファイルの処理:
  - バックアップを作成 (.bakファイル)
  - 上書き
  - キャンセル

注意:
  プロジェクトレベルのファイルは現在のディレクトリに、
  ユーザーレベルのファイルはホームディレクトリに展開されます。`)
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
    validateSetName(name);
    
    // 新しい構造から読み込み
    const setDir = getSetDir(name);

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
    const filesWithScope = await getSetFiles(setDir);
    logger.debug(`展開対象ファイル数: ${filesWithScope.length}`);

    // 既存ファイルとの衝突チェック
    const conflicts = await checkConflicts(filesWithScope);
    
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
        await createBackups(filesWithScope, conflicts);
      }
    }

    // ファイルの展開
    await expandFiles(filesWithScope);

    // 結果の表示
    logger.success(`✓ セット "${name}" の展開が完了しました`);
    
    // スコープごとにファイルをグループ化して表示
    const projectFiles = filesWithScope.filter(f => f.scope === 'project');
    const userFiles = filesWithScope.filter(f => f.scope === 'user');
    
    if (projectFiles.length > 0) {
      logger.info(`\nプロジェクトレベル (現在のディレクトリ):`);
      projectFiles.forEach(({ file }) => {
        logger.info(`  - ${file}`);
      });
    }
    
    if (userFiles.length > 0) {
      logger.info(`\nユーザーレベル (ホームディレクトリ):`);
      userFiles.forEach(({ file }) => {
        logger.info(`  - ~/${file}`);
      });
    }
    
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

interface FileWithScope {
  file: string;
  scope: 'project' | 'user';
  baseDir: string;
}

async function getSetFiles(setDir: string): Promise<FileWithScope[]> {
  const patterns = [
    'CLAUDE.md',
    '.claude/**/*.md'
  ];

  const filesWithScope: FileWithScope[] = [];
  
  // プロジェクトレベルのファイルを検索
  const projectDir = path.join(setDir, 'project');
  try {
    await stat(projectDir);
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: projectDir,
        nodir: true,
        dot: true
      });
      matches.forEach(file => {
        filesWithScope.push({ file, scope: 'project', baseDir: projectDir });
      });
    }
  } catch {
    // project ディレクトリが存在しない場合は無視
  }
  
  // ユーザーレベルのファイルを検索
  const userDir = path.join(setDir, 'user');
  try {
    await stat(userDir);
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: userDir,
        nodir: true,
        dot: true
      });
      matches.forEach(file => {
        filesWithScope.push({ file, scope: 'user', baseDir: userDir });
      });
    }
  } catch {
    // user ディレクトリが存在しない場合は無視
  }

  return filesWithScope;
}

async function checkConflicts(filesWithScope: FileWithScope[]): Promise<string[]> {
  const conflicts: string[] = [];
  
  for (const { file, scope } of filesWithScope) {
    const baseDir = scope === 'project' ? process.cwd() : getHomeDir();
    const targetPath = path.join(baseDir, file);
    try {
      await stat(targetPath);
      conflicts.push(scope === 'project' ? file : `~/${file}`);
    } catch {
      // ファイルが存在しない場合は衝突なし
    }
  }

  return conflicts;
}

async function createBackups(filesWithScope: FileWithScope[], conflictFiles: string[]): Promise<void> {
  for (const conflictFile of conflictFiles) {
    // conflictFileには"~/"プレフィックスが含まれる可能性があるので、スコープを判定
    const isUserFile = conflictFile.startsWith('~/');
    const cleanFile = isUserFile ? conflictFile.substring(2) : conflictFile;
    
    // 対応するFileWithScopeを検索
    const fileInfo = filesWithScope.find(f => 
      f.file === cleanFile && (isUserFile ? f.scope === 'user' : f.scope === 'project')
    );
    
    if (!fileInfo) continue;
    
    const baseDir = fileInfo.scope === 'project' ? process.cwd() : getHomeDir();
    const targetPath = path.join(baseDir, fileInfo.file);
    const backupPath = `${targetPath}.bak`;
    
    try {
      await handleFileOperation(
        () => rename(targetPath, backupPath),
        ErrorCodes.BACKUP_FAILED,
        targetPath
      );
      logger.debug(`バックアップ作成: ${conflictFile} -> ${conflictFile}.bak`);
    } catch (error) {
      if (error instanceof ClaudyError) {
        const details = { 
          ...(typeof error.details === 'object' && error.details !== null ? error.details : {}), 
          file: conflictFile, 
          backupPath 
        };
        throw new ClaudyError(error.message, error.code, details);
      }
      throw error;
    }
  }
}

async function expandFiles(filesWithScope: FileWithScope[]): Promise<void> {
  const expandedFiles: Array<{ file: string; targetPath: string }> = [];
  const errors: Array<{ file: string; error: unknown }> = [];

  for (const { file, scope, baseDir } of filesWithScope) {
    const sourcePath = path.join(baseDir, file);
    const targetBaseDir = scope === 'project' ? process.cwd() : getHomeDir();
    const targetPath = path.join(targetBaseDir, file);
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
      
      expandedFiles.push({ file, targetPath });
      logger.debug(`展開完了: ${scope === 'user' ? '~/' : ''}${file}`);
    } catch (error) {
      errors.push({ file: `${scope === 'user' ? '~/' : ''}${file}`, error });
      logger.debug(`展開失敗: ${scope === 'user' ? '~/' : ''}${file} - ${error}`);
    }
  }

  // エラーがある場合はロールバック
  if (errors.length > 0) {
    logger.error('ファイルの展開中にエラーが発生しました');
    logger.info('ロールバックを実行しています...');
    
    // 展開済みファイルを削除（ロールバック）
    const rollbackErrors: string[] = [];
    for (const { file, targetPath } of expandedFiles) {
      try {
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