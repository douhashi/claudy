import { logger } from './logger.js';
import { ClaudyError } from '../types/index.js';
import { ErrorCode, formatErrorMessage, wrapError } from '../types/errors.js';
import { t } from './i18n.js';

// リトライ可能なエラーコード
const RETRYABLE_ERROR_CODES: ErrorCode[] = [
  'FS_DISK_FULL',
  'FS_FILE_LOCKED',
  'SYS_NETWORK_ERROR',
];

// リトライオプション
export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: boolean;
}

/**
 * エラーハンドラー
 * @param error - 発生したエラー
 * @param code - エラーコード
 * @param customMessage - カスタムエラーメッセージ
 * @throws Never - プロセスを終了します
 */
export async function handleError(error: unknown, code: ErrorCode, customMessage?: string): Promise<never> {
  const claudyError = error instanceof ClaudyError 
    ? error 
    : wrapError(error, code, customMessage);

  // エラーログを出力
  logger.error(formatErrorMessage(claudyError, true, true));

  // デバッグモードの場合はスタックトレースも出力
  if (process.env.DEBUG || process.env.VERBOSE) {
    console.error('\nStack trace:', claudyError.stack);
  }

  // プロセスを終了
  process.exit(1);
}

/**
 * リトライ機能付き関数実行
 * @param fn - 実行する関数
 * @param options - リトライオプション
 * @returns 関数の実行結果
 * @throws {Error} リトライ回数を超えても成功しなかった場合
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = true } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // ClaudyErrorの場合、リトライ可能かチェック
      if (error instanceof ClaudyError) {
        const isRetryable = RETRYABLE_ERROR_CODES.includes(error.code as ErrorCode);
        if (!isRetryable || attempt === maxAttempts) {
          throw error;
        }
      }

      // 最後の試行でなければ待機
      if (attempt < maxAttempts) {
        const waitTime = backoff ? delay * attempt : delay;
        logger.warn(t('errors:operation.retryAfterError', { waitTime, attempt, maxAttempts }));
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError || new Error('Unknown error in retry');
}

/**
 * ファイル操作のエラーハンドリング
 * @param operation - 実行するファイル操作
 * @param errorCode - エラー発生時のエラーコード
 * @param path - ファイルパス（オプション）
 * @returns 操作の結果
 * @throws {ClaudyError} 操作が失敗した場合
 */
export async function handleFileOperation<T>(
  operation: () => Promise<T>,
  errorCode: ErrorCode,
  path?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const details = path ? { path } : undefined;
    throw wrapError(error, errorCode, undefined, details);
  }
}

/**
 * 権限エラーの特別な処理
 * @param _error - 発生したエラー
 * @param path - ファイルパス（オプション）
 * @throws Never - プロセスを終了します
 */
export function handlePermissionError(_error: NodeJS.ErrnoException, path?: string): never {
  const message = t('errors:permission.fileAccessDenied', { path: path ? `: ${path}` : '' });
  
  logger.error(message);
  logger.info('\n' + t('errors:solutionHeader') + ':');
  const solutions = t('errors:solutions.permissionDenied', { returnObjects: true }) as string[];
  solutions.forEach((solution, index) => {
    logger.info(`  ${index + 1}. ${solution}`);
  });
  
  process.exit(1);
}

/**
 * ディスク容量エラーの特別な処理
 * @param _error - 発生したエラー
 * @param path - ファイルパス（オプション）
 * @throws Never - プロセスを終了します
 */
export function handleDiskSpaceError(_error: NodeJS.ErrnoException, path?: string): never {
  const message = t('errors:filesystem.diskFullWithPath', { path: path ? `: ${path}` : '' });
  
  logger.error(message);
  logger.info('\n' + t('errors:solutionHeader') + ':');
  const solutions = t('errors:solutions.diskFull', { returnObjects: true }) as string[];
  solutions.forEach((solution, index) => {
    logger.info(`  ${index + 1}. ${solution}`);
  });
  
  process.exit(1);
}

/**
 * ユーザーフレンドリーなエラーメッセージを取得
 * @param error - ClaudyErrorインスタンス
 * @returns ユーザー向けメッセージ
 */
export function getUserFriendlyMessage(error: ClaudyError): string {
  // エラーコードに基づいてメッセージをカスタマイズ
  const details = error.details as { setName?: string } | undefined;
  
  switch (error.code) {
    case 'VAL_INVALID_SET_NAME':
      return t('common:validation.invalidName');
    case 'RES_SET_NOT_FOUND':
      return t('errors:resource.setNotFoundDetail', { setName: details?.setName || 'unknown' });
    case 'PERM_DENIED':
      return t('errors:permission.denied');
    case 'FS_DISK_FULL':
      return t('errors:filesystem.diskFull');
    default:
      return error.message;
  }
}