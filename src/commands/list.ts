import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ClaudyError } from '../types';
import { getClaudyDir, getProjectConfigDir } from '../utils/path';
import { ErrorCodes, wrapError } from '../types/errors';
import { handleFileOperation, handleError } from '../utils/errorHandler';

interface ListOptions {
  verbose?: boolean;
}

interface SetInfo {
  name: string;
  createdAt: Date;
  fileCount: number;
}

/**
 * セット情報を取得
 * @param setPath - セットのパス
 * @returns セット情報
 */
async function getSetInfo(setPath: string): Promise<SetInfo | null> {
  try {
    // 直接fs.statを呼び出してエラーコードを保持
    const stats = await fs.stat(setPath);
    
    if (!stats.isDirectory()) {
      return null;
    }

    // ファイル数をカウント
    const files = await countFiles(setPath);
    
    return {
      name: path.basename(setPath),
      createdAt: stats.birthtime,
      fileCount: files,
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
 * テーブル形式で出力
 * @param sets - セット情報の配列
 */
function displayTable(sets: SetInfo[]): void {
  if (sets.length === 0) {
    logger.info('保存されたセットはありません');
    return;
  }

  // ヘッダー
  const header = chalk.bold.cyan('セット名') + '\t' + 
                 chalk.bold.cyan('作成日時') + '\t\t' + 
                 chalk.bold.cyan('ファイル数');
  const separator = chalk.gray('-'.repeat(50));

  console.log(header);
  console.log(separator);

  // データ行
  for (const set of sets) {
    const row = `${set.name}\t${formatDate(set.createdAt)}\t${set.fileCount}個`;
    console.log(row);
  }

  console.log(separator);
  console.log(chalk.gray(`合計: ${sets.length}個のセット`));
  
  if (sets.length > 0) {
    console.log('\n' + chalk.dim('ヒント: claudy load <セット名> で設定を展開できます'));
  }
}

/**
 * listコマンドの実行
 * @param options - コマンドオプション
 */
export async function executeListCommand(options: ListOptions): Promise<void> {
  try {
    logger.setVerbose(options.verbose || false);
    
    // 現在のプロジェクトの設定ディレクトリを取得
    const currentProjectPath = process.cwd();
    const projectConfigDir = getProjectConfigDir(currentProjectPath);
    logger.debug(`プロジェクト設定ディレクトリ: ${projectConfigDir}`);
    
    // claudyディレクトリの存在確認
    try {
      await handleFileOperation(
        () => fs.access(projectConfigDir),
        ErrorCodes.DIR_NOT_FOUND,
        projectConfigDir
      );
    } catch (error) {
      if (error instanceof ClaudyError && error.code === ErrorCodes.DIR_NOT_FOUND) {
        logger.info('保存されたセットはありません');
        logger.info('まず claudy save <name> でセットを保存してください');
        return;
      }
      throw error;
    }
    
    // セット一覧を取得
    logger.info('保存されたセットを検索中...');
    const items = await handleFileOperation(
      () => fs.readdir(projectConfigDir, { withFileTypes: true }),
      ErrorCodes.FILE_READ_ERROR,
      projectConfigDir
    );
    
    const sets: SetInfo[] = [];
    
    for (const item of items) {
      if (item.isDirectory() && item.name !== 'profiles' && !item.name.startsWith('.')) {
        const setPath = path.join(projectConfigDir, item.name);
        const setInfo = await getSetInfo(setPath);
        
        if (setInfo) {
          sets.push(setInfo);
        }
      }
    }
    
    // 名前順でソート
    sets.sort((a, b) => a.name.localeCompare(b.name));
    
    // 表示
    displayTable(sets);
    
  } catch (error) {
    if (error instanceof ClaudyError) {
      throw error;
    }
    throw wrapError(error, ErrorCodes.LIST_ERROR, 'セット一覧の取得中にエラーが発生しました');
  }
}

/**
 * listコマンドをCommanderに登録
 * @param program - Commanderのインスタンス
 */
export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('保存済みセットの一覧を表示')
    .addHelpText('after', `
使用例:
  $ claudy list                    # 全てのセットを一覧表示
  $ claudy list -v                 # 詳細情報付きで表示

表示内容:
  - セット名
  - 作成日時
  - ファイル数`)
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