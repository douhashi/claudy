import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isInitialized = false;

export async function initI18n(): Promise<void> {
  if (isInitialized) {
    return;
  }

  await i18next
    .use(Backend)
    .init({
      lng: 'en',
      fallbackLng: 'en',
      debug: false,
      interpolation: {
        escapeValue: false,
      },
      backend: {
        loadPath: path.join(__dirname, '../../locales/{{lng}}/{{ns}}.json'),
      },
      ns: ['common', 'commands', 'errors'],
      defaultNS: 'common',
    });

  isInitialized = true;
}

export const t = i18next.t.bind(i18next);

export { i18next };