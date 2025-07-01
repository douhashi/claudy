import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { ClaudyError } from '../types/index.js';

export function getHomeDir(): string {
  const homeDir = os.homedir();
  if (!homeDir) {
    throw new ClaudyError('ホームディレクトリが見つかりません', 'HOME_DIR_NOT_FOUND');
  }
  return homeDir;
}

/**
 * XDG Base Directory仕様に準拠した設定ディレクトリを取得
 * @returns 設定ディレクトリのパス
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
 */
export function getLegacyClaudyDir(): string {
  return path.join(getHomeDir(), '.claudy');
}

/**
 * 新形式のclaudyディレクトリを取得（XDG準拠）
 * @returns claudyディレクトリのパス
 */
export function getClaudyDir(): string {
  return getConfigDir();
}

export function getProfilesDir(): string {
  return path.join(getClaudyDir(), 'profiles');
}

export function getProfileDir(profileName: string): string {
  return path.join(getProfilesDir(), profileName);
}

/**
 * ユーザー設定ディレクトリを取得
 * @returns ユーザー設定ディレクトリのパス
 */
export function getUserConfigDir(): string {
  return path.join(getProfilesDir(), 'default', 'user');
}

/**
 * プロジェクト設定ディレクトリを取得
 * @returns プロジェクト設定ディレクトリのパス
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
 */
export function getProjectConfigDir(projectPath: string): string {
  const projectHash = getProjectHash(projectPath);
  return path.join(getProjectsDir(), projectHash);
}

export function getConfigPath(): string {
  return path.join(getClaudyDir(), 'config.json');
}

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
 */
export function getSetsDir(): string {
  return path.join(getClaudyDir(), 'sets');
}

/**
 * 設定セットのディレクトリを取得
 * @param setName セット名（階層的な名前をサポート）
 * @returns セットディレクトリのパス
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
    throw new ClaudyError('セット名を指定してください', 'INVALID_SET_NAME');
  }

  // パストラバーサル攻撃の防止
  const normalizedName = path.normalize(setName);
  if (normalizedName.includes('..') || path.isAbsolute(normalizedName)) {
    throw new ClaudyError('無効なセット名です', 'INVALID_SET_NAME', { setName });
  }

  // OSごとの予約語と特殊文字のチェック
  const invalidChars = /[:*?"<>|]/;
  const invalidNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1', 'PROFILES'];
  
  // スラッシュで分割して各パートをチェック
  const parts = setName.split('/');
  for (const part of parts) {
    if (!part || part.trim() === '') {
      throw new ClaudyError('セット名に空のパートが含まれています', 'INVALID_SET_NAME', { setName });
    }
    
    if (invalidChars.test(part)) {
      throw new ClaudyError('セット名に使用できない文字が含まれています', 'INVALID_SET_NAME', { setName });
    }
    
    const upperPart = part.toUpperCase();
    if (invalidNames.includes(upperPart)) {
      throw new ClaudyError(`"${part}"は予約語のため使用できません`, 'INVALID_SET_NAME', { setName });
    }
    
    // ドットで始まる名前の禁止
    if (part.startsWith('.')) {
      throw new ClaudyError('セット名はドットで始めることはできません', 'INVALID_SET_NAME', { setName });
    }
  }
}