# claudy

Claude AI設定ファイル管理ツール

## 概要

claudyは、Claude AIの設定ファイル（CLAUDE.md、.claude/commands/**/*.md）を管理するためのCLIツールです。複数のプロジェクトやコンテキストごとに異なる設定セットを簡単に切り替えることができます。

## インストール

```bash
npm install -g claudy
```

## 使い方

### 初期化

```bash
claudy init
```

### ヘルプ

```bash
claudy --help
```

## 開発

### セットアップ

```bash
git clone https://github.com/douhashi/claudy.git
cd claudy
npm install
```

### ビルド

```bash
npm run build
```

### テスト

```bash
npm test
```

### Lint

```bash
npm run lint
```

## ライセンス

MIT