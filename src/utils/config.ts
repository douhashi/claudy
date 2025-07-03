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
import { t } from './i18n.js';
import path from 'path';

const DEFAULT_CONFIG: ClaudyConfig = {
  defaultProfile: 'default',
  profiles: {
    default: {
      path: '~/.config/claudy/profiles/default',
      description: 'Default profile',
    },
  },
};

/**
 * claudyディレクトリを初期化
 * @throws {ClaudyError} ディレクトリ作成または設定ファイル書き込みに失敗した場合
 */
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
    logger.success('claudy configuration initialized (XDG Base Directory compliant)');
  }
}

/**
 * 旧形式から新形式への移行をチェックして実行
 * @returns 移行を実行した場合true
 * @throws {ClaudyError} 設定の移行に失敗した場合
 */
export async function checkAndMigrateLegacyConfig(): Promise<boolean> {
  const legacyDir = getLegacyClaudyDir();
  const newDir = getClaudyDir();
  
  const legacyExists = await fileExists(legacyDir);
  const newExists = await fileExists(newDir);
  
  if (legacyExists && !newExists) {
    logger.info(t('common:config.legacyDetected'));
    
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
      
      logger.success(t('common:config.migrationSuccess'));
      logger.info(t('common:config.migrationHint', { dir: legacyDir }));
      return true;
    } catch (error) {
      logger.error(t('common:config.migrationError'));
      throw new ClaudyError('Configuration migration failed', 'MIGRATION_ERROR', error);
    }
  }
  
  return false;
}

/**
 * 設定ファイルを読み込み
 * @returns 設定オブジェクト
 * @throws {ClaudyError} 設定ファイルの読み込みに失敗した場合
 */
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
    throw new ClaudyError(t('common:config.configLoadError'), 'CONFIG_LOAD_ERROR', error);
  }
}

/**
 * 設定ファイルを保存
 * @param config - 保存する設定オブジェクト
 * @throws {ClaudyError} 設定ファイルの保存に失敗した場合
 */
export async function saveConfig(config: ClaudyConfig): Promise<void> {
  const configPath = getConfigPath();
  try {
    await writeJson(configPath, config);
    logger.debug(t('common:config.configSaved'));
  } catch (error) {
    throw new ClaudyError(t('common:config.configSaveError'), 'CONFIG_SAVE_ERROR', error);
  }
}

/**
 * プロファイルを取得
 * @param profileName - プロファイル名（省略時はデフォルト）
 * @returns プロファイル名
 * @throws {ClaudyError} プロファイルが見つからない場合
 */
export async function getProfile(profileName?: string): Promise<string> {
  const config = await loadConfig();
  const profile = profileName || config.defaultProfile;

  if (!config.profiles[profile]) {
    throw new ClaudyError(
      t('common:config.profileNotFound', { profile }),
      'PROFILE_NOT_FOUND',
      { availableProfiles: Object.keys(config.profiles) },
    );
  }

  return profile;
}

/**
 * プロファイルを追加
 * @param name - プロファイル名
 * @param path - プロファイルのパス
 * @param description - プロファイルの説明
 * @throws {ClaudyError} プロファイルが既に存在する場合
 */
export async function addProfile(name: string, path: string, description?: string): Promise<void> {
  const config = await loadConfig();

  if (config.profiles[name]) {
    throw new ClaudyError(t('common:config.profileExists', { name }), 'PROFILE_EXISTS');
  }

  config.profiles[name] = { path, description };
  await saveConfig(config);
  logger.success(t('common:config.profileAdded', { name }));
}

/**
 * プロファイルを削除
 * @param name - プロファイル名
 * @throws {ClaudyError} プロファイルが見つからない場合、デフォルトプロファイルを削除しようとした場合
 */
export async function removeProfile(name: string): Promise<void> {
  const config = await loadConfig();

  if (!config.profiles[name]) {
    throw new ClaudyError(t('common:config.profileNotFound', { profile: name }), 'PROFILE_NOT_FOUND');
  }

  if (name === config.defaultProfile) {
    throw new ClaudyError(
      t('common:config.cannotDeleteDefault'),
      'DEFAULT_PROFILE_DELETE',
    );
  }

  delete config.profiles[name];
  await saveConfig(config);
  logger.success(t('common:config.profileRemoved', { name }));
}

/**
 * デフォルトプロファイルを設定
 * @param name - プロファイル名
 * @throws {ClaudyError} プロファイルが見つからない場合
 */
export async function setDefaultProfile(name: string): Promise<void> {
  const config = await loadConfig();

  if (!config.profiles[name]) {
    throw new ClaudyError(t('common:config.profileNotFound', { profile: name }), 'PROFILE_NOT_FOUND');
  }

  config.defaultProfile = name;
  await saveConfig(config);
  logger.success(t('common:config.defaultProfileSet', { name }));
}