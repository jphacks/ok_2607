# AGENTS.md

このリポジトリで作業する AI エージェント（Claude Code、Codex、Antigravity、Cursor など）向けの指示。人間のメンバーも同じルールに従う。

メンバーはそれぞれ違う AI ツールを使っている。ルールはツールに依存しない形でこのファイルに書き、ツール固有の設定ファイルはこのファイルを補うだけにする（「AI ツールごとの設定」）。

## プロジェクト

JPHACKS 2026 のチーム開発。3択から 1 つ選ぶだけで「やること」と「やらないこと」が決まり、選んだタスクは AI がチェックポイントに分解してくれるタスク管理 Web アプリ。

- 仕様: `docs/product.md`
- API: `docs/api.md`（型の正は `src/lib/schemas.ts`）
- 構成・ディレクトリ・データモデル: `docs/architecture.md`
- 担当範囲: `docs/team.md`
- 環境構築: `docs/setup.md`
- 開発の約束: `docs/working-agreement.md`
- AI レビュー: `docs/ai-review.md`
- デザインと共通 UI: `docs/design.md`（画面を触るときは必ず読む）

作業を始める前に、触る機能に関係するドキュメントを読むこと。

## コマンド

```sh
npm ci                 # 依存パッケージのインストール
npm run dev            # 開発サーバー (http://localhost:3000)
npm run check          # lint + format + 型チェック + テスト（作業の最後に必ず実行）
npm run build          # 本番ビルド（PR 前に実行。CI でも実行される）
npm run test           # テストだけ
npm run lint:fix       # lint の自動修正
npm run format         # Prettier で整形
npm run db:new <名前>  # マイグレーションを新規作成
npm run db:reset       # ローカル DB の作り直し
```

## Issue から着手する

- 作業前に、同じ目的の既存 Issue があるか確認して再利用する。無ければ AI が `.github/ISSUE_TEMPLATE/task.md` に沿って作成し、`task` ラベルを付ける
- Issue には作業内容と Given-When-Then の受け入れ基準を書き、Assignee を依頼者にする。担当範囲は `docs/team.md` に従う
- 作業中に見つけた範囲外の改善・不具合は別 Issue に切り出し、元の作業に混ぜない
- Issue の受け入れ基準をすべて満たす最後の PR の本文には `Closes #番号` を書く。段階的な PR や共通部分だけの先行 PR は `Refs #番号` で関連付け、Issue を閉じない
- コード・ドキュメントの変更を伴う Issue は、最後の PR がデフォルトブランチ（`main`）へマージされることで自動的に閉じる。PR 作成時点や部分実装の段階で手動クローズしない
- リポジトリの変更を伴わない調査・設定変更などの運用 Issue は、確認した証拠・結果・クローズ理由を Issue に記録してから手動で閉じてよい

## PR からマージまで

人の承認は不要。**CI と AI レビューが通れば、AI がそのままマージしてよい**。

1. `npm run check` と `npm run build` を通してコミットする（CI はこの両方を実行する）
2. 実装した会話とは別のコンテキストで AI レビューを受ける（`docs/ai-review.md`）
   - Claude Code: `code-reviewer` サブエージェントを呼び出す。`/ship` でここから先をまとめて実行できる
   - その他のツール: サブエージェントか別プロセスで、`docs/ai-review.md` と差分を渡してレビューさせる
   - 人にセッションの切り替えを頼まない
3. FAIL ならブロッカーを直して再レビュー。3 回で PASS にならなければ止めて人に判断を求める
4. PR を作り、本文の「関連 Issue」欄に `Closes #番号`（部分実装は `Refs #番号`）を、「AI レビュー」欄に最後のレビュー結果を貼る
5. `gh pr merge <番号> --auto --squash` で自動マージを予約する（CI が通ると GitHub がマージし、ブランチも自動で削除される）。予約後に `main` が進んだら `gh pr update-branch <番号>` で取り込む
6. PASS の後にコードを変えたら（CI の修正を含む）、必ず AI レビューを受け直し、PR 本文の結果を更新する

「PR にして」「マージまでやって」と頼まれたら、この流れを最後まで進める。

## 担当範囲

担当者とディレクトリの対応は `docs/team.md` が正（ここには書かない）。作業前に、依頼者の担当範囲を確認すること。

- 依頼者の担当範囲の中で作業する。他の人の担当範囲を変更する必要があれば、変更する前に依頼者に確認する
- 共通部分（`src/lib/`、`supabase/migrations/`、`docs/api.md`）の変更は、PR の説明に影響範囲を書く

## 共通ファイルと PR の大きさ

複数人が同時に触るファイルを機能の PR に混ぜると、コンフリクトと担当範囲の侵食が起きる。

**共通ファイル**: `src/lib/`（特に `schemas.ts`）、`docs/api.md`、`supabase/migrations/`、`src/app/layout.tsx`、`src/app/globals.css`、`src/app/tokens.css`、`src/components/ui/`、`package.json`

- 共通ファイルを変える必要が出たら、機能の実装を進める前に、その変更だけの小さな PR を先に出してマージする。機能の PR はその後で作る
- 1 PR は 1 つの機能、かつ依頼者の担当範囲だけにする
- 次のどれかに当てはまったら、作業を止めて依頼者に相談する（勝手に進めない）
  - 変更するファイルが 15 を超えそう
  - 他の人の担当範囲のファイルを変えたくなった
  - 共通ファイルを機能の PR の中で変えたくなった
- 作業は必ず最新の `origin/main` から切ったブランチで始める（`git fetch origin && git switch -c <ブランチ> origin/main`）。手元の `main` は古いことがあるので使わない

## 必ず守るルール

### 作業の進め方

- 1 PR で必ず: ユニットテストを書く、`npm run check` を通す、ドキュメントを更新する
- 作業の最後に `npm run check` を実行し、結果をそのまま報告する。失敗したまま「完了」と言わない
- `main` に直接コミット・push しない。ブランチ名は `<種類>/<内容>`、コミットは `<種類>: <内容>`（種類: `feat` / `fix` / `docs` / `test` / `refactor` / `chore`）
- `git commit --no-verify` で pre-commit フックを飛ばさない
- MVP の範囲（`docs/product.md` のユーザーストーリー）を超える機能は勝手に作らない。Google OAuthは既存実装（#20 / #47）として維持し、認証方式の追加や変更はPMと合意してから行う

### 画面と UI

- 画面を作る・直す前に `docs/design.md` を読む
- 色は `src/app/tokens.css` のトークン（`bg-panel`、`text-muted` など）を使い、16 進数を直接書かない
- ボタン・パネル・入力欄などの汎用部品は `src/components/ui/` のものを使う。無ければ `src/features/` の中に作らず、共通ファイルとして先に追加する（共通 UI の担当は `docs/team.md` 参照）

### API とデータ

- API を追加・変更するときは `src/lib/schemas.ts` と `docs/api.md` を同じ変更で更新する
- Route Handler では入力を必ず `parseJson`（`src/lib/api-response.ts`）と zod スキーマで検証し、エラーは `apiError` で `{ error: { code, message } }` の形で返す
- API のキーは camelCase、DB の列は snake_case。変換はサーバー側で行う
- DB スキーマは `npm run db:new <名前>` で作った新しいマイグレーションファイルで変える。**適用済みのマイグレーションファイルは編集しない**
- 新しいテーブルを作ったら RLS を有効にする（`alter table ... enable row level security;`）
- DB 関数（RPC）は `security definer` にしない（RLS を迂回するため）。`set search_path = ''` を付け、実行権限は service_role だけに与える（既定で anon からは実行できない設定にしてある。anon に `grant` しない）

### セキュリティ

- `.env.local` やキーをコミット・ログ出力しない。キーを推測・生成しない。必要なら人間に頼む
- DB操作とGemini呼び出しはサーバー（Route Handler）からだけ行う。Supabase Authの公開クライアントによるGoogle OAuth・ログアウトは既存の例外とし、service_roleキーは公開しない。クライアントコンポーネントから `src/lib/env.ts`、`src/lib/supabase/server.ts`、`src/lib/gemini.ts` を import しない
- `NEXT_PUBLIC_` 付きの環境変数に秘密の値を入れない
- リモートの Supabase に対する `supabase db push`、`supabase db reset --linked` などの破壊的なコマンドは実行しない

### コード

- TypeScript strict。`any` と `@ts-ignore` は使わない（どうしても必要なら理由をコメントに書く）
- Next.js 15 の App Router を使う。Route Handler の動的パラメータは `{ params }: { params: Promise<{ id: string }> }` で受け取り `await` する
- コンポーネントはデフォルトでサーバーコンポーネント。状態やイベントが必要なときだけ `"use client"` を付ける
- ロジックは `src/features/<機能>/` に純粋関数として切り出し、Route Handler とページは薄く保つ。テストは対象の隣に `*.test.ts(x)` で置く
- import はエイリアス `@/` を使う（`@/lib/schemas` など）
- スタイルは Tailwind CSS のユーティリティクラスで書く
- 新しい依存パッケージを追加するときは、理由を PR の説明に書く
- コメント・ドキュメント・UI の文言は日本語で書く

### Gemini（AI チェックポイント）

- 出力は JSON スキーマ（`responseSchema`）を指定して構造化し、保存する前に zod で検証する。生成・検証に失敗した場合は検証済みの定型プランを保存し、`isFallback: true` として通知する（#17 / #19）。無検証のAI出力は保存しない
- モデル名はハードコードせず `geminiModel()`（環境変数 `GEMINI_MODEL`）を使う
- テストでは Gemini を呼ばない。呼び出し部分を関数の引数で差し替えられるようにしてモックする

## AI ツールごとの設定

ルールの正はこのファイル。各ツールの設定は、ここにある禁止事項のうち、よくある書き方をツール側でも止めるための補助（コマンドの先頭一致でしか判定できない）。新しいツールを使い始めたら、このファイルを読み込む設定と `docs/setup.md` の「AI ツールの設定」を確認する。

| ツール      | このファイルの読み込み                                     | リポジトリにある設定                                                                     |
| ----------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Claude Code | `CLAUDE.md` から `@AGENTS.md` で読み込む                   | `.claude/settings.json`（許可・禁止コマンド）、`/ship`、`code-reviewer` サブエージェント |
| Codex       | `AGENTS.md` を自動で読む                                   | `.codex/rules/project.rules`（禁止コマンド。プロジェクトを trusted にすると有効）        |
| Antigravity | `AGENTS.md` を自動で読む（2026 年 3 月以降の版）           | なし。ターミナルの Deny list は各自の設定で行う（`docs/setup.md`）                       |
| その他      | 読まないツールでは、最初に「`AGENTS.md` を読んで」と伝える | なし                                                                                     |

- ツール固有の設定ファイル（`.claude/`、`.codex/`、`.agents/` など）にルールを書き足さない。ルールはこのファイルに書く
- `GEMINI.md` は作らない（Antigravity では `AGENTS.md` より優先され、ルールが分裂するため）
- 個人の設定（`.claude/settings.local.json` など）はコミットしない
