#!/usr/bin/env node

import { Command } from 'commander';
import { readFile } from 'fs/promises';
import path from 'path';
import { logger } from './utils/logger';
import { initializeClaudyDir } from './utils/config';
import { ClaudyError } from './types';

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
      .description('Claude AI設定ファイル管理ツール')
      .version(version)
      .option('-v, --verbose', '詳細なログを表示')
      .option('-p, --profile <profile>', '使用するプロファイルを指定');

    program
      .command('init')
      .description('claudy設定を初期化')
      .action(async () => {
        try {
          const options = program.opts();
          logger.setVerbose(options.verbose || false);

          await initializeClaudyDir();
          logger.success('claudyの初期化が完了しました');
        } catch (error) {
          handleError(error);
        }
      });

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
    logger.error(error.message);
    if (error.details) {
      logger.debug(JSON.stringify(error.details, null, 2));
    }
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