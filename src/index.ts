#!/usr/bin/env node

import { Command } from 'commander';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';
import { initializeClaudyDir } from './utils/config.js';
import { ClaudyError } from './types/index.js';
import { ErrorCodes, formatErrorMessage } from './types/errors.js';
import { handleError as handleClaudyError } from './utils/errorHandler.js';
import { registerSaveCommand } from './commands/save.js';
import { registerLoadCommand } from './commands/load.js';
import { registerListCommand } from './commands/list.js';
import { registerDeleteCommand } from './commands/delete.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getPackageVersion(): Promise<string> {
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent) as { version: string };
    return packageJson.version;
  } catch {
    return '0.0.1';
  }
}

async function main(): Promise<void> {
  try {
    const version = await getPackageVersion();
    const program = new Command();

    program
      .name('claudy')
      .description('Claude AI設定ファイル管理ツール\n\nClaude AIの設定ファイル（CLAUDE.md、.claude/commands/**/*.md）を\n名前付きセットとして保存・管理できます。')
      .version(version)
      .option('-v, --verbose', '詳細なログを表示')
      .option('-p, --profile <profile>', '使用するプロファイルを指定')
      .addHelpText('after', `
使用例:
  $ claudy save myproject        # 現在の設定を"myproject"として保存
  $ claudy list                  # 保存されたセットの一覧を表示
  $ claudy load myproject        # "myproject"の設定を現在のディレクトリに展開
  $ claudy delete myproject      # "myproject"セットを削除

詳細情報:
  https://github.com/douhashi/claudy`);

    program
      .command('init')
      .description('claudy設定を初期化')
      .addHelpText('after', '\n初回実行時に使用してください。~/.config/claudy ディレクトリを作成します。')
      .action(async () => {
        try {
          const options = program.opts();
          logger.setVerbose(options.verbose || false);

          await initializeClaudyDir();
          logger.success('claudyの初期化が完了しました');
        } catch (error) {
          await handleClaudyError(error, ErrorCodes.INTERNAL_ERROR);
        }
      });

    registerSaveCommand(program);
    registerLoadCommand(program);
    registerListCommand(program);
    registerDeleteCommand(program);

    program
      .command('help')
      .description('ヘルプを表示')
      .action(() => {
        program.help();
      });

    program.parse(process.argv);

    if (process.argv.length === 2) {
      program.help();
    }
  } catch (error) {
    handleError(error);
  }
}

function handleError(error: unknown): void {
  if (error instanceof ClaudyError) {
    logger.error(formatErrorMessage(error, true, true));
  } else if (error instanceof Error) {
    logger.error(`予期しないエラーが発生しました: ${error.message}`);
    logger.debug(error.stack || '');
  } else {
    logger.error('予期しないエラーが発生しました');
    logger.debug(String(error));
  }
  process.exit(1);
}

main().catch(handleError);