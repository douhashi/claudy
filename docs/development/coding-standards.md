# TypeScript/Node.js コーディング規約

## 基本方針

このプロジェクトでは、TypeScript/Node.jsを使用したCLIツール開発において、コードの一貫性、可読性、保守性を確保するための規約を定めています。これらの規約により、開発者間のコラボレーションを促進し、高品質なコードベースを維持します。

## 全般的なガイドライン

- DRY (Don't Repeat Yourself) の原則を守る
- SOLID 原則に従ったコード設計を心がける
- 自己説明的なコードを書く（コメントに頼りすぎない）
- 複雑なロジックには適切なコメントを追加する
- 関数やメソッドは単一責任の原則に従い、1つのタスクのみを実行する
- 命名は明確で、その目的を反映したものにする
- 非同期処理は async/await を優先的に使用する

## バージョン管理とGit

- コミットメッセージは簡潔かつ明確に、現在形で記述する
- PRは小さく保ち、1つの機能または修正に集中する
- PRの説明には変更内容とテスト方法を明記する
- Conventional Commitsに従う（例: `feat:`, `fix:`, `docs:`, `chore:`）

## TypeScript コーディング規約

### スタイル

- [ESLint](https://eslint.org/) と [Prettier](https://prettier.io/) の標準ルールセットに従う
- インデントは2スペースを使用
- セミコロンは省略しない
- シングルクォートを使用（文字列リテラル）
- 行の長さは最大100文字
- 型定義は明示的に記述する（型推論が明確な場合を除く）

### 命名規則

- 変数名・関数名: キャメルケース (`getUserData`)
- 定数: 大文字のスネークケース (`MAX_RETRY_COUNT`)
  - **例外**: エラーコードなどの定数オブジェクトはパスカルケース (`ErrorCodes`)
- クラス名・インターフェース名: パスカルケース (`UserConfig`)
- 型エイリアス: パスカルケース (`ConfigOptions`)
- enum: パスカルケース、値は大文字のスネークケース
- ファイル名: ケバブケース (`user-config.ts`)

### 型定義のベストプラクティス

```typescript
// インターフェースを優先的に使用
interface UserConfig {
  name: string;
  email: string;
  preferences?: UserPreferences;
}

// 型エイリアスは複雑な型やユニオン型に使用
type CommandName = 'init' | 'add' | 'remove' | 'list';

// enumは名前付き定数のグループに使用
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

// 関数の型定義を明確に
type CommandHandler = (options: CommandOptions) => Promise<void>;
```

### エラーハンドリング

```typescript
// カスタムエラークラスを使用
export class ClaudyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ClaudyError';
  }
}

// try-catchでの適切なエラーハンドリング
try {
  await performOperation();
} catch (error) {
  if (error instanceof ClaudyError) {
    logger.error(`Operation failed: ${error.message}`, error.code);
  } else {
    logger.error('Unexpected error:', error);
  }
  throw error; // 必要に応じて再スロー
}
```

### 定数定義パターン

```typescript
// const assertion を使用した定数オブジェクト
export const ErrorCodes = {
  // カテゴリー別にプレフィックスを付けて整理
  
  // 入力検証エラー (VAL_xxx)
  INVALID_SET_NAME: 'VAL_INVALID_SET_NAME',
  INVALID_PATH: 'VAL_INVALID_PATH',
  
  // リソース存在エラー (RES_xxx)
  SET_NOT_FOUND: 'RES_SET_NOT_FOUND',
  FILE_NOT_FOUND: 'RES_FILE_NOT_FOUND',
  
  // 権限エラー (PERM_xxx)
  PERMISSION_DENIED: 'PERM_DENIED',
  
  // システムエラー (SYS_xxx)
  SAVE_ERROR: 'SYS_SAVE_ERROR',
  LOAD_ERROR: 'SYS_LOAD_ERROR',
} as const;

// 型定義を自動生成
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// エラーメッセージのマッピング
export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.INVALID_SET_NAME]: 'セット名が無効です。英数字、ハイフン、アンダースコアのみ使用できます。',
  [ErrorCodes.INVALID_PATH]: 'パスが無効です。',
  [ErrorCodes.SET_NOT_FOUND]: '指定されたセットが見つかりません。',
  [ErrorCodes.FILE_NOT_FOUND]: 'ファイルが見つかりません。',
  [ErrorCodes.PERMISSION_DENIED]: 'アクセス権限がありません。',
  [ErrorCodes.SAVE_ERROR]: '設定の保存中にエラーが発生しました。',
  [ErrorCodes.LOAD_ERROR]: '設定の読み込み中にエラーが発生しました。',
};
```

### 定数定義のベストプラクティス

1. **const assertion**: オブジェクトリテラルに`as const`を付けて、値を文字列リテラル型として扱う
2. **カテゴリー別プレフィックス**: エラーコードをカテゴリー別に整理し、プレフィックスで分類
3. **型の自動生成**: `typeof`と`keyof`を組み合わせて、定数から型を自動生成
4. **メッセージマッピング**: エラーコードとメッセージを分離し、保守性を向上

### 非同期処理

```typescript
// async/awaitを使用
async function fetchData(): Promise<Data> {
  const response = await fetch(url);
  return response.json();
}

// 並列処理にはPromise.allを使用
const [users, posts] = await Promise.all([
  fetchUsers(),
  fetchPosts()
]);

// エラーを無視する場合はPromise.allSettledを使用
const results = await Promise.allSettled([
  operation1(),
  operation2()
]);
```

## Node.js 固有のベストプラクティス

### モジュールシステム

```typescript
// ES Modules形式を使用（.js拡張子を付ける）
import { readFile } from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';  // ローカルモジュールは必ず.js拡張子
import { ClaudyError } from '../types/errors.js';

// fs-extraの特殊なインポート方法
import fsExtra from 'fs-extra';
const fs = fsExtra;  // 慣例的にfsとして使用

// 名前付きエクスポートを優先
export { myFunction, MyClass };

// デフォルトエクスポートは主要なクラスや関数のみ
export default MainClass;
```

### ESモジュールの注意点

1. **拡張子の明示**: ローカルモジュールをインポートする際は必ず`.js`拡張子を付ける（TypeScriptファイルでも`.js`）
2. **package.json設定**: `"type": "module"`を設定してESモジュールを有効化
3. **fs-extraのインポート**: デフォルトインポートして`const fs = fsExtra`として使用
4. **相対パスの使用**: ローカルモジュールは相対パス（`./`または`../`）で指定

### ファイルシステム操作

```typescript
// 非同期APIを使用
import { readFile, writeFile } from 'fs/promises';

// パスの結合はpath.joinを使用
const configPath = path.join(homedir, '.claudy', 'config.json');

// ファイル存在確認
import { access, constants } from 'fs/promises';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// エラーハンドリングを含むファイル操作
import { handleFileOperation } from '../utils/file-operations.js';

// ファイル読み込みの例
const content = await handleFileOperation(
  async () => await fs.readFile(filePath, 'utf-8'),
  ErrorCodes.FILE_NOT_FOUND,
  `ファイルの読み込みに失敗しました: ${filePath}`
);

// ファイル書き込みの例
await handleFileOperation(
  async () => {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
  },
  ErrorCodes.SAVE_ERROR,
  `ファイルの書き込みに失敗しました: ${filePath}`
);
```

### エラーハンドリングのベストプラクティス

```typescript
// システムエラーをClaudyErrorでラップ
export function wrapError(
  error: unknown,
  code: ErrorCode,
  message?: string
): ClaudyError {
  if (error instanceof ClaudyError) {
    return error;
  }
  
  const errorMessage = message || ErrorMessages[code];
  const systemError = error instanceof Error ? error : new Error(String(error));
  
  return new ClaudyError(errorMessage, code, {
    originalError: systemError,
    stack: systemError.stack
  });
}

// ファイル操作のエラーハンドリング
export async function handleFileOperation<T>(
  operation: () => Promise<T>,
  errorCode: ErrorCode,
  errorMessage?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw wrapError(error, errorCode, errorMessage);
  }
}
```

### 環境変数とプロセス管理

```typescript
// 環境変数の型安全な取得
function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value || defaultValue!;
}

// プロセス終了時のクリーンアップ
process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});
```

## CLIツール固有のガイドライン

### コマンド構造

```typescript
// コマンドオプションのインターフェース定義
interface SaveOptions {
  verbose?: boolean;
  force?: boolean;
  dry?: boolean;
  // その他のオプション
}

// コマンドの実行関数（ビジネスロジック）
export async function executeSaveCommand(
  name: string,
  options: SaveOptions
): Promise<void> {
  // バリデーション
  if (!isValidSetName(name)) {
    throw new ClaudyError(
      `無効なセット名です: ${name}`,
      ErrorCodes.INVALID_SET_NAME
    );
  }
  
  // メイン処理
  await saveConfiguration(name, options);
  
  // 成功メッセージ
  logger.success(`設定セット '${name}' を保存しました`);
}

// Commanderへの登録関数
export function registerSaveCommand(program: Command): void {
  program
    .command('save <name>')
    .description('現在の設定をセットとして保存')
    .option('-f, --force', '既存のセットを上書き')
    .option('-d, --dry', 'ドライラン（実際には保存しない）')
    .action(async (name: string, options: SaveOptions) => {
      // グローバルオプションのマージ
      const globalOptions = program.opts();
      options.verbose = globalOptions.verbose || false;
      
      try {
        await executeSaveCommand(name, options);
      } catch (error) {
        await handleError(error, ErrorCodes.SAVE_ERROR);
      }
    });
}
```

### コマンド実装のベストプラクティス

1. **関数の分離**: `executeXxxCommand`（ビジネスロジック）と`registerXxxCommand`（CLIバインディング）を分離
2. **型安全性**: コマンドオプションには必ずインターフェースを定義
3. **エラーハンドリング**: `try-catch`でエラーをキャッチし、`handleError`で統一的に処理
4. **グローバルオプション**: `program.opts()`からグローバルオプションを取得してマージ

### ユーザー出力

```typescript
// 構造化されたロガーを使用
import chalk from 'chalk';

class Logger {
  info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }
  
  success(message: string): void {
    console.log(chalk.green('✓'), message);
  }
  
  error(message: string): void {
    console.error(chalk.red('✗'), message);
  }
  
  warn(message: string): void {
    console.warn(chalk.yellow('⚠'), message);
  }
}
```

### インタラクティブプロンプト

```typescript
// inquirerを使用した対話的な入力
import inquirer from 'inquirer';

interface UserInput {
  projectName: string;
  useTypeScript: boolean;
}

const answers = await inquirer.prompt<UserInput>([
  {
    type: 'input',
    name: 'projectName',
    message: 'プロジェクト名を入力してください:',
    validate: (input) => input.length > 0 || '名前は必須です'
  },
  {
    type: 'confirm',
    name: 'useTypeScript',
    message: 'TypeScriptを使用しますか？',
    default: true
  }
]);
```

## テスト

### Vitest を使用したユニットテスト

```typescript
// ファイル名は *.test.ts または *.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('UserConfig', () => {
  describe('validate', () => {
    it('should accept valid config', () => {
      const config = { name: 'test', email: 'test@example.com' };
      expect(validateConfig(config)).toBe(true);
    });
    
    it('should reject invalid email', () => {
      const config = { name: 'test', email: 'invalid' };
      expect(() => validateConfig(config)).toThrow();
    });
  });
});
```

### モックとスタブ

```typescript
// ファイルシステムのモック
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { readFile } from 'fs/promises';

// モジュール全体をモック
vi.mock('fs/promises');

// モックされた関数の型安全なアクセス
const mockReadFile = vi.mocked(readFile);

beforeEach(() => {
  // モックをクリア
  vi.clearAllMocks();
});

it('should read config file', async () => {
  mockReadFile.mockResolvedValue('{"key": "value"}');
  const config = await loadConfig();
  expect(config).toEqual({ key: 'value' });
});
```

### Vitestの特徴とベストプラクティス

- **高速**: VitestはViteベースで動作し、Jestよりも高速
- **ESM対応**: ES Modulesをネイティブサポート
- **TypeScript対応**: 設定不要でTypeScriptをサポート
- **Watch mode**: ファイル変更を検知して自動でテストを再実行
- **グローバルAPI**: `vitest.config.ts`で`globals: true`を設定することで、`describe`、`it`などをインポートなしで使用可能

```typescript
// vitest.config.ts の例
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
});
```

## ドキュメント

### JSDoc コメント

```typescript
/**
 * ユーザー設定を読み込みます
 * @param profileName - プロファイル名（省略時はデフォルト）
 * @returns 設定オブジェクト
 * @throws {ClaudyError} 設定ファイルが見つからない場合
 */
export async function loadConfig(profileName?: string): Promise<UserConfig> {
  // 実装
}
```

### README とドキュメント

- インストール方法を明記
- 基本的な使用例を提供
- 全てのコマンドとオプションを文書化
- トラブルシューティングセクションを含める

## コードレビューチェックリスト

- [ ] TypeScriptの型が適切に定義されているか
- [ ] エラーハンドリングが適切か
- [ ] 非同期処理が正しく実装されているか
- [ ] テストが十分に書かれているか
- [ ] ドキュメントが更新されているか
- [ ] ESLintエラーがないか
- [ ] セキュリティ上の問題がないか

## パフォーマンス考慮事項

- 大量のファイル操作は並列処理を検討
- 頻繁にアクセスするデータはキャッシュ
- 不要な同期処理を避ける
- メモリリークに注意（特にイベントリスナー）

## セキュリティ

- ユーザー入力は必ず検証・サニタイズ
- パストラバーサルを防ぐ
- 環境変数や設定ファイルに機密情報を含めない
- 依存関係の脆弱性を定期的にチェック

---

この規約に従うことで、保守性が高く、安全で効率的なCLIツールを開発できます。規約は必要に応じて更新され、プロジェクトの成長とともに進化します。