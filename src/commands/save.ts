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
import { getProjectConfigDir } from '../utils/path.js';
import { performFileSelection, FileSelectionResult } from '../utils/file-selector.js';

interface SaveOptions {
  verbose?: boolean;
  force?: boolean;
  interactive?: boolean;
  all?: boolean;
}

/**
 * セット名のバリデーション
 * @param name - セット名
 * @throws {ClaudyError} 無効なセット名の場合
 */
function validateSetName(name: string): void {
  const invalidChars = /[/\\:*?"<>|]/;
  
  if (!name || name.trim().length === 0) {
    throw new ClaudyError(
      ErrorMessages[ErrorCodes.INVALID_SET_NAME],
      ErrorCodes.INVALID_SET_NAME,
      { setName: name }
    );
  }
  
  if (invalidChars.test(name)) {
    throw new ClaudyError(
      'セット名に使用できない文字が含まれています（/, \\, :, *, ?, ", <, >, |）',
      ErrorCodes.INVALID_SET_NAME,
      { setName: name, invalidChars: name.match(invalidChars) }
    );
  }
  
  if (name.length > 255) {
    throw new ClaudyError(
      'セット名は255文字以内で指定してください',
      ErrorCodes.INVALID_SET_NAME,
      { setName: name, length: name.length }
    );
  }
  
  if (name === 'profiles') {
    throw new ClaudyError(
      '"profiles" は予約されているため使用できません',
      ErrorCodes.RESERVED_NAME,
      { setName: name }
    );
  }
}

/**
 * 対象ファイルを検索
 * @param baseDir - 検索を開始するディレクトリ
 * @returns 見つかったファイルのパスの配列
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
 * 複数のソースからファイルをコピー
 * @param fileGroups - ファイルグループのリスト
 * @param targetDir - コピー先のディレクトリ
 */
async function copyFilesFromMultipleSources(
  fileGroups: FileSelectionResult[],
  targetDir: string
): Promise<void> {
  for (const group of fileGroups) {
    await copyFiles(group.files, group.baseDir, targetDir);
  }
}

/**
 * ファイルをコピー
 * @param files - コピーするファイルのリスト
 * @param sourceDir - コピー元のディレクトリ
 * @param targetDir - コピー先のディレクトリ
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
 */
export async function executeSaveCommand(
  name: string,
  options: SaveOptions
): Promise<void> {
  try {
    logger.setVerbose(options.verbose || false);
    
    // セット名のバリデーション
    validateSetName(name);
    logger.debug(`セット名: ${name}`);
    
    let fileGroups: FileSelectionResult[];
    let totalFiles = 0;
    
    if (options.all) {
      // --allフラグが指定された場合（従来のモード）
      const currentDir = process.cwd();
      logger.debug(`現在のディレクトリ: ${currentDir}`);
      
      logger.info('Claude設定ファイルを検索中...');
      const files = await findTargetFiles(currentDir);
      
      if (files.length === 0) {
        throw new ClaudyError(
          ErrorMessages[ErrorCodes.NO_FILES_FOUND],
          ErrorCodes.NO_FILES_FOUND,
          { patterns: ['CLAUDE.md', '.claude/commands/**/*.md'], searchDir: currentDir }
        );
      }
      
      logger.debug(`見つかったファイル: ${files.join(', ')}`);
      logger.info(`${files.length}個のファイルが見つかりました`);
      
      fileGroups = [{ files, baseDir: currentDir }];
      totalFiles = files.length;
    } else {
      // デフォルト動作（インタラクティブモード）
      fileGroups = await performFileSelection();
      totalFiles = fileGroups.reduce((count, group) => count + group.files.length, 0);
      
      if (totalFiles === 0) {
        throw new ClaudyError(
          'ファイルが選択されませんでした',
          ErrorCodes.NO_FILES_FOUND
        );
      }
    }
    
    // 保存先のパス（プロジェクト固有の設定ディレクトリを使用）
    const currentProjectPath = process.cwd();
    const projectConfigDir = getProjectConfigDir(currentProjectPath);
    const setPath = path.join(projectConfigDir, name);
    logger.debug(`保存先: ${setPath}`);
    
    // 既存セットの確認
    if (await existsSet(setPath) && !options.force) {
      const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `セット "${name}" は既に存在します。上書きしますか？`,
          default: false,
        },
      ]);
      
      if (!overwrite) {
        logger.info('保存をキャンセルしました');
        return;
      }
    }
    
    // ファイルをコピー
    logger.info('ファイルを保存中...');
    await copyFilesFromMultipleSources(fileGroups, setPath);
    
    // 成功メッセージ
    logger.success(`✓ ${totalFiles}個のファイルを保存しました`);
    logger.info(`セット名: "${name}"`);
    logger.info(`保存先: ${setPath}`);
    
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
      logger.info(`  - プロジェクトレベル: ${projectFileCount}個`);
      logger.info(`  - ユーザーレベル: ${userFileCount}個`);
    }
    
    logger.info('\n次のコマンドでこのセットを利用できます:');
    logger.info(`  $ claudy load ${name}`);
    
    if (options.verbose) {
      logger.info('\n保存されたファイル:');
      fileGroups.forEach(group => {
        const prefix = group.baseDir === process.cwd() ? './' : '~/';
        group.files.forEach(file => {
          logger.info(`  - ${prefix}${file}`);
        });
      });
    }
  } catch (error) {
    if (error instanceof ClaudyError) {
      throw error;
    }
    throw wrapError(error, ErrorCodes.SAVE_ERROR, 'セットの保存中にエラーが発生しました', { setName: name });
  }
}

/**
 * saveコマンドをCommanderに登録
 * @param program - Commanderのインスタンス
 */
export function registerSaveCommand(program: Command): void {
  program
    .command('save <name>')
    .description('Claude設定ファイルを名前付きセットとして保存（デフォルトはインタラクティブモード）')
    .option('-f, --force', '既存のセットを確認なしで上書き')
    .option('-a, --all', '全ファイルを自動的に保存（インタラクティブ選択をスキップ）')
    .option('-i, --interactive', '(廃止予定) デフォルトでインタラクティブモードが有効です')
    .addHelpText('after', `
使用例:
  $ claudy save myproject          # インタラクティブにファイルを選択して保存（デフォルト）
  $ claudy save frontend -a        # 全ファイルを自動的に保存
  $ claudy save backend -f         # 既存の"backend"セットを上書き
  $ claudy save project-v2 -a -f   # 全ファイルを自動保存し、既存セットを上書き

保存対象ファイル:
  プロジェクトレベル:
    - CLAUDE.md                    # プロジェクトの指示書
    - CLAUDE.local.md              # ローカル設定（存在する場合）
    - .claude/**/*.md              # カスタムコマンド
  
  ユーザーレベル（デフォルトで選択可能）:
    - ~/.claude/CLAUDE.md          # グローバル設定
    - ~/.claude/commands/**/*.md   # グローバルコマンド`)
    .action(async (name: string, options: SaveOptions) => {
      const globalOptions = program.opts();
      options.verbose = globalOptions.verbose || false;
      
      // -iオプションが指定された場合は警告を表示
      if (options.interactive) {
        logger.warn('注意: -i/--interactive オプションは廃止予定です。デフォルトでインタラクティブモードが有効になっています。');
      }
      
      try {
        await executeSaveCommand(name, options);
      } catch (error) {
        await handleError(error, ErrorCodes.SAVE_ERROR);
      }
    });
}