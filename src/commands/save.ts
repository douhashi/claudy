import { Command } from 'commander';
import path from 'path';
import { glob } from 'glob';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { ClaudyError } from '../types';
import { getClaudyDir } from '../utils/path';

interface SaveOptions {
  verbose?: boolean;
  force?: boolean;
}

/**
 * セット名のバリデーション
 * @param name - セット名
 * @throws {ClaudyError} 無効なセット名の場合
 */
function validateSetName(name: string): void {
  const invalidChars = /[/\\:*?"<>|]/;
  
  if (!name || name.trim().length === 0) {
    throw new ClaudyError('セット名が指定されていません', 'INVALID_SET_NAME');
  }
  
  if (invalidChars.test(name)) {
    throw new ClaudyError(
      'セット名に使用できない文字が含まれています（/, \\, :, *, ?, ", <, >, |）',
      'INVALID_SET_NAME'
    );
  }
  
  if (name.length > 255) {
    throw new ClaudyError(
      'セット名は255文字以内で指定してください',
      'INVALID_SET_NAME'
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
  } catch {
    return false;
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
    
    // ディレクトリを作成
    await fs.ensureDir(path.dirname(targetPath));
    
    // ファイルをコピー
    await fs.copy(sourcePath, targetPath, { overwrite: true });
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
    
    // 現在のディレクトリ
    const currentDir = process.cwd();
    logger.debug(`現在のディレクトリ: ${currentDir}`);
    
    // 対象ファイルを検索
    logger.info('Claude設定ファイルを検索中...');
    const files = await findTargetFiles(currentDir);
    
    if (files.length === 0) {
      throw new ClaudyError(
        'Claude設定ファイルが見つかりませんでした',
        'NO_FILES_FOUND'
      );
    }
    
    logger.debug(`見つかったファイル: ${files.join(', ')}`);
    logger.info(`${files.length}個のファイルが見つかりました`);
    
    // 保存先のパス
    const claudyDir = getClaudyDir();
    const setPath = path.join(claudyDir, name);
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
    await copyFiles(files, currentDir, setPath);
    
    // 成功メッセージ
    logger.success(`✓ セット "${name}" に${files.length}個のファイルを保存しました`);
    logger.success(`保存先: ${setPath}`);
    
    if (options.verbose) {
      logger.info('保存されたファイル:');
      files.forEach(file => {
        logger.info(`  - ${file}`);
      });
    }
  } catch (error) {
    if (error instanceof ClaudyError) {
      throw error;
    }
    throw new ClaudyError(
      'セットの保存中にエラーが発生しました',
      'SAVE_ERROR',
      error
    );
  }
}

/**
 * saveコマンドをCommanderに登録
 * @param program - Commanderのインスタンス
 */
export function registerSaveCommand(program: Command): void {
  program
    .command('save <name>')
    .description('現在のディレクトリのClaude設定ファイルを名前付きセットとして保存')
    .option('-f, --force', '既存のセットを確認なしで上書き')
    .action(async (name: string, options: SaveOptions) => {
      await executeSaveCommand(name, options);
    });
}