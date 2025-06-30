import { ClaudyConfig, ClaudyError } from '../types';
import { getConfigPath, getClaudyDir, getProfilesDir } from './path';
import { readJson, writeJson, fileExists, ensureDir } from './file';
import { logger } from './logger';

const DEFAULT_CONFIG: ClaudyConfig = {
  defaultProfile: 'default',
  profiles: {
    default: {
      path: '~/.claudy/profiles/default',
      description: 'デフォルトプロファイル',
    },
  },
};

export async function initializeClaudyDir(): Promise<void> {
  const claudyDir = getClaudyDir();
  const profilesDir = getProfilesDir();

  await ensureDir(claudyDir);
  await ensureDir(profilesDir);

  const configPath = getConfigPath();
  const configExists = await fileExists(configPath);

  if (!configExists) {
    await writeJson(configPath, DEFAULT_CONFIG);
    logger.success('claudy設定を初期化しました');
  }
}

export async function loadConfig(): Promise<ClaudyConfig> {
  const configPath = getConfigPath();
  const configExists = await fileExists(configPath);

  if (!configExists) {
    await initializeClaudyDir();
    return DEFAULT_CONFIG;
  }

  try {
    return await readJson<ClaudyConfig>(configPath);
  } catch (error) {
    throw new ClaudyError('設定ファイルの読み込みに失敗しました', 'CONFIG_LOAD_ERROR', error);
  }
}

export async function saveConfig(config: ClaudyConfig): Promise<void> {
  const configPath = getConfigPath();
  try {
    await writeJson(configPath, config);
    logger.debug('設定ファイルを保存しました');
  } catch (error) {
    throw new ClaudyError('設定ファイルの保存に失敗しました', 'CONFIG_SAVE_ERROR', error);
  }
}

export async function getProfile(profileName?: string): Promise<string> {
  const config = await loadConfig();
  const profile = profileName || config.defaultProfile;

  if (!config.profiles[profile]) {
    throw new ClaudyError(
      `プロファイル '${profile}' が見つかりません`,
      'PROFILE_NOT_FOUND',
      { availableProfiles: Object.keys(config.profiles) },
    );
  }

  return profile;
}

export async function addProfile(name: string, path: string, description?: string): Promise<void> {
  const config = await loadConfig();

  if (config.profiles[name]) {
    throw new ClaudyError(`プロファイル '${name}' は既に存在します`, 'PROFILE_EXISTS');
  }

  config.profiles[name] = { path, description };
  await saveConfig(config);
  logger.success(`プロファイル '${name}' を追加しました`);
}

export async function removeProfile(name: string): Promise<void> {
  const config = await loadConfig();

  if (!config.profiles[name]) {
    throw new ClaudyError(`プロファイル '${name}' が見つかりません`, 'PROFILE_NOT_FOUND');
  }

  if (name === config.defaultProfile) {
    throw new ClaudyError(
      'デフォルトプロファイルは削除できません',
      'DEFAULT_PROFILE_DELETE',
    );
  }

  delete config.profiles[name];
  await saveConfig(config);
  logger.success(`プロファイル '${name}' を削除しました`);
}

export async function setDefaultProfile(name: string): Promise<void> {
  const config = await loadConfig();

  if (!config.profiles[name]) {
    throw new ClaudyError(`プロファイル '${name}' が見つかりません`, 'PROFILE_NOT_FOUND');
  }

  config.defaultProfile = name;
  await saveConfig(config);
  logger.success(`デフォルトプロファイルを '${name}' に設定しました`);
}