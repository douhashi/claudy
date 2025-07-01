import { ClaudyConfig, ClaudyError } from '../types/index.js';
import { 
  getConfigPath, 
  getClaudyDir, 
  getProfilesDir,
  getUserConfigDir,
  getProjectsDir,
  getLegacyClaudyDir
} from './path.js';
import { readJson, writeJson, fileExists, ensureDir, copyFileOrDir } from './file.js';
import { logger } from './logger.js';
import path from 'path';

const DEFAULT_CONFIG: ClaudyConfig = {
  defaultProfile: 'default',
  profiles: {
    default: {
      path: '~/.config/claudy/profiles/default',
      description: 'デフォルトプロファイル',
    },
  },
};

export async function initializeClaudyDir(): Promise<void> {
  const claudyDir = getClaudyDir();
  const profilesDir = getProfilesDir();
  const userConfigDir = getUserConfigDir();
  const projectsDir = getProjectsDir();

  await ensureDir(claudyDir);
  await ensureDir(profilesDir);
  await ensureDir(userConfigDir);
  await ensureDir(projectsDir);

  const configPath = getConfigPath();
  const configExists = await fileExists(configPath);

  if (!configExists) {
    await writeJson(configPath, DEFAULT_CONFIG);
    logger.success('claudy設定を初期化しました（XDG Base Directory仕様準拠）');
  }
}

/**
 * 旧形式から新形式への移行をチェックして実行
 */
export async function checkAndMigrateLegacyConfig(): Promise<boolean> {
  const legacyDir = getLegacyClaudyDir();
  const newDir = getClaudyDir();
  
  const legacyExists = await fileExists(legacyDir);
  const newExists = await fileExists(newDir);
  
  if (legacyExists && !newExists) {
    logger.info('旧形式の設定ディレクトリを検出しました。新形式への移行を開始します...');
    
    try {
      // 新しいディレクトリ構造を作成
      await initializeClaudyDir();
      
      // 旧設定ファイルを読み込み
      const legacyConfigPath = path.join(legacyDir, 'config.json');
      if (await fileExists(legacyConfigPath)) {
        const legacyConfig = await readJson<ClaudyConfig>(legacyConfigPath);
        
        // パスを新形式に更新
        const updatedConfig = { ...legacyConfig };
        for (const profileName in updatedConfig.profiles) {
          const profile = updatedConfig.profiles[profileName];
          if (profile.path.startsWith('~/.claudy/')) {
            profile.path = profile.path.replace('~/.claudy/', '~/.config/claudy/');
          }
        }
        
        // 新しい設定を保存
        await saveConfig(updatedConfig);
      }
      
      // プロファイルディレクトリをコピー
      const legacyProfilesDir = path.join(legacyDir, 'profiles');
      if (await fileExists(legacyProfilesDir)) {
        await copyFileOrDir(legacyProfilesDir, getProfilesDir());
      }
      
      logger.success('設定の移行が完了しました');
      logger.info(`旧ディレクトリ (${legacyDir}) は手動で削除してください`);
      return true;
    } catch (error) {
      logger.error('設定の移行中にエラーが発生しました:');
      throw new ClaudyError('設定の移行に失敗しました', 'MIGRATION_ERROR', error);
    }
  }
  
  return false;
}

export async function loadConfig(): Promise<ClaudyConfig> {
  // 移行チェックを実行
  await checkAndMigrateLegacyConfig();
  
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