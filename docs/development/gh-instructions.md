# GitHub CLI (gh) コマンドガイド

このドキュメントは、プロジェクトで使用するGitHub CLI（ghコマンド）の使用方法をまとめたものです。

## 基本的な使い方

### 環境変数の設定

```bash
# ページャーを無効化してコマンド出力を直接表示
GH_PAGER= gh <command>
```

`GH_PAGER=` を付けることで、出力が長い場合でもページャーを使わずに全ての内容を表示できます。

## Issue 管理

### Issue の確認

```bash
# オープンなIssue一覧を確認
GH_PAGER= gh issue list --state open

# 特定のIssueの詳細を確認(全コメントを含む)
GH_PAGER= gh issue view <issue番号> --comments
```

### Issue の作成・編集

#### ghコマンドの実行

- 事前に一時ファイルとして、 `tmp/execution_plan.md` など、作成したいIssueのコンテンツを作成しておく

```bash
# Issueを作成
gh issue create --title "feat: ユーザ登録フロー" --body-file tmp/issue_content.md

# Issueの説明欄を更新
gh issue edit <issue番号> --body-file tmp/execution_plan.md
```

### Issue へのコメント

```bash
# 作業開始時
gh issue comment <issue番号> --body "実装を開始しました。"

# 進捗報告
gh issue comment <issue番号> --body "主要な機能の実装が完了しました。現在テストを作成中です。"

# 完了報告（PR作成時）
gh issue comment <issue番号> --body "実装が完了し、PR #<PR番号> を作成しました。レビューをお願いします。"
```

## Pull Request 管理

### PR の作成

#### PR作成前のチェックリスト

- [ ] ローカルの自動テスト(フルテスト)が全てパスしていること
- [ ] `npm run lint` で全ファイルのLintエラーがないこと
- [ ] `npm run build` でTypeScriptのコンパイルエラーがないこと

#### テンプレートファイルの作成

- 事前にPRの内容をファイルで作成しておく

```
## 概要
[実装した機能/修正の説明]

## 関連するIssue
fixes #<issue番号>

## 変更内容
- [主な変更点1]
- [主な変更点2]

## テスト結果
- [ ] ユニットテスト実行済み
- [ ] システムテスト実行済み
- [ ] rubocop実行済み

## スクリーンショット（UI変更がある場合）
[該当する場合は画像を添付]

## レビューポイント
[レビュアーに特に確認してほしい点]
```

#### PR作成コマンド

```bash
# PRを作成
gh pr create --title "<接頭辞>: タイトル" --body-file tmp/pr_body.md --base main
```

### PR の確認

```bash
# PR一覧の確認
GH_PAGER= gh pr list

# オープンなPR一覧を確認
GH_PAGER= gh pr list --state open

# 作成したPRの詳細確認
GH_PAGER= gh pr view <PR番号>

# PRの変更ファイル一覧を確認
GH_PAGER= gh pr diff <PR番号> --name-only

# PRの差分を詳細に確認
GH_PAGER= gh pr diff <PR番号>

# CIの状態確認
GH_PAGER= gh pr checks <PR番号>
```

### PR へのコメント

```bash
# レビューコメントへの対応後、コメント追加
GH_PAGER= gh pr comment <PR番号> --body "レビューコメントに対応しました。再度ご確認お願いします。"
```

### ブランチ名の例

```bash
# 新機能追加
git checkout -b feat/#<issue番号>-<機能名>

# バグ修正
git checkout -b fix/#<issue番号>-<バグ名>
```

## よく使うテンプレート

- 実行計画テンプレート: @docs/development/plan-template.md

## よく使うワークフロー

### 1. Issue から実装までの流れ

1. Issue を確認して要件を理解
2. 実行計画を作成してIssueに記載
3. ブランチを作成して実装
4. テストとLintを実行
5. PRを作成してレビューを依頼

### 2. 進捗報告の習慣

- 作業開始時にIssueにコメント
- 重要な進捗があればIssueにコメント
- PR作成時にIssueにコメント
