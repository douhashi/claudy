import { ClaudyError } from './index';

// エラーコードのカテゴリー別定義
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

  // ファイル操作エラー (FILE_xxx)
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
  FILE_COPY_ERROR: 'FILE_COPY_ERROR',
  FILE_DELETE_ERROR: 'FILE_DELETE_ERROR',
  DIR_CREATE_ERROR: 'FILE_DIR_CREATE_ERROR',
  DIR_DELETE_ERROR: 'FILE_DIR_DELETE_ERROR',

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
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// エラーメッセージテンプレート
export const ErrorMessages: Record<ErrorCode, string> = {
  // 入力検証エラー
  [ErrorCodes.INVALID_SET_NAME]: 'セット名が無効です。英数字、ハイフン、アンダースコアのみ使用できます。',
  [ErrorCodes.INVALID_PROFILE_NAME]: 'プロファイル名が無効です。',
  [ErrorCodes.INVALID_PATH]: '指定されたパスが無効です。',
  [ErrorCodes.INVALID_ARGUMENT]: '引数が無効です。',
  [ErrorCodes.RESERVED_NAME]: '予約語は使用できません。',

  // リソース存在エラー
  [ErrorCodes.SET_NOT_FOUND]: '指定されたセットが見つかりません。',
  [ErrorCodes.PROFILE_NOT_FOUND]: '指定されたプロファイルが見つかりません。',
  [ErrorCodes.FILE_NOT_FOUND]: 'ファイルが見つかりません。',
  [ErrorCodes.DIR_NOT_FOUND]: 'ディレクトリが見つかりません。',
  [ErrorCodes.HOME_DIR_NOT_FOUND]: 'ホームディレクトリが見つかりません。',
  [ErrorCodes.NO_FILES_FOUND]: '保存対象のファイルが見つかりません。',
  [ErrorCodes.NO_CONFIG_FILES]: '設定ファイルが見つかりません。',

  // 権限エラー
  [ErrorCodes.PERMISSION_DENIED]: 'アクセス権限がありません。',
  [ErrorCodes.READ_PERMISSION_DENIED]: 'ファイルの読み取り権限がありません。',
  [ErrorCodes.WRITE_PERMISSION_DENIED]: 'ファイルの書き込み権限がありません。',
  [ErrorCodes.EXECUTE_PERMISSION_DENIED]: 'ファイルの実行権限がありません。',

  // ファイルシステムエラー
  [ErrorCodes.DISK_FULL]: 'ディスク容量が不足しています。',
  [ErrorCodes.FILE_LOCKED]: 'ファイルが他のプロセスによってロックされています。',
  [ErrorCodes.PATH_TOO_LONG]: 'パスが長すぎます。',
  [ErrorCodes.INVALID_FILE_NAME]: 'ファイル名が無効です。',
  [ErrorCodes.SYMLINK_LOOP]: 'シンボリックリンクがループしています。',

  // 操作エラー
  [ErrorCodes.SAVE_ERROR]: 'セットの保存に失敗しました。',
  [ErrorCodes.LOAD_ERROR]: 'セットの読み込みに失敗しました。',
  [ErrorCodes.LIST_ERROR]: 'セット一覧の取得に失敗しました。',
  [ErrorCodes.DELETE_ERROR]: 'セットの削除に失敗しました。',
  [ErrorCodes.DELETE_FAILED]: 'セットの削除中にエラーが発生しました。',
  [ErrorCodes.BACKUP_FAILED]: 'バックアップの作成に失敗しました。',
  [ErrorCodes.EXPAND_FAILED]: 'ファイルの展開に失敗しました。',
  [ErrorCodes.ROLLBACK_FAILED]: 'ロールバックに失敗しました。',

  // ファイル操作エラー
  [ErrorCodes.FILE_READ_ERROR]: 'ファイルの読み込みに失敗しました。',
  [ErrorCodes.FILE_WRITE_ERROR]: 'ファイルの書き込みに失敗しました。',
  [ErrorCodes.FILE_COPY_ERROR]: 'ファイルのコピーに失敗しました。',
  [ErrorCodes.FILE_DELETE_ERROR]: 'ファイルの削除に失敗しました。',
  [ErrorCodes.DIR_CREATE_ERROR]: 'ディレクトリの作成に失敗しました。',
  [ErrorCodes.DIR_DELETE_ERROR]: 'ディレクトリの削除に失敗しました。',

  // データ形式エラー
  [ErrorCodes.JSON_PARSE_ERROR]: 'JSONの解析に失敗しました。',
  [ErrorCodes.JSON_WRITE_ERROR]: 'JSONの書き込みに失敗しました。',
  [ErrorCodes.INVALID_FORMAT]: 'データ形式が無効です。',
  [ErrorCodes.CORRUPTED_DATA]: 'データが破損しています。',

  // 設定エラー
  [ErrorCodes.CONFIG_LOAD_ERROR]: '設定の読み込みに失敗しました。',
  [ErrorCodes.CONFIG_SAVE_ERROR]: '設定の保存に失敗しました。',
  [ErrorCodes.CONFIG_INVALID]: '設定が無効です。',
  [ErrorCodes.PROFILE_EXISTS]: '同名のプロファイルが既に存在します。',
  [ErrorCodes.DEFAULT_PROFILE_DELETE]: 'デフォルトプロファイルは削除できません。',

  // システムエラー
  [ErrorCodes.UNKNOWN_ERROR]: '不明なエラーが発生しました。',
  [ErrorCodes.INTERNAL_ERROR]: '内部エラーが発生しました。',
  [ErrorCodes.NETWORK_ERROR]: 'ネットワークエラーが発生しました。',
};

// エラー解決策の提案
export const ErrorSolutions: Partial<Record<ErrorCode, string[]>> = {
  [ErrorCodes.PERMISSION_DENIED]: [
    'ファイルまたはディレクトリの権限を確認してください',
    'sudo を使用して実行してみてください（システムディレクトリの場合）',
    'ファイルの所有者を確認してください',
  ],
  [ErrorCodes.DISK_FULL]: [
    'ディスクの空き容量を確認してください',
    '不要なファイルを削除してください',
    '別のディスクに保存先を変更してください',
  ],
  [ErrorCodes.FILE_LOCKED]: [
    'ファイルを使用している他のプログラムを終了してください',
    'しばらく待ってから再試行してください',
    'システムを再起動してください',
  ],
  [ErrorCodes.SET_NOT_FOUND]: [
    'claudy list コマンドで利用可能なセットを確認してください',
    'セット名のスペルを確認してください',
  ],
  [ErrorCodes.NO_FILES_FOUND]: [
    'CLAUDE.md ファイルが存在することを確認してください',
    '.claude/commands/ ディレクトリにファイルが存在することを確認してください',
  ],
};

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
      message += `\n\n詳細: ${JSON.stringify(error.details, null, 2)}`;
    }

    if (includeSolutions && error.code) {
      const solutions = ErrorSolutions[error.code as ErrorCode];
      if (solutions && solutions.length > 0) {
        message += '\n\n解決策:';
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
  const baseMessage = customMessage || ErrorMessages[code];
  let message = baseMessage;

  // システムエラーの場合、詳細を追加
  if (systemError.code) {
    const mappedCode = mapSystemErrorCode(systemError.code);
    if (mappedCode !== ErrorCodes.UNKNOWN_ERROR) {
      message = ErrorMessages[mappedCode];
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