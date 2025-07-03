import { Command } from 'commander';
import fsExtra from 'fs-extra';
const fs = fsExtra;
import inquirer from 'inquirer';
import { logger } from '../utils/logger.js';
import { ClaudyError } from '../types/index.js';
import { getSetDir, validateSetName } from '../utils/path.js';
import { ErrorCodes, wrapError } from '../types/errors.js';
import { handleFileOperation, handleError } from '../utils/errorHandler.js';
import { t } from '../utils/i18n.js';

interface DeleteOptions {
  verbose?: boolean;
  force?: boolean;
}

/**
 * セットの存在確認
 * @param setPath - セットのパス
 * @returns 存在する場合true
 * @throws {ClaudyError} ファイルアクセス権限エラーなど、ENOENT以外のエラーが発生した場合
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
 * @throws {ClaudyError} セット削除中にエラーが発生した場合
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
 * @throws {ClaudyError} セット名が無効な場合、セットが見つからない場合、削除に失敗した場合
 */
export async function executeDeleteCommand(
  name: string,
  options: DeleteOptions
): Promise<void> {
  try {
    logger.setVerbose(options.verbose || false);
    
    // セット名のバリデーション
    validateSetName(name);
    
    logger.debug(t('commands:delete.messages.setToDelete', { name }));
    
    // 新しい構造のセットパスを使用
    const setPath = getSetDir(name);
    logger.debug(t('commands:delete.messages.setPath', { path: setPath }));
    
    // セットの存在確認
    if (!await existsSet(setPath)) {
      throw new ClaudyError(
        t('commands:delete.messages.setNotFound', { name }),
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
          message: t('commands:delete.messages.confirmDelete', { name }),
          default: false,
        },
      ]);
      
      if (!confirm) {
        logger.info(t('commands:delete.messages.cancelled'));
        return;
      }
    }
    
    // セットを削除
    logger.info(t('commands:delete.messages.deleting', { name }));
    await deleteSet(setPath);
    
    // 成功メッセージ
    logger.success(`✓ ${t('commands:delete.messages.success', { name })}`);
    logger.info('\n' + t('commands:delete.messages.toSeeCurrentSets'));
    logger.info(t('commands:delete.messages.listCommand'));
    
  } catch (error) {
    if (error instanceof ClaudyError) {
      throw error;
    }
    throw wrapError(error, ErrorCodes.DELETE_ERROR, 'An error occurred while deleting the set', { setName: name });
  }
}

/**
 * deleteコマンドをCommanderに登録
 * @param program - Commanderのインスタンス
 */
export function registerDeleteCommand(program: Command): void {
  program
    .command('delete <name>')
    .description(t('commands:delete.description'))
    .option('-f, --force', t('commands:delete.options.force'))
    .addHelpText('after', t('commands:delete.helpText'))
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