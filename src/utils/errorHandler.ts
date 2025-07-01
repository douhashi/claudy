import { logger } from './logger.js';
import { ClaudyError } from '../types/index.js';
import { ErrorCode, formatErrorMessage, wrapError } from '../types/errors.js';

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

// エラーハンドラー
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

// リトライ機能付き関数実行
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
        logger.warn(`エラーが発生しました。${waitTime}ms後に再試行します... (${attempt}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError || new Error('Unknown error in retry');
}

// ファイル操作のエラーハンドリング
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

// 権限エラーの特別な処理
export function handlePermissionError(_error: NodeJS.ErrnoException, path?: string): never {
  const message = `ファイルまたはディレクトリへのアクセスが拒否されました${path ? `: ${path}` : ''}`;
  
  logger.error(message);
  logger.info('\n解決策:');
  logger.info('  1. ファイルまたはディレクトリの権限を確認してください');
  logger.info('  2. 必要に応じて chmod コマンドで権限を変更してください');
  logger.info('  3. システムディレクトリの場合は sudo を使用してください');
  
  process.exit(1);
}

// ディスク容量エラーの特別な処理
export function handleDiskSpaceError(_error: NodeJS.ErrnoException, path?: string): never {
  const message = `ディスク容量が不足しています${path ? `: ${path}` : ''}`;
  
  logger.error(message);
  logger.info('\n解決策:');
  logger.info('  1. df -h コマンドでディスク容量を確認してください');
  logger.info('  2. 不要なファイルを削除してください');
  logger.info('  3. 別のディスクに保存先を変更してください');
  
  process.exit(1);
}

// ユーザーフレンドリーなエラーメッセージ
export function getUserFriendlyMessage(error: ClaudyError): string {
  // エラーコードに基づいてメッセージをカスタマイズ
  const details = error.details as { setName?: string } | undefined;
  
  switch (error.code) {
    case 'VAL_INVALID_SET_NAME':
      return 'セット名には英数字、ハイフン、アンダースコアのみ使用できます。';
    case 'RES_SET_NOT_FOUND':
      return `セット "${details?.setName || '不明'}" が見つかりません。"claudy list" で利用可能なセットを確認してください。`;
    case 'PERM_DENIED':
      return 'ファイルへのアクセス権限がありません。権限を確認するか、管理者として実行してください。';
    case 'FS_DISK_FULL':
      return 'ディスク容量が不足しています。空き容量を確保してから再試行してください。';
    default:
      return error.message;
  }
}