import { ClaudyError } from './index.js';
import { t } from '../utils/i18n.js';

// エラーコードのカテゴリー別定義
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ErrorCodes = {
  // 入力検証エラー (VAL_xxx)
  INVALID_SET_NAME: 'VAL_INVALID_SET_NAME',
  INVALID_PROFILE_NAME: 'VAL_INVALID_PROFILE_NAME',
  INVALID_PATH: 'VAL_INVALID_PATH',
  INVALID_ARGUMENT: 'VAL_INVALID_ARGUMENT',
  RESERVED_NAME: 'VAL_RESERVED_NAME',

  // リソース存在エラー (RES_xxx)
  SET_NOT_FOUND: 'RES_SET_NOT_FOUND',
  PROFILE_NOT_FOUND: 'RES_PROFILE_NOT_FOUND',
  FILE_NOT_FOUND: 'RES_FILE_NOT_FOUND',
  DIR_NOT_FOUND: 'RES_DIR_NOT_FOUND',
  HOME_DIR_NOT_FOUND: 'RES_HOME_DIR_NOT_FOUND',
  NO_FILES_FOUND: 'RES_NO_FILES_FOUND',
  NO_CONFIG_FILES: 'RES_NO_CONFIG_FILES',

  // 権限エラー (PERM_xxx)
  PERMISSION_DENIED: 'PERM_DENIED',
  READ_PERMISSION_DENIED: 'PERM_READ_DENIED',
  WRITE_PERMISSION_DENIED: 'PERM_WRITE_DENIED',
  EXECUTE_PERMISSION_DENIED: 'PERM_EXECUTE_DENIED',

  // ファイルシステムエラー (FS_xxx)
  DISK_FULL: 'FS_DISK_FULL',
  FILE_LOCKED: 'FS_FILE_LOCKED',
  PATH_TOO_LONG: 'FS_PATH_TOO_LONG',
  INVALID_FILE_NAME: 'FS_INVALID_FILE_NAME',
  SYMLINK_LOOP: 'FS_SYMLINK_LOOP',

  // 操作エラー (OP_xxx)
  SAVE_ERROR: 'OP_SAVE_ERROR',
  LOAD_ERROR: 'OP_LOAD_ERROR',
  LIST_ERROR: 'OP_LIST_ERROR',
  DELETE_ERROR: 'OP_DELETE_ERROR',
  DELETE_FAILED: 'OP_DELETE_FAILED',
  BACKUP_FAILED: 'OP_BACKUP_FAILED',
  EXPAND_FAILED: 'OP_EXPAND_FAILED',
  ROLLBACK_FAILED: 'OP_ROLLBACK_FAILED',
  MIGRATION_ERROR: 'OP_MIGRATION_ERROR',

  // ファイル操作エラー (FILE_xxx)
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
  FILE_COPY_ERROR: 'FILE_COPY_ERROR',
  FILE_DELETE_ERROR: 'FILE_DELETE_ERROR',
  DIR_CREATE_ERROR: 'FILE_DIR_CREATE_ERROR',
  DIR_DELETE_ERROR: 'FILE_DIR_DELETE_ERROR',
  DIR_COPY_ERROR: 'FILE_DIR_COPY_ERROR',

  // データ形式エラー (DATA_xxx)
  JSON_PARSE_ERROR: 'DATA_JSON_PARSE_ERROR',
  JSON_WRITE_ERROR: 'DATA_JSON_WRITE_ERROR',
  INVALID_FORMAT: 'DATA_INVALID_FORMAT',
  CORRUPTED_DATA: 'DATA_CORRUPTED',

  // 設定エラー (CONFIG_xxx)
  CONFIG_LOAD_ERROR: 'CONFIG_LOAD_ERROR',
  CONFIG_SAVE_ERROR: 'CONFIG_SAVE_ERROR',
  CONFIG_INVALID: 'CONFIG_INVALID',
  PROFILE_EXISTS: 'CONFIG_PROFILE_EXISTS',
  DEFAULT_PROFILE_DELETE: 'CONFIG_DEFAULT_PROFILE_DELETE',

  // システムエラー (SYS_xxx)
  UNKNOWN_ERROR: 'SYS_UNKNOWN_ERROR',
  INTERNAL_ERROR: 'SYS_INTERNAL_ERROR',
  NETWORK_ERROR: 'SYS_NETWORK_ERROR',
  
  // UI/インタラクションエラー (UI_xxx)
  FILE_SELECTION_ERROR: 'UI_FILE_SELECTION_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// エラーメッセージ取得関数
export function getErrorMessage(code: ErrorCode): string {
  const messageMap: Record<ErrorCode, string> = {
    // 入力検証エラー
    [ErrorCodes.INVALID_SET_NAME]: t('errors:validation.invalidSetName'),
    [ErrorCodes.INVALID_PROFILE_NAME]: t('errors:validation.invalidProfileName'),
    [ErrorCodes.INVALID_PATH]: t('errors:validation.invalidPath'),
    [ErrorCodes.INVALID_ARGUMENT]: t('errors:validation.invalidArgument'),
    [ErrorCodes.RESERVED_NAME]: t('errors:validation.reservedName'),

    // リソース存在エラー
    [ErrorCodes.SET_NOT_FOUND]: t('errors:resource.setNotFound'),
    [ErrorCodes.PROFILE_NOT_FOUND]: t('errors:resource.profileNotFound'),
    [ErrorCodes.FILE_NOT_FOUND]: t('errors:resource.fileNotFound'),
    [ErrorCodes.DIR_NOT_FOUND]: t('errors:resource.dirNotFound'),
    [ErrorCodes.HOME_DIR_NOT_FOUND]: t('errors:resource.homeDirNotFound'),
    [ErrorCodes.NO_FILES_FOUND]: t('errors:resource.noFilesFound'),
    [ErrorCodes.NO_CONFIG_FILES]: t('errors:resource.noConfigFiles'),

    // 権限エラー
    [ErrorCodes.PERMISSION_DENIED]: t('errors:permission.denied'),
    [ErrorCodes.READ_PERMISSION_DENIED]: t('errors:permission.readDenied'),
    [ErrorCodes.WRITE_PERMISSION_DENIED]: t('errors:permission.writeDenied'),
    [ErrorCodes.EXECUTE_PERMISSION_DENIED]: t('errors:permission.executeDenied'),

    // ファイルシステムエラー
    [ErrorCodes.DISK_FULL]: t('errors:filesystem.diskFull'),
    [ErrorCodes.FILE_LOCKED]: t('errors:filesystem.fileLocked'),
    [ErrorCodes.PATH_TOO_LONG]: t('errors:filesystem.pathTooLong'),
    [ErrorCodes.INVALID_FILE_NAME]: t('errors:filesystem.invalidFileName'),
    [ErrorCodes.SYMLINK_LOOP]: t('errors:filesystem.symlinkLoop'),

    // 操作エラー
    [ErrorCodes.SAVE_ERROR]: t('errors:operation.saveError'),
    [ErrorCodes.LOAD_ERROR]: t('errors:operation.loadError'),
    [ErrorCodes.LIST_ERROR]: t('errors:operation.listError'),
    [ErrorCodes.DELETE_ERROR]: t('errors:operation.deleteError'),
    [ErrorCodes.DELETE_FAILED]: t('errors:operation.deleteFailed'),
    [ErrorCodes.BACKUP_FAILED]: t('errors:operation.backupFailed'),
    [ErrorCodes.EXPAND_FAILED]: t('errors:operation.expandFailed'),
    [ErrorCodes.ROLLBACK_FAILED]: t('errors:operation.rollbackFailed'),
    [ErrorCodes.MIGRATION_ERROR]: t('errors:operation.migrationError'),

    // ファイル操作エラー
    [ErrorCodes.FILE_READ_ERROR]: t('errors:file.readError'),
    [ErrorCodes.FILE_WRITE_ERROR]: t('errors:file.writeError'),
    [ErrorCodes.FILE_COPY_ERROR]: t('errors:file.copyError'),
    [ErrorCodes.FILE_DELETE_ERROR]: t('errors:file.deleteError'),
    [ErrorCodes.DIR_CREATE_ERROR]: t('errors:file.dirCreateError'),
    [ErrorCodes.DIR_DELETE_ERROR]: t('errors:file.dirDeleteError'),
    [ErrorCodes.DIR_COPY_ERROR]: t('errors:file.dirCopyError'),

    // データ形式エラー
    [ErrorCodes.JSON_PARSE_ERROR]: t('errors:data.jsonParseError'),
    [ErrorCodes.JSON_WRITE_ERROR]: t('errors:data.jsonWriteError'),
    [ErrorCodes.INVALID_FORMAT]: t('errors:data.invalidFormat'),
    [ErrorCodes.CORRUPTED_DATA]: t('errors:data.corrupted'),

    // 設定エラー
    [ErrorCodes.CONFIG_LOAD_ERROR]: t('errors:config.loadError'),
    [ErrorCodes.CONFIG_SAVE_ERROR]: t('errors:config.saveError'),
    [ErrorCodes.CONFIG_INVALID]: t('errors:config.invalid'),
    [ErrorCodes.PROFILE_EXISTS]: t('errors:config.profileExists'),
    [ErrorCodes.DEFAULT_PROFILE_DELETE]: t('errors:config.defaultProfileDelete'),

    // システムエラー
    [ErrorCodes.UNKNOWN_ERROR]: t('errors:system.unknownError'),
    [ErrorCodes.INTERNAL_ERROR]: t('errors:system.internalError'),
    [ErrorCodes.NETWORK_ERROR]: t('errors:system.networkError'),
    
    // UI/インタラクションエラー
    [ErrorCodes.FILE_SELECTION_ERROR]: t('errors:ui.fileSelectionError'),
  };
  
  return messageMap[code] || t('errors:system.unknownError');
}

// 後方互換性のため、ErrorMessagesを維持（非推奨）
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ErrorMessages: Record<ErrorCode, string> = new Proxy({} as Record<ErrorCode, string>, {
  get: (_, prop) => getErrorMessage(prop as ErrorCode)
});

// エラー解決策取得関数
export function getErrorSolutions(code: ErrorCode): string[] {
  const solutionsMap: Record<string, string[]> = {
    [ErrorCodes.PERMISSION_DENIED]: t('errors:solutions.permissionDenied', { returnObjects: true }) as string[],
    [ErrorCodes.DISK_FULL]: t('errors:solutions.diskFull', { returnObjects: true }) as string[],
    [ErrorCodes.FILE_LOCKED]: t('errors:solutions.fileLocked', { returnObjects: true }) as string[],
    [ErrorCodes.SET_NOT_FOUND]: t('errors:solutions.setNotFound', { returnObjects: true }) as string[],
    [ErrorCodes.NO_FILES_FOUND]: t('errors:solutions.noFilesFound', { returnObjects: true }) as string[],
  };
  
  return solutionsMap[code] || [];
}

// 後方互換性のため、ErrorSolutionsを維持（非推奨）
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ErrorSolutions: Partial<Record<ErrorCode, string[]>> = new Proxy({} as Partial<Record<ErrorCode, string[]>>, {
  get: (_, prop) => getErrorSolutions(prop as ErrorCode)
});

// システムエラーコードをClaudyエラーコードにマッピング
export function mapSystemErrorCode(code: string | undefined): ErrorCode {
  switch (code) {
    case 'EACCES':
    case 'EPERM':
      return ErrorCodes.PERMISSION_DENIED;
    case 'ENOENT':
      return ErrorCodes.FILE_NOT_FOUND;
    case 'ENOSPC':
      return ErrorCodes.DISK_FULL;
    case 'EEXIST':
      return ErrorCodes.PROFILE_EXISTS;
    case 'EISDIR':
      return ErrorCodes.INVALID_PATH;
    case 'ENOTDIR':
      return ErrorCodes.INVALID_PATH;
    case 'EMFILE':
    case 'ENFILE':
      return ErrorCodes.FILE_LOCKED;
    case 'ENAMETOOLONG':
      return ErrorCodes.PATH_TOO_LONG;
    case 'ELOOP':
      return ErrorCodes.SYMLINK_LOOP;
    default:
      return ErrorCodes.UNKNOWN_ERROR;
  }
}

// エラーメッセージのフォーマット
export function formatErrorMessage(
  error: ClaudyError | Error,
  includeDetails = true,
  includeSolutions = true
): string {
  let message = '';

  if (error instanceof ClaudyError) {
    message = error.message;

    if (includeDetails && error.details) {
      message += `\n\n${t('errors:details')}: ${JSON.stringify(error.details, null, 2)}`;
    }

    if (includeSolutions && error.code) {
      const solutions = getErrorSolutions(error.code as ErrorCode);
      if (solutions && solutions.length > 0) {
        message += `\n\n${t('errors:solutionHeader')}:`;
        solutions.forEach((solution, index) => {
          message += `\n  ${index + 1}. ${solution}`;
        });
      }
    }
  } else {
    message = error.message;
  }

  return message;
}

// エラーのラップ
export function wrapError(
  error: unknown,
  code: ErrorCode,
  customMessage?: string,
  details?: unknown
): ClaudyError {
  if (error instanceof ClaudyError) {
    return error;
  }

  const systemError = error as NodeJS.ErrnoException;
  const baseMessage = customMessage || getErrorMessage(code);
  let message = baseMessage;

  // システムエラーの場合、詳細を追加
  if (systemError.code) {
    const mappedCode = mapSystemErrorCode(systemError.code);
    if (mappedCode !== ErrorCodes.UNKNOWN_ERROR) {
      message = getErrorMessage(mappedCode);
    }
    
    if (systemError.path) {
      message += ` (${systemError.path})`;
    }
  }

  return new ClaudyError(
    message,
    code,
    details || {
      originalError: error instanceof Error ? error.message : String(error),
      systemCode: systemError.code,
      path: systemError.path,
    }
  );
}