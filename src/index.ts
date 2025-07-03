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
import { initI18n, t } from './utils/i18n.js';

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
    // Initialize i18n before anything else
    await initI18n();
    
    const version = await getPackageVersion();
    const program = new Command();

    program
      .name(t('common:app.name'))
      .description(t('common:app.description'))
      .version(version)
      .option('-v, --verbose', t('common:logger.verbose'))
      .option('-p, --profile <profile>', t('common:profile.specify'))
      .addHelpText('after', `
${t('common:app.usage')}:
  $ claudy save myproject        # ${t('common:examples.save')}
  $ claudy list                  # ${t('common:examples.list')}
  $ claudy load myproject        # ${t('common:examples.load')}
  $ claudy delete myproject      # ${t('common:examples.delete')}

${t('commands:common.moreInfo')}:
  https://github.com/douhashi/claudy`);

    program
      .command('init')
      .description(t('commands:init.description'))
      .addHelpText('after', t('commands:init.helpText'))
      .action(async () => {
        try {
          const options = program.opts();
          logger.setVerbose(options.verbose || false);

          await initializeClaudyDir();
          logger.success(t('commands:init.messages.success'));
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
      .description(t('commands:help.description'))
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
    logger.error(t('common:app.unexpectedErrorDetail', { message: error.message }));
    logger.debug(error.stack || '');
  } else {
    logger.error(t('common:app.unexpectedError'));
    logger.debug(String(error));
  }
  process.exit(1);
}

main().catch(handleError);