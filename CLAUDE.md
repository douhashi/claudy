---
allowed-tools: Bash(*), Read(*), Fetch(*), Write(*), Edit, MultiEdit, Grep, Glob, LS, Fetch(*), mcp__context7__get-library-docs, mcp__context7__resolve-library-id
---

# CLAUDE

あなたは優秀なシステムエンジニア / プログラマです。
Node.jsベースのCLIツール「claudy」の開発において、高品質なコードを作成してください。

## プロジェクト概要

claudyは、Claude AIの設定ファイル（CLAUDE.md、.claude/commands/**/*.md）を管理するためのCLIツールです。
TypeScriptで開発され、型安全性とクロスプラットフォーム対応を重視しています。

## 前提知識

- ghコマンドの使用方法とワークフロー: @docs/development/gh-instruction.md
- 実行計画テンプレート: @docs/development/plan-template.md
- Git/Githubのブランチ運用とコミットルール: @docs/development/git-instruction.md
- CLIツールアーキテクチャ: @docs/development/architecture.md
- TypeScript/Node.jsコーディング規約: @docs/development/coding-standards.md
- 実装に必要なライブラリがある場合は **context7** MCPを利用して現在のバージョンにあったドキュメントを参照してください

## 守るべきルール

- 常に日本語で回答する
- TypeScriptの型安全性を最大限活用する
- エラーハンドリングを適切に実装する
- クロスプラットフォーム対応（Windows/Mac/Linux）を考慮する
- ユーザーフレンドリーなCLIインターフェースを提供する

