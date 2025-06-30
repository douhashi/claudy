import { Command } from 'commander';
import path from 'path';
import { stat, copy, rename } from 'fs-extra';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { getClaudyDir } from '../utils/path';
import { ClaudyError } from '../types';
import { glob } from 'glob';

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
    .action(async (name: string, options: LoadOptions) => {
      try {
        const globalOptions = program.opts();
        logger.setVerbose(globalOptions.verbose || false);

        await loadSet(name, options);
      } catch (error) {
        if (error instanceof ClaudyError) {
          logger.error(error.message);
          if (error.details) {
            logger.debug(JSON.stringify(error.details, null, 2));
          }
        } else if (error instanceof Error) {
          logger.error(`エラーが発生しました: ${error.message}`);
          logger.debug(error.stack || '');
        } else {
          logger.error('予期しないエラーが発生しました');
        }
        process.exit(1);
      }
    });
}

async function loadSet(name: string, options: LoadOptions): Promise<void> {
  const claudyDir = getClaudyDir();
  const setDir = path.join(claudyDir, name);

  // セットの存在確認
  try {
    await stat(setDir);
  } catch {
    throw new ClaudyError(
      `設定セット "${name}" が見つかりません`,
      'SET_NOT_FOUND',
      { setName: name }
    );
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
  logger.success(`✓ 設定セット "${name}" の展開が完了しました`);
  logger.info(`展開されたファイル:`);
  files.forEach(file => {
    logger.info(`  - ${file}`);
  });
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
      await rename(targetPath, backupPath);
      logger.debug(`バックアップ作成: ${file} -> ${file}.bak`);
    } catch (error) {
      throw new ClaudyError(
        `バックアップの作成に失敗しました: ${file}`,
        'BACKUP_FAILED',
        { file, error }
      );
    }
  }
}

async function expandFiles(files: string[], setDir: string): Promise<void> {
  const expandedFiles: string[] = [];
  const errors: Array<{ file: string; error: unknown }> = [];

  for (const file of files) {
    const sourcePath = path.join(setDir, file);
    const targetPath = path.join(process.cwd(), file);
    
    try {
      await copy(sourcePath, targetPath, {
        overwrite: true,
        preserveTimestamps: true
      });
      
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
    
    // 展開済みファイルを削除（ロールバック）
    for (const file of expandedFiles) {
      try {
        const targetPath = path.join(process.cwd(), file);
        await stat(targetPath);
        // TODO: ロールバック処理の実装
      } catch {
        // ファイルが存在しない場合は無視
      }
    }

    throw new ClaudyError(
      'ファイルの展開に失敗しました',
      'EXPAND_FAILED',
      { errors }
    );
  }
}