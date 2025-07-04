import chalk from 'chalk';
import { t } from './i18n.js';

export class Logger {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  error(message: string): void {
    console.error(chalk.red('✗'), message);
  }

  warn(message: string): void {
    console.warn(chalk.yellow('⚠'), message);
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray(`[${t('common:logger.debug')}]`), message);
    }
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }
}

export const logger = new Logger();