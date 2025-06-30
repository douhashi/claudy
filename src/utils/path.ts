import path from 'path';
import os from 'os';
import { ClaudyError } from '../types';

export function getHomeDir(): string {
  const homeDir = os.homedir();
  if (!homeDir) {
    throw new ClaudyError('ホームディレクトリが見つかりません', 'HOME_DIR_NOT_FOUND');
  }
  return homeDir;
}

export function getClaudyDir(): string {
  return path.join(getHomeDir(), '.claudy');
}

export function getProfilesDir(): string {
  return path.join(getClaudyDir(), 'profiles');
}

export function getProfileDir(profileName: string): string {
  return path.join(getProfilesDir(), profileName);
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
  return inputPath.split(path.sep).join('/');
}