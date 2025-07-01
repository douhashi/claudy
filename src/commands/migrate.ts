import { Command } from 'commander';
import { logger } from '../utils/logger';
import { ClaudyError } from '../types';
import { ErrorCodes, wrapError } from '../types/errors';
import { handleError } from '../utils/errorHandler';
import { checkAndMigrateLegacyConfig } from '../utils/config';

interface MigrateOptions {
  verbose?: boolean;
  force?: boolean;
}

/**
 * migrateコマンドの実行
 * @param options - コマンドオプション
 */
export async function executeMigrateCommand(options: MigrateOptions): Promise<void> {
  try {
    logger.setVerbose(options.verbose || false);
    
    logger.info('旧形式の設定ディレクトリを確認中...');
    
    const migrated = await checkAndMigrateLegacyConfig();
    
    if (!migrated) {
      logger.info('移行が必要な旧形式の設定は見つかりませんでした');
      logger.info('既にXDG Base Directory仕様に準拠しています');
    }
  } catch (error) {
    if (error instanceof ClaudyError) {
      throw error;
    }
    throw wrapError(error, ErrorCodes.MIGRATION_ERROR, '設定の移行中にエラーが発生しました');
  }
}

/**
 * migrateコマンドをCommanderに登録
 * @param program - Commanderのインスタンス
 */
export function registerMigrateCommand(program: Command): void {
  program
    .command('migrate')
    .description('旧形式の設定ディレクトリをXDG Base Directory仕様に移行')
    .option('-f, --force', '確認なしで移行を実行')
    .addHelpText('after', `
使用例:
  $ claudy migrate                 # 旧形式の設定を新形式に移行
  $ claudy migrate -v              # 詳細なログを表示しながら移行

移行内容:
  旧: ~/.claudy/
  新: ~/.config/claudy/ (XDG_CONFIG_HOME環境変数で変更可能)

注意:
  - 移行後、旧ディレクトリは手動で削除してください
  - 移行は自動的にバックアップを作成しません`)
    .action(async (options: MigrateOptions) => {
      const globalOptions = program.opts();
      options.verbose = globalOptions.verbose || false;
      
      try {
        await executeMigrateCommand(options);
      } catch (error) {
        await handleError(error, ErrorCodes.MIGRATION_ERROR);
      }
    });
}