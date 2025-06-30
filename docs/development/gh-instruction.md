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

# 特定のIssueの詳細を確認
GH_PAGER= gh issue view <issue番号>

# Issueのコメントも含めて確認
GH_PAGER= gh issue view <issue番号> --comments
```

### Issue の編集

```bash
# 実行計画をファイルに保存してIssueの説明欄を更新
cat > tmp/execution_plan.md << 'EOF'
# 実行計画: [タイトル]

## 前提知識
...
EOF

GH_PAGER= gh issue edit <issue番号> --body-file tmp/execution_plan.md

# ラベルを追加
GH_PAGER= gh issue edit <issue番号> --add-label "planning"
```

### Issue へのコメント

```bash
# 作業開始時
GH_PAGER= gh issue comment <issue番号> --body "実装を開始しました。"

# 進捗報告
GH_PAGER= gh issue comment <issue番号> --body "主要な機能の実装が完了しました。現在テストを作成中です。"

# 完了報告（PR作成時）
GH_PAGER= gh issue comment <issue番号> --body "実装が完了し、PR #<PR番号> を作成しました。レビューをお願いします。"
```

## Pull Request 管理

### PR の作成

```bash
# PRテンプレートをファイルに保存
cat > tmp/pr_body.md << 'EOF'
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
EOF

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

## コードレビュー

### レビューコメントの投稿

```bash
# コメントをファイルに保存
cat > tmp/review_comment.md << 'EOF'
## 改善提案

### パフォーマンス
[具体的な改善点]

### セキュリティ
[具体的な問題点]
EOF

# コメントのみのレビュー
GH_PAGER= gh pr review <PR番号> --comment --body-file tmp/review_comment.md

# 承認する場合
GH_PAGER= gh pr review <PR番号> --approve --body "LGTM! 問題がないことを確認しました。"

# 変更要求する場合
GH_PAGER= gh pr review <PR番号> --request-changes --body-file tmp/review_comment.md
```

## Issue の作成

### バグ報告

```bash
# バグ報告をファイルに保存
cat > tmp/bug_report.md << 'EOF'
## バグ概要
[簡潔な説明]

## 再現手順
1. [ステップ1]
2. [ステップ2]

## 期待される動作
[正しい動作の説明]

## 実際の動作
[現在の誤った動作]
EOF

# バグ報告のIssueを作成
GH_PAGER= gh issue create --title "Bug: [バグの概要]" --body-file tmp/bug_report.md --label "bug"
```

### 改善提案

```bash
# 改善提案をファイルに保存
cat > tmp/improvement_issue.md << 'EOF'
## 改善提案

### 現状の問題
[問題の説明]

### 提案内容
[改善案の詳細]

### 期待される効果
- パフォーマンスの向上
- コードの保守性向上
- セキュリティの強化
EOF

# Issueを作成
GH_PAGER= gh issue create --title "改善提案: [タイトル]" --body-file tmp/improvement_issue.md --label "enhancement"
```

## コマンド接頭辞について

### コミットメッセージとブランチ名の接頭辞

- `feat:` 新機能追加 🚀
- `fix:` バグ修正 🐛
- `docs:` ドキュメント更新 📚
- `style:` スタイル調整 💅
- `refactor:` リファクタリング ♻️
- `test:` テスト追加・修正 🧪
- `chore:` 雑務的な変更 🔧

### ブランチ名の例

```bash
# 新機能追加
git checkout -b feat/#<issue番号>-<機能名>

# バグ修正
git checkout -b fix/#<issue番号>-<バグ名>
```

## よく使うワークフロー

### 1. Issue から実装までの流れ

1. Issue を確認して要件を理解
2. 実行計画を作成してIssueに記載
3. ブランチを作成して実装
4. テストとLintを実行
5. PRを作成してレビューを依頼

### 2. PR レビューの流れ

1. PRの内容を確認（差分、テスト結果）
2. 問題があればコメントまたは変更要求
3. 問題がなければ承認

### 3. 進捗報告の習慣

- 作業開始時にIssueにコメント
- 重要な進捗があればIssueにコメント
- PR作成時にIssueにコメント
