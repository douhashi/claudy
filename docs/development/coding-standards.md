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

- 機能開発は feature/ ブランチで行う
- バグ修正は fix/ ブランチで行う
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
// ES Modules形式を使用
import { readFile } from 'fs/promises';
import path from 'path';

// 名前付きエクスポートを優先
export { myFunction, MyClass };

// デフォルトエクスポートは主要なクラスや関数のみ
export default MainClass;
```

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
// コマンドは独立したモジュールとして実装
export interface CommandModule {
  name: string;
  description: string;
  options?: CommandOption[];
  action: (options: any) => Promise<void>;
}

// コマンドオプションの型定義
interface CommandOption {
  flags: string;
  description: string;
  defaultValue?: any;
}
```

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

### Jest を使用したユニットテスト

```typescript
// ファイル名は *.test.ts または *.spec.ts
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
jest.mock('fs/promises');

import { readFile } from 'fs/promises';
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

beforeEach(() => {
  mockReadFile.mockClear();
});

it('should read config file', async () => {
  mockReadFile.mockResolvedValue('{"key": "value"}');
  const config = await loadConfig();
  expect(config).toEqual({ key: 'value' });
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