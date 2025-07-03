import { Command } from 'commander';
import fsExtra from 'fs-extra';
const fs = fsExtra;
import path from 'path';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { ClaudyError } from '../types/index.js';
import { getSetsDir } from '../utils/path.js';
import { ErrorCodes, wrapError } from '../types/errors.js';
import { handleFileOperation, handleError } from '../utils/errorHandler.js';
import { t } from '../utils/i18n.js';

interface ListOptions {
  verbose?: boolean;
}

interface SetInfo {
  name: string;
  path: string;
  createdAt: Date;
  fileCount: number;
  hasProjectFiles: boolean;
  hasUserFiles: boolean;
}

/**
 * セット情報を取得（新しい構造対応）
 * @param setPath - セットのパス
 * @param basePath - ベースパス（相対パス計算用）
 * @returns セット情報
 * @throws {ClaudyError} ファイル読み込みエラーが発生した場合（EACCES、ENOENT以外）
 */
async function getSetInfo(setPath: string, basePath: string): Promise<SetInfo | null> {
  try {
    // 直接fs.statを呼び出してエラーコードを保持
    const stats = await fs.stat(setPath);
    
    if (!stats.isDirectory()) {
      return null;
    }

    // project/userディレクトリの存在確認
    let hasProjectFiles = false;
    let hasUserFiles = false;
    let totalFileCount = 0;

    const projectPath = path.join(setPath, 'project');
    try {
      await fs.stat(projectPath);
      const projectFiles = await countFiles(projectPath);
      hasProjectFiles = projectFiles > 0;
      totalFileCount += projectFiles;
    } catch {
      // projectディレクトリが存在しない場合は無視
    }

    const userPath = path.join(setPath, 'user');
    try {
      await fs.stat(userPath);
      const userFiles = await countFiles(userPath);
      hasUserFiles = userFiles > 0;
      totalFileCount += userFiles;
    } catch {
      // userディレクトリが存在しない場合は無視
    }

    // ベースパスからの相対パスを計算
    const relativePath = path.relative(basePath, setPath);
    
    return {
      name: relativePath,
      path: setPath,
      createdAt: stats.birthtime,
      fileCount: totalFileCount,
      hasProjectFiles,
      hasUserFiles
    };
  } catch (error) {
    // アクセスエラーの場合はnullを返す
    const systemError = error as NodeJS.ErrnoException;
    if (systemError.code === 'EACCES' || systemError.code === 'ENOENT') {
      logger.debug(`セットへのアクセス不可: ${setPath} (${systemError.code})`);
      return null;
    }
    // その他のエラーは再スロー
    throw wrapError(error, ErrorCodes.FILE_READ_ERROR, undefined, { path: setPath });
  }
}

/**
 * ディレクトリ内のファイル数をカウント
 * @param dirPath - ディレクトリパス
 * @returns ファイル数
 * @throws {ClaudyError} ファイル読み込みエラーが発生した場合（EACCES以外）
 */
async function countFiles(dirPath: string): Promise<number> {
  let count = 0;
  
  async function countRecursive(currentPath: string): Promise<void> {
    try {
      const items = await handleFileOperation(
        () => fs.readdir(currentPath, { withFileTypes: true }),
        ErrorCodes.FILE_READ_ERROR,
        currentPath
      );
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item.name);
        
        if (item.isDirectory()) {
          await countRecursive(itemPath);
        } else if (item.isFile()) {
          count++;
        }
      }
    } catch (error) {
      // アクセスエラーの場合はスキップ
      const systemError = error as NodeJS.ErrnoException;
      if (systemError.code === 'EACCES') {
        logger.debug(`アクセス拒否: ${currentPath}`);
        return;
      }
      throw error;
    }
  }
  
  await countRecursive(dirPath);
  return count;
}

/**
 * 日付を読みやすい形式でフォーマット
 * @param date - 日付
 * @returns フォーマットされた日付文字列
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

/**
 * テーブル形式で出力（階層構造対応）
 * @param sets - セット情報の配列
 */
function displayTable(sets: SetInfo[]): void {
  if (sets.length === 0) {
    logger.info(t('commands:list.messages.noSets'));
    return;
  }

  // ヘッダー
  const header = chalk.bold.cyan(t('commands:list.messages.setName')) + '\t\t' + 
                 chalk.bold.cyan(t('commands:list.messages.scope')) + '\t' + 
                 chalk.bold.cyan(t('commands:list.messages.fileCount')) + '\t' + 
                 chalk.bold.cyan(t('commands:list.messages.createdAt'));
  const separator = chalk.gray('-'.repeat(70));

  console.log(header);
  console.log(separator);

  // カテゴリごとにグループ化
  const categorized = new Map<string, SetInfo[]>();
  
  for (const set of sets) {
    const parts = set.name.split('/');
    const category = parts.length > 1 ? parts[0] : '';
    
    if (!categorized.has(category)) {
      categorized.set(category, []);
    }
    categorized.get(category)!.push(set);
  }

  // カテゴリごとに表示
  for (const [category, categoryStets] of categorized) {
    if (category) {
      console.log(chalk.yellow(`\n[${category}]`));
    }
    
    for (const set of categoryStets) {
      // スコープ情報の作成
      const scopes: string[] = [];
      if (set.hasProjectFiles) scopes.push('P');
      if (set.hasUserFiles) scopes.push('U');
      const scopeStr = scopes.join('+');
      
      // セット名の整形（カテゴリがある場合はインデント）
      const displayName = category ? `  ${set.name.substring(category.length + 1)}` : set.name;
      
      const row = `${displayName}\t\t${scopeStr}\t\t${set.fileCount}\t\t${formatDate(set.createdAt)}`;
      console.log(row);
    }
  }

  console.log(separator);
  console.log(chalk.gray(t('commands:list.messages.total', { count: sets.length })));
  console.log(chalk.dim('\n' + t('commands:list.messages.scopeHint')));
  
  if (sets.length > 0) {
    console.log(chalk.dim(t('commands:list.messages.loadHint')));
  }
}

/**
 * ディレクトリを再帰的に探索してセットを取得
 * @param dirPath - 探索するディレクトリ
 * @param basePath - ベースパス
 * @param depth - 現在の深さ
 * @returns セット情報の配列
 * @throws {ClaudyError} ディレクトリ読み込みエラーが発生した場合（EACCES以外）
 */
async function findSetsRecursive(dirPath: string, basePath: string, depth: number = 0): Promise<SetInfo[]> {
  const sets: SetInfo[] = [];
  
  // 最大深度を制限（パフォーマンスのため）
  if (depth > 5) {
    return sets;
  }

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      if (!item.isDirectory() || item.name.startsWith('.')) {
        continue;
      }
      
      const itemPath = path.join(dirPath, item.name);
      
      // project/userディレクトリがあるかチェック
      const hasProjectDir = await fs.pathExists(path.join(itemPath, 'project'));
      const hasUserDir = await fs.pathExists(path.join(itemPath, 'user'));
      
      if (hasProjectDir || hasUserDir) {
        // これはセットディレクトリ
        const setInfo = await getSetInfo(itemPath, basePath);
        if (setInfo && setInfo.fileCount > 0) {
          sets.push(setInfo);
        }
      } else {
        // サブディレクトリを再帰的に探索
        const subSets = await findSetsRecursive(itemPath, basePath, depth + 1);
        sets.push(...subSets);
      }
    }
  } catch (error) {
    const systemError = error as NodeJS.ErrnoException;
    if (systemError.code === 'EACCES') {
      logger.debug(`アクセス拒否: ${dirPath}`);
    } else {
      throw error;
    }
  }
  
  return sets;
}

/**
 * listコマンドの実行
 * @param options - コマンドオプション
 * @throws {ClaudyError} ディレクトリが見つからない場合、一覧取得に失敗した場合
 */
export async function executeListCommand(options: ListOptions): Promise<void> {
  try {
    logger.setVerbose(options.verbose || false);
    
    // 新しい構造のセットディレクトリを取得
    const setsDir = getSetsDir();
    logger.debug(`Sets directory: ${setsDir}`);
    
    // setsディレクトリの存在確認
    try {
      await handleFileOperation(
        () => fs.access(setsDir),
        ErrorCodes.DIR_NOT_FOUND,
        setsDir
      );
    } catch (error) {
      if (error instanceof ClaudyError && error.code === ErrorCodes.DIR_NOT_FOUND) {
        logger.info(t('commands:list.messages.noSets'));
        logger.info(t('commands:list.messages.firstSaveHint'));
        return;
      }
      throw error;
    }
    
    // セット一覧を取得（再帰的に探索）
    logger.info(t('commands:list.messages.searching'));
    const sets = await findSetsRecursive(setsDir, setsDir);
    
    // 名前順でソート
    sets.sort((a, b) => a.name.localeCompare(b.name));
    
    // 表示
    displayTable(sets);
    
  } catch (error) {
    if (error instanceof ClaudyError) {
      throw error;
    }
    throw wrapError(error, ErrorCodes.LIST_ERROR, 'An error occurred while retrieving the set list');
  }
}

/**
 * listコマンドをCommanderに登録
 * @param program - Commanderのインスタンス
 */
export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description(t('commands:list.description'))
    .option('-v, --verbose', t('commands:list.options.verbose'))
    .addHelpText('after', t('commands:list.helpText'))
    .action(async (options: ListOptions) => {
      const globalOptions = program.opts();
      options.verbose = globalOptions.verbose || false;
      
      try {
        await executeListCommand(options);
      } catch (error) {
        await handleError(error, ErrorCodes.LIST_ERROR);
      }
    });
}