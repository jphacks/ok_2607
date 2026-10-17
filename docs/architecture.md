# アーキテクチャ

## 技術スタック

| 層             | 技術                                                             |
| -------------- | ---------------------------------------------------------------- |
| フロントエンド | Next.js 15（App Router）+ React 19 + TypeScript + Tailwind CSS 4 |
| バックエンド   | Next.js Route Handlers（`src/app/api/`）                         |
| DB             | Supabase（PostgreSQL）                                           |
| AI             | Gemini API（`@google/genai`）                                    |
| 入力検証       | zod                                                              |
| テスト         | Vitest + Testing Library                                         |
| 静的解析       | ESLint + Prettier（husky + lint-staged で pre-commit 時に実行）  |
| デプロイ       | Vercel                                                           |

## 構成

```
ブラウザ（React） ──fetch──▶ Route Handlers ──▶ Supabase (PostgreSQL)
                                       └──▶ Gemini API
```

- ブラウザから Supabase や Gemini を**直接呼ばない**。必ず Route Handler を経由する
- DB には service_role キーでサーバーからだけアクセスする。全テーブルで RLS を有効にし、ポリシーを作らないことで anon キーからのアクセスを拒否している
- サーバー専用のモジュール（`src/lib/env.ts`、`src/lib/supabase/server.ts`、`src/lib/gemini.ts`）は `import "server-only"` 付き。クライアントコンポーネントから import するとビルドエラーになる

## ディレクトリ

```
src/
├── app/                  # ルーティング（ページと Route Handlers）。処理は薄く保つ
│   ├── page.tsx          # 3択を初期表示する3タブ画面
│   └── api/              # Route Handlers（docs/api.md）
├── features/             # 機能ごとのコンポーネント・ロジック・テスト
│   ├── title/            # ホーム画面              @ki-mutaku
│   ├── quest/            # 3択・レコメンド         @ki-mutaku
│   ├── checkpoint/       # チェックポイント        @miyagunimikihiro
│   └── task/             # タスク登録              @lovemeasure
└── lib/                  # 共通（スキーマ、API ヘルパー、DB・AI クライアント）
supabase/
├── migrations/           # DB スキーマの変更履歴
└── seed.sql              # ローカル用サンプルデータ
docs/                     # 開発ドキュメント
```

### 置き場所のルール

- ページは `src/app/<パス>/page.tsx` に置き、中身は `src/features/<機能>/` のコンポーネントを呼ぶだけにする
- Route Handler は入力検証（`parseJson`）とレスポンス整形だけを書き、ロジックは `src/features/<機能>/` の関数に切り出す。こうするとロジックを DB なしでユニットテストできる
- 例: レコメンドの抽選は `src/features/quest/recommend.ts` に純粋関数として書き、`recommend.test.ts` でテストする
- テストは対象と同じディレクトリに `*.test.ts(x)` で置く
- 2 つ以上の機能で使うものだけ `src/lib/` に置く

### 3画面の構成

- `src/features/quest/quest-app.tsx` がクエストを初期表示し、3タブの状態・API取得・候補キャッシュを管理する。
- タスクリストと作成モーダルは `src/features/task/task-list.tsx`、ホームは `src/features/title/home-screen.tsx`、候補選択は `src/features/quest/quest-choices.tsx`。
- クライアントは `src/lib/schemas.ts` のレスポンススキーマで応答を検証する。タスクはDBに保存し、ブラウザ内のダミーデータやローカルストレージには置き換えない。
- `src/features/task/server.ts` がDBの列を検証・変換し、`src/features/quest/recommend.ts` は時計・乱数を差し替えられる純粋関数として抽選する。
- `20261017061631_quest_selection_transactions.sql` のRPCが提示回数の加算とクエスト開始を扱う。実行権限は `service_role` のみ。既存DBには新しいマイグレーションの適用が必要。
- Supabase用の環境変数はAI用とは独立して検証する。タスク登録・3択だけならGeminiのキーは不要。

## データモデル

定義は `supabase/migrations/20261017000000_init.sql`。

```
tasks 1 ──── * quests 1 ──── * checkpoints（parent_id で 2 階層）
  └───── selection_logs（3択で何を見せて何を選んだか）
```

| テーブル         | 主な列                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `tasks`          | `title`、`due_at`、`weight`（レコメンド用）、`status`（`active` / `in_quest` / `done` / `discarded`）、`shown_count`、`skipped_count` |
| `quests`         | `task_id`、`status`（`in_progress` / `completed` / `abandoned`）、`is_urgent`、`xp_earned`                                            |
| `selection_logs` | `shown_task_ids`、`selected_task_id`、`quest_id`                                                                                      |
| `checkpoints`    | `quest_id`、`parent_id`（null なら全体像）、`title`、`description`、`position`、`is_done`                                             |

DB は snake_case、API と TypeScript は camelCase。変換は Route Handler（またはその下の関数）で行う。

## 環境変数

`.env.example` を参照。すべてサーバー専用で、`NEXT_PUBLIC_` 付きの変数は今のところ無い。Vercel にも同じ名前で設定する。
