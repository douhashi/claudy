# claudy CLIツールアーキテクチャ

## 概要

claudyは、Claude AIの設定ファイル（CLAUDE.md、.claude/commands/**/*.md）を管理するためのNode.jsベースのCLIツールです。このドキュメントでは、claudyのアーキテクチャ設計と実装方針について説明します。

## プロジェクト構造

```
claudy/
├── bin/                    # CLIエントリーポイント
│   └── claudy             # 実行可能ファイル
├── src/                   # TypeScriptソースコード
│   ├── index.ts          # メインエントリーポイント
│   ├── commands/         # コマンド実装
│   │   ├── init.ts      # 初期化コマンド
│   │   ├── add.ts       # 設定追加コマンド
│   │   ├── list.ts      # 設定一覧コマンド
│   │   ├── remove.ts    # 設定削除コマンド
│   │   └── sync.ts      # 設定同期コマンド
│   ├── utils/            # ユーティリティ関数
│   │   ├── file.ts      # ファイル操作
│   │   ├── path.ts      # パス処理
│   │   ├── config.ts    # 設定管理
│   │   └── logger.ts    # ロギング
│   ├── types/            # TypeScript型定義
│   │   └── index.ts
│   └── templates/        # テンプレートファイル
├── dist/                 # コンパイル済みJavaScript
├── tests/                # テストファイル
├── docs/                 # ドキュメント
└── package.json          # プロジェクト設定
```

## 技術スタック

### コア技術

- **Node.js** (v18+): ランタイム環境
- **TypeScript** (v5+): 型安全性を提供する言語
- **Commander.js**: コマンドライン引数の解析とコマンド構造の実装
- **Chalk**: ターミナル出力の色付けとスタイリング

### 開発ツール

- **ESLint**: コード品質の保証
- **Prettier**: コードフォーマット
- **Jest**: ユニットテストフレームワーク
- **ts-node**: 開発時のTypeScript実行

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
class ClaudyError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
  }
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
program
  .name('claudy')
  .description('Claude AI設定ファイル管理ツール')
  .version(version);

program
  .command('init')
  .description('claudy設定を初期化')
  .action(initCommand);
```

### ファイル管理システム

設定ファイルの読み書きと管理：

- 設定ディレクトリ: `~/.claudy/`
- プロファイル管理: 複数の設定セットをサポート
- テンプレート機能: 標準的な設定テンプレートを提供

### コマンド実装パターン

各コマンドは以下の構造に従います：

```typescript
export interface CommandOptions {
  verbose?: boolean;
  profile?: string;
}

export async function executeCommand(
  options: CommandOptions
): Promise<void> {
  // バリデーション
  // 実行
  // 結果出力
}
```

## データフロー

1. **ユーザー入力** → Commander.jsで解析
2. **コマンド実行** → 適切なコマンドハンドラーを呼び出し
3. **ファイル操作** → fs-extraを使用した安全な操作
4. **結果出力** → Chalkでスタイリングされた出力

## 設定管理

### グローバル設定

`~/.claudy/config.json`:

```json
{
  "defaultProfile": "default",
  "profiles": {
    "default": {
      "path": "~/.claudy/profiles/default"
    }
  }
}
```

### プロファイル構造

各プロファイルは独立したディレクトリ：

```
~/.claudy/profiles/[profile-name]/
├── CLAUDE.md
└── .claude/
    └── commands/
        └── *.md
```

## セキュリティ考慮事項

- ファイルパーミッションの適切な設定
- パストラバーサル攻撃の防止
- ユーザー入力のサニタイゼーション

## パフォーマンス最適化

- 非同期I/O操作の活用
- 大量ファイル操作時のバッチ処理
- キャッシュ機能の実装（必要に応じて）

## テスト戦略

### ユニットテスト

- 各ユーティリティ関数の個別テスト
- モックを使用したファイルシステム操作のテスト

### 統合テスト

- コマンドの実行フローテスト
- 実際のファイルシステムを使用したE2Eテスト

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