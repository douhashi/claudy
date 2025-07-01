# Git/Githubのブランチ運用とコミットルール

このドキュメントは、プロジェクトにおけるGitの運用ルールとコミット規約をまとめたものです。

## Git Worktree環境

現在のディレクトリが `.git/worktree` 以下にある場合は、git worktree機能を使った作業環境です。
現在のディレクトリ (例: `.git/worktree/issue-12`) が、コードベースなので、現在のディレクトリより上位のファイルを書き換えないようにしてください。

## ブランチ運用

### ブランチ命名規則

ブランチ名は以下の形式に従ってください：

```
<prefix>/#<issue番号>-<簡潔な説明>
```

#### 接頭辞（prefix）の種類

| 接頭辞 | 用途 | 例 |
|--------|------|-----|
| `feat` | 新機能追加 | `feat/#123-user-authentication` |
| `fix` | バグ修正 | `fix/#456-login-error` |
| `docs` | ドキュメント更新 | `docs/#789-api-documentation` |
| `style` | スタイル調整（ロジックに影響しない変更） | `style/#234-button-design` |
| `refactor` | リファクタリング | `refactor/#567-payment-service` |
| `test` | テスト追加・修正 | `test/#890-user-model-specs` |
| `chore` | 雑務的な変更（ビルド、設定など） | `chore/#345-update-dependencies` |

### ブランチ作成コマンド

```bash
# 新機能追加
git checkout -b feat/#<issue番号>-<機能名>

# バグ修正
git checkout -b fix/#<issue番号>-<バグ名>

# その他の例
git checkout -b docs/#<issue番号>-<ドキュメント名>
git checkout -b style/#<issue番号>-<対象名>
git checkout -b refactor/#<issue番号>-<対象名>
git checkout -b test/#<issue番号>-<テスト名>
git checkout -b chore/#<issue番号>-<作業名>
```

## npm scriptsの使用

このプロジェクトでは、以下のnpm scriptsを使用して開発ワークフローを管理します：

```bash
# コードフォーマット（Prettier）
npm run format

# Lintチェック（ESLint）
npm run lint

# テスト実行（Vitest）
npm run test

# テストをウォッチモードで実行
npm run test:watch

# テストカバレッジを計測
npm run test:coverage

# TypeScriptビルド
npm run build

# 開発モード（ファイル監視）
npm run dev
```

## コミットルール

### コミットは意味のある最小の単位で行う

コミットタイミングの例:

1. 新しいコマンドの実装が完了したとき
2. コマンドのテストが完了して、テストがパスしたとき
3. ユーティリティ関数の実装が完了したとき
4. 型定義ファイルの更新が完了したとき
5. 統合テストの実装が完了して、テストがパスしたとき

### コミット前の確認事項

```bash
# コミット前にコードスタイルを整える（自動修正）
npm run format

# Lintチェック
npm run lint

# テスト実行
npm run test

# TypeScriptの型チェック
npm run build

# コミット
git add .
git commit -m "<type>: コミットメッセージ"
```

### コミットメッセージ形式

コミットメッセージは以下の形式に従ってください：

```
<type>: <subject>

[optional body]

[optional footer]
```

### コミットタイプ

| タイプ | 説明 | 絵文字 |
|--------|------|--------|
| `feat` | 新機能追加 | 🚀 |
| `fix` | バグ修正 | 🐛 |
| `docs` | ドキュメント更新 | 📚 |
| `style` | スタイル調整（コードの意味に影響しない変更） | 💅 |
| `refactor` | リファクタリング（機能追加やバグ修正を含まない） | ♻️ |
| `test` | テスト追加・修正 | 🧪 |
| `chore` | 雑務的な変更（ビルド、ツール、ライブラリなど） | 🔧 |

### コミット例

```bash
# 新機能追加
git commit -m "feat: saveコマンドに対話モードオプションを追加"

# バグ修正
git commit -m "fix: ファイルパスにスペースが含まれる場合のエラーを修正"

# ドキュメント更新
git commit -m "docs: READMEにインストール手順を追加"

# リファクタリング
git commit -m "refactor: エラーハンドリングを統一的なパターンに整理"

# テスト追加
git commit -m "test: file-selectorユーティリティのユニットテストを追加"

# 型定義の更新
git commit -m "chore: TypeScriptの型定義を整理"

# 依存関係の更新
git commit -m "chore: 依存パッケージを最新バージョンに更新"
```

## プルリクエスト（PR）作成

### PR作成前のチェックリスト

- [ ] ローカルの自動テスト(フルテスト)が全てパスしていること
- [ ] `npm run lint` で全ファイルのLintエラーがないこと
- [ ] `npm run build` でTypeScriptのコンパイルエラーがないこと

### PR作成コマンド

```bash
# 変更をプッシュ
git push origin <ブランチ名>

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
- [ ] ユニットテスト実行済み (npm run test)
- [ ] 統合テスト実行済み
- [ ] ESLint実行済み (npm run lint)
- [ ] TypeScriptビルド成功 (npm run build)

## スクリーンショット（UI変更がある場合）
[該当する場合は画像を添付]

## レビューポイント
[レビュアーに特に確認してほしい点]
EOF

## セキュリティ上の注意事項

### 絶対に操作してはいけないファイル

以下のファイルは機密情報を含むため、絶対に操作しないでください：

- `.env` ファイル（環境変数）
- `.env.local`、`.env.production` などの環境固有ファイル
- `*.pem`、`*.key` ファイル（証明書、秘密鍵）
- `node_modules/` ディレクトリ（依存関係）

### コミット時の注意

- APIキー、アクセストークンなどの機密情報をハードコーディングしない
- 機密情報が含まれていないか必ず確認してからコミットする
- 誤って機密情報をコミットした場合は、即座に指示者に報告する

### npmパッケージのセキュリティ

```bash
# 依存関係のセキュリティ監査
npm audit

# 脆弱性の自動修正
npm audit fix

# package-lock.jsonは必ずコミットする
```

## トラブルシューティング

### コンフリクトの解決

```bash
# 最新のmainブランチを取得
git fetch origin main

# mainブランチの変更を現在のブランチにマージ
git merge origin/main

# コンフリクトを解決後
git add .
git commit -m "fix: mainブランチとのコンフリクトを解決"
```

## 参考資料

- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow)
