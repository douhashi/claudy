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
import { t } from '../utils/i18n.js';

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
    .description(t('commands:load.description'))
    .option('-f, --force', t('commands:load.options.force'))
    .addHelpText('after', t('commands:load.helpText'))
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

/**
 * loadコマンドの実行
 * @param name - セット名
 * @param options - コマンドオプション
 * @throws {ClaudyError} セット名が無効な場合、セットが見つからない場合、展開に失敗した場合
 */
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
          t('commands:load.messages.setNotFound', { name }),
          ErrorCodes.SET_NOT_FOUND,
          { setName: name, path: setDir }
        );
      }
      throw wrapError(error, ErrorCodes.FILE_READ_ERROR, undefined, { path: setDir });
    }

    logger.info(t('commands:load.messages.loadingFiles', { name }));

    // 展開対象ファイルの取得
    const filesWithScope = await getSetFiles(setDir);
    logger.debug(`Files to load: ${filesWithScope.length}`);

    // 既存ファイルとの衝突チェック
    const conflicts = await checkConflicts(filesWithScope);
    
    if (conflicts.length > 0 && !options.force) {
      logger.warn('The following files already exist:');
      conflicts.forEach(file => {
        logger.warn(`  - ${file}`);
      });

      const answer = await inquirer.prompt<ConflictAction>([
        {
          type: 'list',
          name: 'action',
          message: 'How would you like to handle existing files?',
          choices: [
            { name: 'Create backup and continue', value: 'backup' },
            { name: 'Overwrite existing files', value: 'overwrite' },
            { name: 'Cancel', value: 'cancel' }
          ],
          default: 'backup'
        }
      ]);

      if (answer.action === 'cancel') {
        logger.info('Load cancelled');
        return;
      }

      if (answer.action === 'backup') {
        await createBackups(filesWithScope, conflicts);
      }
    }

    // ファイルの展開
    await expandFiles(filesWithScope);

    // 結果の表示
    logger.success(`✓ ${t('commands:load.messages.success', { name })}`);
    
    // スコープごとにファイルをグループ化して表示
    const projectFiles = filesWithScope.filter(f => f.scope === 'project');
    const userFiles = filesWithScope.filter(f => f.scope === 'user');
    
    if (projectFiles.length > 0) {
      logger.info(`\nProject level (current directory):`);
      projectFiles.forEach(({ file }) => {
        logger.info(`  - ${file}`);
      });
    }
    
    if (userFiles.length > 0) {
      logger.info(`\nUser level (home directory):`);
      userFiles.forEach(({ file }) => {
        logger.info(`  - ~/${file}`);
      });
    }
    
    if (conflicts.length > 0) {
      logger.info('\nBackup files:');
      conflicts.forEach(file => {
        logger.info(`  - ${file}.bak`);
      });
    }
  } catch (error) {
    if (error instanceof ClaudyError) {
      throw error;
    }
    throw wrapError(error, ErrorCodes.LOAD_ERROR, t('commands:load.messages.loadError'), { setName: name });
  }
}

interface FileWithScope {
  file: string;
  scope: 'project' | 'user';
  baseDir: string;
}

/**
 * セットディレクトリからファイル一覧を取得
 * @param setDir - セットディレクトリのパス
 * @returns ファイルとスコープ情報の配列
 * @throws {ClaudyError} ファイル検索中にエラーが発生した場合
 */
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

/**
 * 既存ファイルとの衝突をチェック
 * @param filesWithScope - ファイルとスコープ情報の配列
 * @returns 衝突するファイルパスの配列
 * @throws {ClaudyError} ファイルステータス確認中にエラーが発生した場合
 */
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

/**
 * 衝突するファイルのバックアップを作成
 * @param filesWithScope - ファイルとスコープ情報の配列
 * @param conflictFiles - 衝突するファイルのパス配列
 * @throws {ClaudyError} バックアップ作成中にエラーが発生した場合
 */
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
      logger.debug(`Creating backup: ${conflictFile} -> ${conflictFile}.bak`);
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

/**
 * ファイルを展開
 * @param filesWithScope - ファイルとスコープ情報の配列
 * @throws {ClaudyError} ファイル展開中にエラーが発生した場合
 */
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
      logger.debug(`Expanded: ${scope === 'user' ? '~/' : ''}${file}`);
    } catch (error) {
      errors.push({ file: `${scope === 'user' ? '~/' : ''}${file}`, error });
      logger.debug(`Failed to expand: ${scope === 'user' ? '~/' : ''}${file} - ${error}`);
    }
  }

  // エラーがある場合はロールバック
  if (errors.length > 0) {
    logger.error('Errors occurred while expanding files');
    logger.info(t('commands:load.messages.rollbackStarted'));
    
    // 展開済みファイルを削除（ロールバック）
    const rollbackErrors: string[] = [];
    for (const { file, targetPath } of expandedFiles) {
      try {
        await handleFileOperation(
          () => remove(targetPath),
          ErrorCodes.FILE_DELETE_ERROR,
          targetPath
        );
        logger.debug(`Rollback: ${file}`);
      } catch {
        rollbackErrors.push(file);
        logger.warn(`Rollback failed: ${file}`);
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