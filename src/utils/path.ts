import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { ClaudyError } from '../types';

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