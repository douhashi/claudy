# claudy

Claude AI設定ファイル管理ツール

[![npm version](https://badge.fury.io/js/claudy.svg)](https://badge.fury.io/js/claudy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📋 概要

claudyは、Claude AIの設定ファイル（CLAUDE.md、.claude/commands/**/*.md）を管理するためのCLIツールです。複数のプロジェクトやコンテキストごとに異なる設定セットを簡単に切り替えることができます。

### 主な機能

- 🗂️ **設定ファイルのセット管理** - プロジェクトごとに異なる設定を保存・復元
- 🔄 **簡単な切り替え** - 一つのコマンドで設定を切り替え
- 🛡️ **安全な操作** - 既存ファイルのバックアップ、削除前の確認
- 🌐 **クロスプラットフォーム対応** - macOS、Linuxで動作
- 📝 **型安全** - TypeScriptで実装された堅牢なコード

## 🚀 インストール

### 動作環境

- **OS**: macOS, Linux
- **Node.js**: 18.x, 20.x, 22.x

### npm（推奨）

```bash
npm install -g claudy
```

### yarn

```bash
yarn global add claudy
```

### pnpm

```bash
pnpm add -g claudy
```

## 📖 使い方

### 基本的なワークフロー

1. **現在の設定を保存**
   ```bash
   # プロジェクトのルートディレクトリで
   claudy save myproject
   ```

2. **保存済みの設定を一覧表示**
   ```bash
   claudy list
   ```

3. **別の設定を展開**
   ```bash
   # 別のプロジェクトに移動して
   cd ~/another-project
   claudy load myproject
   ```

### コマンド一覧

詳細なコマンドリファレンスは[CLIコマンドリファレンス](docs/cli-reference.md)を参照してください。

#### `claudy save <name>`
Claude設定ファイルを名前付きセットとして保存します。デフォルトでインタラクティブにファイルを選択できます。

```bash
claudy save myproject       # インタラクティブにファイルを選択して保存（デフォルト）
claudy save frontend -a     # 全ファイルを自動的に保存
claudy save backend -f      # 既存のセットを強制上書き
claudy save project-v2 -a -f # 全ファイルを自動保存し、既存セットを上書き
```

**オプション:**
- `-a, --all` - 全ファイルを自動的に保存（インタラクティブ選択をスキップ）
- `-f, --force` - 既存のセットを確認なしで上書き

**対象ファイル:**
- プロジェクトレベル:
  - `CLAUDE.md` - メインの設定ファイル
  - `.claude/commands/**/*.md` - カスタムコマンド定義
- ユーザーレベル（デフォルトで選択可能）:
  - `~/.claude/CLAUDE.md` - グローバル設定
  - `~/.claude/commands/**/*.md` - グローバルコマンド

#### `claudy load <name>`
保存済みの設定セットを現在のディレクトリに展開します。

```bash
claudy load frontend        # "frontend"セットを展開
claudy load backend -f      # 既存ファイルを強制上書き
```

**既存ファイルの処理オプション:**
- バックアップを作成（.bakファイル）
- 上書き
- キャンセル

#### `claudy list`
保存済みの設定セット一覧を表示します。

```bash
claudy list                 # 全てのセットを表示
claudy list -v              # 詳細情報付きで表示
```

**表示内容:**
- セット名
- 作成日時
- ファイル数

#### `claudy delete <name>`
指定した設定セットを削除します。

```bash
claudy delete old-project   # 削除（確認あり）
claudy delete temp -f       # 即座に削除
```

### グローバルオプション

- `-v, --verbose` - 詳細なログを出力
- `-h, --help` - ヘルプを表示
- `-V, --version` - バージョンを表示

## 💡 使用例

### プロジェクトテンプレートの管理

```bash
# テンプレートプロジェクトで理想的な設定を作成
cd ~/templates/react-app
vim CLAUDE.md
# ... Claude AI用の詳細な指示を記載 ...

# テンプレートとして保存（インタラクティブに必要なファイルのみ選択）
claudy save react-template

# 新しいプロジェクトで使用
cd ~/projects/new-react-app
claudy load react-template
```

### チーム内での設定共有

```bash
# チームの標準設定を保存（全ファイルを含む）
claudy save team-standard -a

# 他のメンバーも同じ設定を使用
claudy load team-standard
```

### コンテキストの切り替え

```bash
# フロントエンド開発用の設定
claudy save frontend-context

# バックエンド開発用の設定
claudy save backend-context

# 必要に応じて切り替え
claudy load frontend-context  # フロントエンド作業時
claudy load backend-context   # バックエンド作業時
```

## 🛡️ エラーハンドリング

claudyは、様々なエラーケースに対して適切なメッセージと解決策を提示します：

- **ファイルアクセス権限エラー** - 管理者権限での実行を提案
- **ディスク容量不足** - 不要なファイルの削除を提案
- **ファイルロックエラー** - リトライ機能付き
- **無効なセット名** - 使用可能な文字の案内

## 🔧 設定

### 保存場所

設定セットは以下の場所に保存されます：

- **Windows**: `%USERPROFILE%\.claudy\`
- **macOS/Linux**: `~/.claudy/`

### ディレクトリ構造

```
~/.claudy/
├── myproject/
│   ├── CLAUDE.md
│   └── .claude/
│       └── commands/
│           ├── build.md
│           └── test.md
├── frontend/
│   ├── CLAUDE.md
│   └── .claude/
│       └── commands/
│           └── dev.md
└── backend/
    ├── CLAUDE.md
    └── .claude/
        └── commands/
            └── deploy.md
```

## 🚧 トラブルシューティング

### "セットが見つかりません"エラー

```bash
# 保存済みセットを確認
claudy list

# セット名のタイプミスをチェック
claudy load myproject  # "myProject"ではない
```

### 権限エラー

```bash
# Windowsの場合（管理者として実行）
# macOS/Linuxの場合
sudo claudy save myproject
```

### ファイルロックエラー

エディタやIDEでファイルを開いている場合は閉じてから再実行してください。

## 🤝 コントリビューション

### 開発環境のセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/douhashi/claudy.git
cd claudy

# 依存関係をインストール
npm install

# 開発モードで実行
npm run dev
```

### ビルドとテスト

```bash
# TypeScriptのコンパイル
npm run build

# テストの実行
npm test

# Lintチェック
npm run lint

# 型チェック
npm run type-check
```

### Pull Requestのガイドライン

1. 新機能の場合は、まずIssueを作成して議論
2. テストを追加（カバレッジ80%以上を維持）
3. コミットメッセージは[Conventional Commits](https://www.conventionalcommits.org/)に従う
4. TypeScriptの型安全性を維持

## 📝 ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 🙏 謝辞

このプロジェクトは、Claude AIを使用する開発者コミュニティのフィードバックとサポートによって成り立っています。

## 📧 サポート

- **Issues**: [GitHub Issues](https://github.com/douhashi/claudy/issues)
- **Discussions**: [GitHub Discussions](https://github.com/douhashi/claudy/discussions)

---

Made with ❤️ by [douhashi](https://github.com/douhashi) and contributors