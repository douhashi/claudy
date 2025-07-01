# claudy CLIツールアーキテクチャ

## 概要

claudyは、Claude AIの設定ファイル（CLAUDE.md、.claude/commands/**/*.md）を管理するためのNode.jsベースのCLIツールです。このドキュメントでは、claudyのアーキテクチャ設計と実装方針について説明します。

> **Note**: このドキュメントは v0.1.0 時点の実装を反映しています（最終更新: 2025-07-01）

## プロジェクト構造

```
claudy/
├── bin/                    # CLIエントリーポイント
│   └── claudy             # 実行可能ファイル
├── src/                   # TypeScriptソースコード
│   ├── index.ts          # メインエントリーポイント
│   ├── commands/         # コマンド実装
│   │   ├── save.ts      # 設定保存コマンド
│   │   ├── load.ts      # 設定復元コマンド
│   │   ├── list.ts      # 設定一覧コマンド
│   │   ├── delete.ts    # 設定削除コマンド
│   │   └── migrate.ts   # 設定移行コマンド
│   ├── utils/            # ユーティリティ関数
│   │   ├── file.ts      # ファイル操作
│   │   ├── path.ts      # パス処理
│   │   ├── config.ts    # 設定管理
│   │   ├── logger.ts    # ロギング
│   │   ├── errorHandler.ts  # エラーハンドリング
│   │   ├── file-selector.ts # ファイル選択UI
│   │   └── reference-parser.ts # 参照パーサー
│   └── types/            # TypeScript型定義
│       ├── index.ts      # 共通型定義
│       └── errors.ts     # エラー型定義
├── tests/                # テストファイル
│   ├── commands/         # コマンドのテスト
│   ├── utils/            # ユーティリティのテスト
│   ├── integration/      # 統合テスト
│   └── __mocks__/        # モック定義
├── docs/                 # ドキュメント
│   └── development/      # 開発ドキュメント
├── dist/                 # コンパイル済みJavaScript
├── eslint.config.js      # ESLint設定
├── vitest.config.ts      # Vitestテスト設定
├── tsconfig.json         # TypeScript設定
└── package.json          # プロジェクト設定
```

## 技術スタック

### コア技術

- **Node.js** (v18+): ランタイム環境
- **TypeScript** (v5+): 型安全性を提供する言語
- **Commander.js**: コマンドライン引数の解析とコマンド構造の実装
- **Chalk**: ターミナル出力の色付けとスタイリング

### 開発ツール

- **ESLint** (v9+): コード品質の保証
- **Prettier** (v3+): コードフォーマット
- **Vitest** (v3+): 高速なユニットテストフレームワーク
- **ts-node** (v10+): 開発時のTypeScript実行

### ユーティリティライブラリ

- **fs-extra**: 拡張ファイルシステム操作
- **inquirer**: インタラクティブなプロンプト
- **glob**: ファイルパターンマッチング
- **yaml**: YAML形式の設定ファイル読み書き

## アーキテクチャ設計原則

### 1. モジュラー設計

各機能は独立したモジュールとして実装し、疎結合を維持します：

- コマンドは独立したファイルで実装
- ユーティリティ関数は機能別に分離
- 共通インターフェースを通じた相互作用

### 2. 型安全性

TypeScriptの型システムを最大限活用：

```typescript
interface ClaudeConfig {
  version: string;
  profiles: Profile[];
  commands: CommandConfig[];
}

interface Profile {
  name: string;
  path: string;
  settings: Record<string, unknown>;
}
```

### 3. エラーハンドリング

明確で有用なエラーメッセージ：

```typescript
// エラークラスの定義
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

// エラーコードの定義
export enum ErrorCodes {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  INVALID_SET_NAME = 'INVALID_SET_NAME',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  // ...
}

// エラーハンドリング関数
export async function handleError(error: Error): Promise<never> {
  if (error instanceof ClaudyError) {
    logger.error(error.message, error.code);
  } else {
    logger.error('予期しないエラーが発生しました', error);
  }
  process.exit(1);
}
```

### 4. クロスプラットフォーム対応

- パス処理には`path.join()`を使用
- ホームディレクトリは`os.homedir()`で取得
- 改行コードの違いを考慮

## 主要コンポーネント

### CLI エントリーポイント

Commanderを使用したコマンド定義：

```typescript
const program = new Command();

program
  .name('claudy')
  .description('Claude AI設定ファイル管理ツール')
  .version(version);

// コマンドの登録
registerSaveCommand(program);
registerLoadCommand(program);
registerListCommand(program);
registerDeleteCommand(program);
registerMigrateCommand(program);
```

### ファイル管理システム

設定ファイルの読み書きと管理：

- 設定ディレクトリ: `~/.config/claudy/` (XDG Base Directory準拠)
- プロファイル管理: 複数の設定セットをサポート
- テンプレート機能: 標準的な設定テンプレートを提供

### コマンド実装パターン

各コマンドは独立したモジュールとして実装されます：

```typescript
// コマンドオプションの型定義
interface SaveOptions {
  verbose?: boolean;
  force?: boolean;
  interactive?: boolean;
  all?: boolean;
}

// コマンド登録関数
export function registerSaveCommand(program: Command): void {
  program
    .command('save <set-name>')
    .description('現在のCLAUDE.mdとコマンド設定を保存')
    .option('-f, --force', '上書き確認をスキップ')
    .option('-i, --interactive', '対話モードでファイル選択')
    .option('-a, --all', 'すべてのファイルを保存')
    .action(async (setName: string, options: SaveOptions) => {
      await executeSaveCommand(setName, options);
    });
}
```

## データフロー

1. **ユーザー入力** → Commander.jsで解析
2. **コマンド実行** → 適切なコマンドハンドラーを呼び出し
3. **ファイル操作** → fs-extraを使用した安全な操作
4. **結果出力** → Chalkでスタイリングされた出力

## 設定管理

### グローバル設定

`~/.config/claudy/config.json`:

```json
{
  "defaultProfile": "default",
  "profiles": {
    "default": {
      "path": "~/.config/claudy/profiles/default"
    }
  }
}
```

### プロファイル構造

各プロファイルは独立したディレクトリ：

```
~/.config/claudy/profiles/[profile-name]/
├── CLAUDE.md
└── .claude/
    └── commands/
        └── *.md
```

### コマンド一覧

- **save**: 現在のCLAUDE.mdとコマンド設定を保存
- **load**: 保存された設定を現在のディレクトリに復元
- **list**: 保存されたプロファイルの一覧表示
- **delete**: 指定したプロファイルを削除
- **migrate**: 旧形式から新形式への設定移行

## セキュリティ考慮事項

- ファイルパーミッションの適切な設定
- パストラバーサル攻撃の防止
- ユーザー入力のサニタイゼーション

## パフォーマンス最適化

- 非同期I/O操作の活用
- 大量ファイル操作時のバッチ処理
- キャッシュ機能の実装（必要に応じて）

## テスト戦略

### テストフレームワーク

Vitestを使用した高速なテスト実行：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui"
  }
}
```

### ユニットテスト

- 各ユーティリティ関数の個別テスト
- モックを使用したファイルシステム操作のテスト
- コマンドの単体テスト

### 統合テスト

- コマンドの実行フローテスト
- 実際のファイルシステムを使用したE2Eテスト

```typescript
// テストファイルの例 (save.test.ts)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeSaveCommand } from '../commands/save';

describe('saveコマンド', () => {
  it('正常に設定を保存できること', async () => {
    // テスト実装
  });
});
```

### テストカバレッジ目標

- 全体: 80%以上
- コアロジック: 90%以上

## 拡張性

### プラグインシステム（将来実装）

```typescript
interface ClaudyPlugin {
  name: string;
  version: string;
  register(cli: ClaudyCLI): void;
}
```

### カスタムコマンドサポート

ユーザー定義のコマンドを追加可能な構造

## CI/CD

- GitHub Actionsによる自動テスト
- npm publishの自動化
- リリースノートの自動生成

## モニタリングとログ

- デバッグモード（`--verbose`フラグ）
- エラーログの記録
- 使用統計の収集（オプトイン）

---

このアーキテクチャは、拡張性と保守性を重視し、将来的な機能追加にも対応できる柔軟な設計となっています。