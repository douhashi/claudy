import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isInitialized = false;

/**
 * パッケージのルートディレクトリを見つける
 * 開発環境とnpmパッケージの両方で動作するように設計
 */
function findPackageRoot(): string {
  // dist/utils/i18n.js から開始
  let currentDir = __dirname;
  
  // 最大5階層まで遡って package.json を探す
  for (let i = 0; i < 5; i++) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  
  // フォールバック: __dirname から2階層上
  return path.join(__dirname, '../..');
}

export async function initI18n(): Promise<void> {
  if (isInitialized) {
    return;
  }

  const packageRoot = findPackageRoot();
  const localesPath = path.join(packageRoot, 'locales', '{{lng}}', '{{ns}}.json');

  // デバッグ情報: 環境変数 CLAUDY_DEBUG=true で有効化
  if (process.env.CLAUDY_DEBUG === 'true') {
    console.log('i18n Debug Info:');
    console.log('  __dirname:', __dirname);
    console.log('  Package root:', packageRoot);
    console.log('  Locales path pattern:', localesPath);
    
    // 実際のファイルパスを確認
    const testPath = localesPath.replace('{{lng}}', 'en').replace('{{ns}}', 'common');
    console.log('  Test file path:', testPath);
    console.log('  Test file exists:', existsSync(testPath));
  }

  await i18next
    .use(Backend)
    .init({
      lng: 'en',
      fallbackLng: 'en',
      debug: process.env.CLAUDY_DEBUG === 'true',
      interpolation: {
        escapeValue: false,
      },
      backend: {
        loadPath: localesPath,
      },
      ns: ['common', 'commands', 'errors'],
      defaultNS: 'common',
    });

  isInitialized = true;
}

export const t = i18next.t.bind(i18next);

export { i18next };