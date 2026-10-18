# アーキテクチャ

## 技術スタック

| 層             | 技術                                                             |
| -------------- | ---------------------------------------------------------------- |
| フロントエンド | Next.js 15（App Router）+ React 19 + TypeScript + Tailwind CSS 4 |
| バックエンド   | Next.js Route Handlers（`src/app/api/`）                         |
| DB             | Supabase（PostgreSQL）                                           |
| 認証           | Supabase Auth（Google OAuth）                                    |
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

- ブラウザの Supabase 利用は既存の Auth / OAuth 操作だけとし、DB 更新と Gemini 呼び出しは必ず Route Handler を経由する
- DB 更新は service_role キーでサーバーからだけ行う。4テーブルの INSERT / UPDATE / DELETE は PUBLIC・anon・authenticated から取り消し、本人名義のクエストに他人のタスクを結び付ける直接操作を防ぐ。全テーブルの RLS は維持し、authenticated の SELECT は既存ポリシーで本人のデータに限定する。anon にはデータ参照を許可しない
- サーバー専用のモジュール（`src/lib/env.ts`、`src/lib/supabase/server.ts`、`src/lib/gemini.ts`）は `import "server-only"` 付き。クライアントコンポーネントから import するとビルドエラーになる

## ディレクトリ

```
src/
├── app/                  # ルーティング（ページと Route Handlers）。処理は薄く保つ
│   ├── page.tsx          # 3択を初期表示する3タブ画面
│   ├── quests/[id]/checkpoints/page.tsx # AI チェックポイント生成・確認画面（04）
│   ├── quests/[id]/page.tsx             # クエスト進行画面（05）
│   ├── quests/[id]/clear/page.tsx       # クエストクリア画面（06）
│   └── api/              # Route Handlers（docs/api.md）
├── components/ui/        # 共通 UI 部品（docs/design.md） @ki-mutaku
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
- 2 つ以上の画面で使う見た目の部品は `src/components/ui/` に置く。色は `src/app/tokens.css` のトークンを使う（`docs/design.md`）

### 3画面の構成

- `src/features/quest/quest-app.tsx` がクエストを初期表示し、3タブの状態・API取得・候補キャッシュを管理する。
- タスクリストと作成モーダルは `src/features/task/task-list.tsx`、ホームは `src/features/title/home-screen.tsx`、候補選択は `src/features/quest/quest-choices.tsx`。
- クライアントは `src/lib/schemas.ts` のレスポンススキーマで応答を検証する。タスクはDBに保存し、ブラウザ内のダミーデータやローカルストレージには置き換えない。
- `src/features/task/server.ts` がDBの列を検証・変換し、`src/features/quest/recommend.ts` は時計・乱数を差し替えられる純粋関数として抽選する。
- `20261017061631_quest_selection_transactions.sql` のRPCが提示回数の加算とクエスト開始を扱う。実行権限は `service_role` のみ。既存DBには新しいマイグレーションの適用が必要。
- Supabase用の環境変数はAI用とは独立して検証する。タスク登録・3択だけならGeminiのキーは不要。

## データモデル

定義は `supabase/migrations/`（初期スキーマおよび RPC `replace_quest_checkpoints`）。

```
tasks 1 ──── * quests 1 ──── * checkpoints（parent_id で 2 階層）
  └───── selection_logs（3択で何を見せて何を選んだか）
```

| テーブル         | 主な列                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tasks`          | `user_id`（auth.users参照）、`title`、`due_at`、`status`（`active` / `in_quest` / `done` / `discarded`）、`shown_count`、`skipped_count`（reject回数） |
| `quests`         | `user_id`（auth.users参照）、`task_id`、`status`（`in_progress` / `completed` / `abandoned`）、`is_urgent`、`xp_earned`                                |
| `selection_logs` | `user_id`（auth.users参照）、`shown_task_ids`、`selected_task_id`、`quest_id`                                                                          |
| `checkpoints`    | `quest_id`、`parent_id`（null なら全体像）、`title`、`description`、`position`、`is_done`                                                              |

DB は snake_case、API と TypeScript は camelCase。変換は Route Handler（またはその下の関数）で行う。

レコメンドは `1 / (skipped_count + 1)` の正規化確率で行い、旧 `weight` カラムは新規マイグレーションで削除。既存DBには全マイグレーションを順に適用する。
`20261018024935_fix_authenticated_start_quest_without_weight.sql` で認証対応の `start_quest(uuid, uuid[], uuid)` も旧 `weight` 列を更新しないよう修正する。旧2引数オーバーロードは削除し、2引数での呼び出しは `p_user_id` の既定値 `null` を使う。続く `20261018032252_enforce_quest_ownership.sql` で、認証ユーザーは本人のタスクだけ、`p_user_id = null` の旧互換呼び出しは所有者未設定のタスクだけを扱うようにする。実行権限は引き続き `service_role` のみ。

クエスト開始のDB回帰テストは、分離したローカルDBに対し `psql -v ON_ERROR_STOP=1 -f supabase/tests/start_quest.sql` で実行する（テスト内の全件削除はロールバックする。リモートDBには実行しない）。全マイグレーション適用後に実行し、2引数互換呼び出し・認証ユーザーの3引数呼び出し・reject回数・不正入力と状態競合時のロールバック・RPC実行権限を検証する。

`20261018032252_enforce_quest_ownership.sql` は既存の Auth / OAuth を変更せず、データ更新の境界を強化する。旧 `complete_quest(uuid, integer)` は削除し、3引数版では `p_user_id` を必須とする。NULL、他人、所有者未設定のクエスト・タスクは完了できず、クエストと元タスクの所有者が両方一致した場合だけ更新する。合計経験値にも同じユーザーの完了クエストだけを含める。既存の不正な関連付けがあっても、他人のタスクの完了には利用できない。

所有者境界のDB回帰テストは、分離したローカルDBに全マイグレーションを適用してから `psql -v ON_ERROR_STOP=1 -f supabase/tests/quest_ownership.sql` で実行する。本人名義と他人タスクの関連付け、所有者未設定データ、通常の本人完了・経験値集計、直接DMLとRPCの権限を検証する。既存の `supabase/tests/start_quest.sql` も続けて実行する。テストはトランザクションをロールバックするが、全件削除を含むためリモートDBには実行しない。

## 環境変数

`.env.example` を参照。Supabase Auth の OAuth 連携のために `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY`（公開用 anon key）を使用する。機密情報（`SUPABASE_SERVICE_ROLE_KEY` や `GEMINI_API_KEY`）はサーバー専用。Vercel にも同じ名前で設定する。
