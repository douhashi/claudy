import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { ClaudyError } from '../types/index.js';
import { t } from './i18n.js';

/**
 * ホームディレクトリを取得
 * @returns ホームディレクトリのパス
 * @throws {ClaudyError} ホームディレクトリが見つからない場合
 */
export function getHomeDir(): string {
  const homeDir = os.homedir();
  if (!homeDir) {
    throw new ClaudyError(t('common:path.homeNotFound'), 'HOME_DIR_NOT_FOUND');
  }
  return homeDir;
}

/**
 * XDG Base Directory仕様に準拠した設定ディレクトリを取得
 * @returns 設定ディレクトリのパス
 * @throws {ClaudyError} ホームディレクトリが見つからない場合
 */
export function getConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, 'claudy');
  }
  return path.join(getHomeDir(), '.config', 'claudy');
}

/**
 * 旧形式のディレクトリパスを取得（互換性のため）
 * @returns 旧形式のディレクトリパス
 * @throws {ClaudyError} ホームディレクトリが見つからない場合
 */
export function getLegacyClaudyDir(): string {
  return path.join(getHomeDir(), '.claudy');
}

/**
 * 新形式のclaudyディレクトリを取得（XDG準拠）
 * @returns claudyディレクトリのパス
 * @throws {ClaudyError} ホームディレクトリが見つからない場合
 */
export function getClaudyDir(): string {
  return getConfigDir();
}

/**
 * プロファイルディレクトリを取得
 * @returns プロファイルディレクトリのパス
 * @throws {ClaudyError} ホームディレクトリが見つからない場合
 */
export function getProfilesDir(): string {
  return path.join(getClaudyDir(), 'profiles');
}

/**
 * プロファイルディレクトリを取得
 * @param profileName - プロファイル名
 * @returns プロファイルディレクトリのパス
 * @throws {ClaudyError} ホームディレクトリが見つからない場合
 */
export function getProfileDir(profileName: string): string {
  return path.join(getProfilesDir(), profileName);
}

/**
 * ユーザー設定ディレクトリを取得
 * @returns ユーザー設定ディレクトリのパス
 * @throws {ClaudyError} ホームディレクトリが見つからない場合
 */
export function getUserConfigDir(): string {
  return path.join(getProfilesDir(), 'default', 'user');
}

/**
 * プロジェクト設定ディレクトリを取得
 * @returns プロジェクト設定ディレクトリのパス
 * @throws {ClaudyError} ホームディレクトリが見つからない場合
 */
export function getProjectsDir(): string {
  return path.join(getClaudyDir(), 'projects');
}

/**
 * プロジェクトのハッシュ値を生成
 * @param projectPath プロジェクトのパス
 * @returns プロジェクトハッシュ（12文字）
 */
export function getProjectHash(projectPath: string): string {
  const normalizedPath = path.resolve(projectPath);
  return crypto
    .createHash('sha256')
    .update(normalizedPath)
    .digest('hex')
    .substring(0, 12);
}

/**
 * プロジェクト固有の設定ディレクトリを取得
 * @param projectPath プロジェクトのパス
 * @returns プロジェクト設定ディレクトリのパス
 * @throws {ClaudyError} ホームディレクトリが見つからない場合
 */
export function getProjectConfigDir(projectPath: string): string {
  const projectHash = getProjectHash(projectPath);
  return path.join(getProjectsDir(), projectHash);
}

/**
 * 設定ファイルのパスを取得
 * @returns 設定ファイルのパス
 * @throws {ClaudyError} ホームディレクトリが見つからない場合
 */
export function getConfigPath(): string {
  return path.join(getClaudyDir(), 'config.json');
}

/**
 * パスを解決（~をホームディレクトリに展開）
 * @param inputPath - 入力パス
 * @returns 解決されたパス
 * @throws {ClaudyError} ホームディレクトリが見つからない場合
 */
export function resolvePath(inputPath: string): string {
  if (inputPath.startsWith('~')) {
    return path.join(getHomeDir(), inputPath.slice(1));
  }
  return path.resolve(inputPath);
}

export function normalizePathSeparators(inputPath: string): string {
  return inputPath.replace(/\\/g, '/');
}

/**
 * 設定セットのベースディレクトリを取得
 * @returns 設定セットディレクトリのパス
 * @throws {ClaudyError} ホームディレクトリが見つからない場合
 */
export function getSetsDir(): string {
  return path.join(getClaudyDir(), 'sets');
}

/**
 * 設定セットのディレクトリを取得
 * @param setName セット名（階層的な名前をサポート）
 * @returns セットディレクトリのパス
 * @throws {ClaudyError} セット名が無効な場合、ホームディレクトリが見つからない場合
 */
export function getSetDir(setName: string): string {
  // セット名のバリデーション
  validateSetName(setName);
  return path.join(getSetsDir(), setName);
}

/**
 * セット名のバリデーション
 * @param setName セット名
 * @throws {ClaudyError} 無効なセット名の場合
 */
export function validateSetName(setName: string): void {
  if (!setName || setName.trim() === '') {
    throw new ClaudyError(t('common:path.setNameRequired'), 'INVALID_SET_NAME');
  }

  // パストラバーサル攻撃の防止
  const normalizedName = path.normalize(setName);
  if (normalizedName.includes('..') || path.isAbsolute(normalizedName)) {
    throw new ClaudyError(t('common:path.invalidSetName'), 'INVALID_SET_NAME', { setName });
  }

  // OSごとの予約語と特殊文字のチェック
  const invalidChars = /[:*?"<>|]/;
  const invalidNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1', 'PROFILES'];
  
  // スラッシュで分割して各パートをチェック
  const parts = setName.split('/');
  for (const part of parts) {
    if (!part || part.trim() === '') {
      throw new ClaudyError(t('common:path.emptyPartInName'), 'INVALID_SET_NAME', { setName });
    }
    
    if (invalidChars.test(part)) {
      throw new ClaudyError(t('common:path.invalidCharacters'), 'INVALID_SET_NAME', { setName });
    }
    
    const upperPart = part.toUpperCase();
    if (invalidNames.includes(upperPart)) {
      throw new ClaudyError(t('common:path.reservedWord', { part }), 'INVALID_SET_NAME', { setName });
    }
    
    // ドットで始まる名前の禁止
    if (part.startsWith('.')) {
      throw new ClaudyError(t('common:path.cannotStartWithDot'), 'INVALID_SET_NAME', { setName });
    }
  }
}