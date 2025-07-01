import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ClaudyError } from '../types';
import { getClaudyDir } from '../utils/path';

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
  } catch {
    return null;
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
    const items = await fs.readdir(currentPath, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item.name);
      
      if (item.isDirectory()) {
        await countRecursive(itemPath);
      } else if (item.isFile()) {
        count++;
      }
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
}

/**
 * listコマンドの実行
 * @param options - コマンドオプション
 */
export async function executeListCommand(options: ListOptions): Promise<void> {
  try {
    logger.setVerbose(options.verbose || false);
    
    const claudyDir = getClaudyDir();
    logger.debug(`claudyディレクトリ: ${claudyDir}`);
    
    // claudyディレクトリの存在確認
    if (!await fs.pathExists(claudyDir)) {
      logger.info('保存されたセットはありません');
      logger.info('まず claudy save <name> でセットを保存してください');
      return;
    }
    
    // セット一覧を取得
    logger.info('保存されたセットを検索中...');
    const items = await fs.readdir(claudyDir, { withFileTypes: true });
    
    const sets: SetInfo[] = [];
    
    for (const item of items) {
      if (item.isDirectory() && item.name !== 'profiles' && !item.name.startsWith('.')) {
        const setPath = path.join(claudyDir, item.name);
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
    throw new ClaudyError(
      'セット一覧の取得中にエラーが発生しました',
      'LIST_ERROR',
      error
    );
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
    .action(async (options: ListOptions) => {
      await executeListCommand(options);
    });
}