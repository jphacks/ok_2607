# AGENTS.md

このリポジトリで作業する AI エージェント（Claude Code、Codex、Cursor など）向けの指示。人間のメンバーも同じルールに従う。

## プロジェクト

JPHACKS 2026 のチーム開発。3択から 1 つ選ぶだけで「やること」と「やらないこと」が決まり、選んだタスクは AI がチェックポイントに分解してくれるタスク管理 Web アプリ。

- 仕様: `docs/product.md`
- API: `docs/api.md`（型の正は `src/lib/schemas.ts`）
- 構成・ディレクトリ・データモデル: `docs/architecture.md`
- 担当範囲: `docs/team.md`
- 環境構築: `docs/setup.md`
- 開発の約束: `docs/working-agreement.md`

作業を始める前に、触る機能に関係するドキュメントを読むこと。

## コマンド

```sh
npm ci                 # 依存パッケージのインストール
npm run dev            # 開発サーバー (http://localhost:3000)
npm run check          # lint + format + 型チェック + テスト（作業の最後に必ず実行）
npm run test           # テストだけ
npm run lint:fix       # lint の自動修正
npm run format         # Prettier で整形
npm run db:new <名前>  # マイグレーションを新規作成
npm run db:reset       # ローカル DB の作り直し
```

## 担当範囲

| 担当               | 範囲                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| @lovemeasure（PM） | 共通部分（`src/lib/`、`supabase/`、`docs/`、設定ファイル）、タスク登録、経験値の集計                          |
| @ki-mutaku         | タイトル画面、3択タスク選択、レコメンドアルゴリズム（`src/features/title/`、`src/features/quest/`）           |
| @miyagunimikihiro  | AI チェックポイント生成（`src/features/checkpoint/`、`src/app/api/quests/[id]/`、`src/app/api/checkpoints/`） |

- 依頼者の担当範囲の中で作業する。他の人の担当範囲を変更する必要があれば、変更する前に依頼者に確認する
- 共通部分（`src/lib/`、`supabase/migrations/`、`docs/api.md`）の変更は、PR の説明に影響範囲を書く

## 必ず守るルール

### 作業の進め方

- 1 PR で必ず: ユニットテストを書く、`npm run check` を通す、ドキュメントを更新する
- 作業の最後に `npm run check` を実行し、結果をそのまま報告する。失敗したまま「完了」と言わない
- `main` に直接コミット・push しない。ブランチ名は `<種類>/<内容>`、コミットは `<種類>: <内容>`（種類: `feat` / `fix` / `docs` / `test` / `refactor` / `chore`）
- `git commit --no-verify` で pre-commit フックを飛ばさない
- MVP の範囲（`docs/product.md` のユーザーストーリー）を超える機能は勝手に作らない。ログイン機能は作らない

### API とデータ

- API を追加・変更するときは `src/lib/schemas.ts` と `docs/api.md` を同じ変更で更新する
- Route Handler では入力を必ず `parseJson`（`src/lib/api-response.ts`）と zod スキーマで検証し、エラーは `apiError` で `{ error: { code, message } }` の形で返す
- API のキーは camelCase、DB の列は snake_case。変換はサーバー側で行う
- DB スキーマは `npm run db:new <名前>` で作った新しいマイグレーションファイルで変える。**適用済みのマイグレーションファイルは編集しない**
- 新しいテーブルを作ったら RLS を有効にする（`alter table ... enable row level security;`）

### セキュリティ

- `.env.local` やキーをコミット・ログ出力しない。キーを推測・生成しない。必要なら人間に頼む
- Supabase と Gemini はサーバー（Route Handler）からだけ呼ぶ。クライアントコンポーネントから `src/lib/env.ts`、`src/lib/supabase/server.ts`、`src/lib/gemini.ts` を import しない
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

- 出力は JSON スキーマ（`responseSchema`）を指定して構造化し、保存する前に zod で検証する。検証に失敗したら `502 ai_error` を返す
- モデル名はハードコードせず `geminiModel()`（環境変数 `GEMINI_MODEL`）を使う
- テストでは Gemini を呼ばない。呼び出し部分を関数の引数で差し替えられるようにしてモックする
