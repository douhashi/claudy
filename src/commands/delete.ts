import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { ClaudyError } from '../types';
import { getClaudyDir } from '../utils/path';
import { ErrorCodes, ErrorMessages, wrapError } from '../types/errors';
import { handleFileOperation, handleError } from '../utils/errorHandler';

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
 * セットの削除
 * @param setPath - セットのパス
 */
async function deleteSet(setPath: string): Promise<void> {
  await handleFileOperation(
    () => fs.remove(setPath),
    ErrorCodes.DELETE_FAILED,
    setPath
  );
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
      throw new ClaudyError(
        ErrorMessages[ErrorCodes.INVALID_SET_NAME],
        ErrorCodes.INVALID_SET_NAME,
        { setName: name }
      );
    }
    
    logger.debug(`削除対象セット: ${name}`);
    
    const claudyDir = getClaudyDir();
    const setPath = path.join(claudyDir, name);
    logger.debug(`セットパス: ${setPath}`);
    
    // セットの存在確認
    if (!await existsSet(setPath)) {
      throw new ClaudyError(
        `セット "${name}" が見つかりません`,
        ErrorCodes.SET_NOT_FOUND,
        { setName: name, path: setPath }
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
    logger.info('\n現在のセット一覧を確認するには:');
    logger.info('  $ claudy list');
    
  } catch (error) {
    if (error instanceof ClaudyError) {
      throw error;
    }
    throw wrapError(error, ErrorCodes.DELETE_ERROR, 'セットの削除中にエラーが発生しました', { setName: name });
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
    .addHelpText('after', `
使用例:
  $ claudy delete old-project      # "old-project"セットを削除（確認あり）
  $ claudy delete temp -f          # "temp"セットを即座に削除

注意:
  削除したセットは復元できません`)
    .action(async (name: string, options: DeleteOptions) => {
      const globalOptions = program.opts();
      options.verbose = globalOptions.verbose || false;
      
      try {
        await executeDeleteCommand(name, options);
      } catch (error) {
        await handleError(error, ErrorCodes.DELETE_ERROR);
      }
    });
}