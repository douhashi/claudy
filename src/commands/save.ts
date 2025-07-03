import { Command } from 'commander';
import path from 'path';
import { glob } from 'glob';
import fsExtra from 'fs-extra';
const fs = fsExtra;
import inquirer from 'inquirer';
import { logger } from '../utils/logger.js';
import { ClaudyError } from '../types/index.js';
import { ErrorCodes, ErrorMessages, wrapError } from '../types/errors.js';
import { handleFileOperation, withRetry, handleError } from '../utils/errorHandler.js';
import { getSetDir, validateSetName } from '../utils/path.js';
import { performFileSelection, FileSelectionResult } from '../utils/file-selector.js';
import { t } from '../utils/i18n.js';

interface SaveOptions {
  verbose?: boolean;
  force?: boolean;
  interactive?: boolean;
  all?: boolean;
}


/**
 * 対象ファイルを検索
 * @param baseDir - 検索を開始するディレクトリ
 * @returns 見つかったファイルのパスの配列
 * @throws {ClaudyError} ファイル検索中にエラーが発生した場合
 */
async function findTargetFiles(baseDir: string): Promise<string[]> {
  const patterns = [
    'CLAUDE.md',
    '.claude/commands/**/*.md'
  ];
  
  const files: string[] = [];
  
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: baseDir,
      absolute: false,
      nodir: true,
    });
    files.push(...matches);
  }
  
  return files;
}

/**
 * 既存のセットが存在するか確認
 * @param setPath - セットのパス
 * @returns 存在する場合true
 * @throws {ClaudyError} ファイルアクセス権限エラーなど、ENOENT以外のエラーが発生した場合
 */
async function existsSet(setPath: string): Promise<boolean> {
  try {
    await fs.access(setPath);
    return true;
  } catch (error) {
    const systemError = error as NodeJS.ErrnoException;
    if (systemError.code === 'ENOENT') {
      return false;
    }
    // その他のエラー（権限など）は再スロー
    throw wrapError(error, ErrorCodes.FILE_READ_ERROR, undefined, { path: setPath });
  }
}

/**
 * 複数のソースからファイルをコピー（新しい構造対応）
 * @param fileGroups - ファイルグループのリスト
 * @param targetDir - コピー先のディレクトリ
 * @throws {ClaudyError} ファイルコピー中にエラーが発生した場合
 */
async function copyFilesFromMultipleSources(
  fileGroups: FileSelectionResult[],
  targetDir: string
): Promise<void> {
  for (const group of fileGroups) {
    // プロジェクトレベルかユーザーレベルかを判定
    const isProjectLevel = group.baseDir === process.cwd();
    const scopeDir = isProjectLevel ? 'project' : 'user';
    const scopedTargetDir = path.join(targetDir, scopeDir);
    
    await copyFiles(group.files, group.baseDir, scopedTargetDir);
  }
}

/**
 * ファイルをコピー
 * @param files - コピーするファイルのリスト
 * @param sourceDir - コピー元のディレクトリ
 * @param targetDir - コピー先のディレクトリ
 * @throws {ClaudyError} ディレクトリ作成またはファイルコピー中にエラーが発生した場合
 */
async function copyFiles(
  files: string[],
  sourceDir: string,
  targetDir: string
): Promise<void> {
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    
    try {
      // ディレクトリを作成
      await handleFileOperation(
        () => fs.ensureDir(path.dirname(targetPath)),
        ErrorCodes.DIR_CREATE_ERROR,
        path.dirname(targetPath)
      );
      
      // ファイルをコピー（リトライ機能付き）
      await withRetry(
        () => handleFileOperation(
          () => fs.copy(sourcePath, targetPath, { overwrite: true }),
          ErrorCodes.FILE_COPY_ERROR,
          sourcePath
        ),
        { maxAttempts: 3, delay: 500 }
      );
    } catch (error) {
      // エラーにファイル情報を追加して再スロー
      if (error instanceof ClaudyError) {
        const details = { 
          ...(typeof error.details === 'object' && error.details !== null ? error.details : {}), 
          file, 
          sourcePath, 
          targetPath 
        };
        throw new ClaudyError(error.message, error.code, details);
      }
      throw error;
    }
  }
}

/**
 * saveコマンドの実行
 * @param name - セット名
 * @param options - コマンドオプション
 * @throws {ClaudyError} セット名が無効な場合、ファイルが見つからない場合、保存に失敗した場合
 */
export async function executeSaveCommand(
  name: string,
  options: SaveOptions
): Promise<void> {
  try {
    logger.setVerbose(options.verbose || false);
    
    // セット名のバリデーション
    validateSetName(name);
    logger.debug(t('commands:save.messages.setNameDebug', { name }));
    
    let fileGroups: FileSelectionResult[];
    let totalFiles = 0;
    
    if (options.all) {
      // --allフラグが指定された場合（従来のモード）
      const currentDir = process.cwd();
      logger.debug(t('commands:save.messages.currentDirDebug', { dir: currentDir }));
      
      logger.info(t('commands:save.messages.searchingFiles'));
      const files = await findTargetFiles(currentDir);
      
      if (files.length === 0) {
        throw new ClaudyError(
          ErrorMessages[ErrorCodes.NO_FILES_FOUND],
          ErrorCodes.NO_FILES_FOUND,
          { patterns: ['CLAUDE.md', '.claude/commands/**/*.md'], searchDir: currentDir }
        );
      }
      
      logger.debug(t('commands:save.messages.foundFilesDebug', { files: files.join(', ') }));
      logger.info(t('commands:save.messages.filesFound', { count: files.length }));
      
      fileGroups = [{ files, baseDir: currentDir }];
      totalFiles = files.length;
    } else {
      // デフォルト動作（インタラクティブモード）
      fileGroups = await performFileSelection();
      totalFiles = fileGroups.reduce((count, group) => count + group.files.length, 0);
      
      if (totalFiles === 0) {
        throw new ClaudyError(
          t('commands:save.messages.noFilesSelected'),
          ErrorCodes.NO_FILES_FOUND
        );
      }
    }
    
    // 保存先のパス（新しい構造：sets/<set-name>/）
    const setPath = getSetDir(name);
    logger.debug(t('commands:save.messages.savePathDebug', { path: setPath }));
    
    // 既存セットの確認
    const setExists = await existsSet(setPath);
    if (setExists && !options.force) {
      const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
        {
          type: 'confirm',
          name: 'overwrite',
          message: t('commands:save.messages.existsConfirm', { name }),
          default: false,
        },
      ]);
      
      if (!overwrite) {
        logger.info(t('commands:save.messages.cancelled'));
        return;
      }
    }
    
    // 既存セットのクリーンアップ
    if (setExists) {
      logger.debug(t('commands:save.messages.cleaningUpDir', { path: setPath }));
      try {
        await handleFileOperation(
          () => fs.remove(setPath),
          ErrorCodes.DIR_DELETE_ERROR,
          setPath
        );
        logger.debug(t('commands:save.messages.cleanupComplete', { path: setPath }));
      } catch (error) {
        // クリーンアップに失敗した場合は処理を中断
        throw error;
      }
    }
    
    // ファイルをコピー
    logger.info(t('commands:save.messages.savingFiles'));
    await copyFilesFromMultipleSources(fileGroups, setPath);
    
    // 成功メッセージ
    logger.success(`✓ ${t('commands:save.messages.savedFiles', { count: totalFiles })}`);
    logger.info(t('commands:save.messages.setName', { name }));
    logger.info(t('commands:save.messages.savePath', { path: setPath }));
    
    // ファイル数の内訳を表示
    let projectFileCount = 0;
    let userFileCount = 0;
    fileGroups.forEach(group => {
      if (group.baseDir === process.cwd()) {
        projectFileCount += group.files.length;
      } else {
        userFileCount += group.files.length;
      }
    });
    
    if (projectFileCount > 0 && userFileCount > 0) {
      logger.info(t('commands:save.messages.projectLevel', { count: projectFileCount }));
      logger.info(t('commands:save.messages.userLevel', { count: userFileCount }));
    }
    
    logger.info('\n' + t('commands:save.messages.nextCommand'));
    logger.info(t('commands:save.messages.loadCommand', { name }));
    
    if (options.verbose) {
      logger.info('\n' + t('commands:save.messages.savedFilesList'));
      fileGroups.forEach(group => {
        const prefix = group.baseDir === process.cwd() ? './' : '~/';
        group.files.forEach(file => {
          logger.info(t('commands:save.messages.fileListItem', { prefix, file }));
        });
      });
    }
  } catch (error) {
    if (error instanceof ClaudyError) {
      throw error;
    }
    throw wrapError(error, ErrorCodes.SAVE_ERROR, t('errors:operation.saveError'), { setName: name });
  }
}

/**
 * saveコマンドをCommanderに登録
 * @param program - Commanderのインスタンス
 */
export function registerSaveCommand(program: Command): void {
  program
    .command('save <name>')
    .description(t('commands:save.description'))
    .option('-f, --force', t('commands:save.options.force'))
    .option('-a, --all', t('commands:save.options.all'))
    .option('-i, --interactive', t('commands:save.options.interactive'))
    .addHelpText('after', t('commands:save.helpText'))
    .action(async (name: string, options: SaveOptions) => {
      const globalOptions = program.opts();
      options.verbose = globalOptions.verbose || false;
      
      // -iオプションが指定された場合は警告を表示
      if (options.interactive) {
        logger.warn(t('commands:save.messages.deprecatedInteractive'));
      }
      
      try {
        await executeSaveCommand(name, options);
      } catch (error) {
        await handleError(error, ErrorCodes.SAVE_ERROR);
      }
    });
}