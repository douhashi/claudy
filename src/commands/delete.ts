import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { ClaudyError } from '../types';
import { getClaudyDir } from '../utils/path';

interface DeleteOptions {
  verbose?: boolean;
  force?: boolean;
}

/**
 * セットの存在確認
 * @param setPath - セットのパス
 * @returns 存在する場合true
 */
async function existsSet(setPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(setPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * セットの削除
 * @param setPath - セットのパス
 */
async function deleteSet(setPath: string): Promise<void> {
  try {
    await fs.remove(setPath);
  } catch (error) {
    throw new ClaudyError(
      'セットの削除中にエラーが発生しました',
      'DELETE_FAILED',
      error
    );
  }
}

/**
 * deleteコマンドの実行
 * @param name - セット名
 * @param options - コマンドオプション
 */
export async function executeDeleteCommand(
  name: string,
  options: DeleteOptions
): Promise<void> {
  try {
    logger.setVerbose(options.verbose || false);
    
    // セット名のバリデーション
    if (!name || name.trim().length === 0) {
      throw new ClaudyError('セット名が指定されていません', 'INVALID_SET_NAME');
    }
    
    logger.debug(`削除対象セット: ${name}`);
    
    const claudyDir = getClaudyDir();
    const setPath = path.join(claudyDir, name);
    logger.debug(`セットパス: ${setPath}`);
    
    // セットの存在確認
    if (!await existsSet(setPath)) {
      throw new ClaudyError(
        `セット "${name}" が見つかりません`,
        'SET_NOT_FOUND'
      );
    }
    
    // 削除確認
    if (!options.force) {
      const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
        {
          type: 'confirm',
          name: 'confirm',
          message: `セット "${name}" を削除してもよろしいですか？`,
          default: false,
        },
      ]);
      
      if (!confirm) {
        logger.info('削除をキャンセルしました');
        return;
      }
    }
    
    // セットを削除
    logger.info('セットを削除中...');
    await deleteSet(setPath);
    
    // 成功メッセージ
    logger.success(`✓ セット "${name}" を削除しました`);
    
  } catch (error) {
    if (error instanceof ClaudyError) {
      throw error;
    }
    throw new ClaudyError(
      'セットの削除中にエラーが発生しました',
      'DELETE_ERROR',
      error
    );
  }
}

/**
 * deleteコマンドをCommanderに登録
 * @param program - Commanderのインスタンス
 */
export function registerDeleteCommand(program: Command): void {
  program
    .command('delete <name>')
    .description('保存済みセットを削除')
    .option('-f, --force', '確認なしで削除')
    .action(async (name: string, options: DeleteOptions) => {
      await executeDeleteCommand(name, options);
    });
}