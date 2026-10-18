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
│   ├── quests/[id]/loading.tsx          # クエスト画面の即時ローディング表示（Suspense バウンダリ）
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
- クライアントは `src/lib/schemas.ts` のレスポンススキーマで応答を検証する。保存先・正はDBのまま、取得済みタスクと候補を認証ユーザー単位の短期ローカルストレージキャッシュに保持する。認証前や別ユーザーのキャッシュは表示しない。破損・失効・ストレージ利用不可は通常の取得に戻る。
- キャッシュキーは `trione:quest:v1:<認証ユーザーIDのURLエンコード>`、有効期間は一覧のDB取得から60秒。スキーマとユーザーIDを検証し、再抽選のたびに有効期間を延長しない。復元後はサーバーで候補・進行状態を再確認し、開始直前にも期限と緊急優先を見直す。
- `src/features/task/server.ts` がDBの列を検証・変換し、`src/features/quest/recommend.ts` は時計・乱数を差し替えられる純粋関数として抽選する。
- `20261017061631_quest_selection_transactions.sql` のRPCが提示回数の加算とクエスト開始を扱う。実行権限は `service_role` のみ。既存DBには新しいマイグレーションの適用が必要。
- Supabase用の環境変数はAI用とは独立して検証する。タスク登録・3択だけならGeminiのキーは不要。
- 再抽選は `recommendTasks` を取得済み一覧に適用して即時表示し、`POST /api/quests/candidates` で提示だけを保存する。`20261018032952_cached_quest_candidates.sql` の認証対応RPCが所有者・active状態・期限・進行中・緊急優先を検証する。表示中の候補の提示保存が成功するまでは開始できず、失敗は再取得を案内する。再抽選ごとの候補GET・タスク一覧取得は不要。
- 候補・タスクの変更、開始、別タブとの同期ではキャッシュと取得世代を管理し、古い応答による削除済みデータの復活を防ぐ。ローカルキャッシュを開始可否の正として扱わず、開始はDBトランザクションで再検証する。
- 遷移先のサーバー取得は `src/app/quests/loading.tsx` を境界として待機を表示する。`OperationProgress` は実際に完了した処理件数を示し、処理時間の割合は推測しない。AI生成とDB保存は1回のAPI応答なので1段階として扱い、応答の検証成功前に完了としない。
- `getQuestDetail` は本人のクエストを確認した後、本人のタスク取得とチェックポイント取得を並列化する。問い合わせは3回だが直列待機は2段となる。両方の取得が成功してから詳細を返し、他人のタスクを参照するクエストは従来どおり未検出とする。

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

### チェックポイントとクエスト画面の所有者検証

- 詳細取得・生成・達成更新・完了の API は入力検証より先に Cookie の認証を確認し、未認証は `401 unauthorized` を返す。所有者 ID は認証済みユーザーからのみ取得する。
- サービス層はクエストと元タスクの両方を `user_id` で絞り、他ユーザー・所有者なし・不存在を同じ未検出として扱う。チェックポイント更新は所有関係を検証してから、ID と検証済みクエスト ID の両方で絞る。
- 完了 RPC には必ず認証ユーザー ID を渡す。DB 側もクエストと元タスクの所有者を検証し、内部エラーの詳細は API 応答に含めない。
- 進行・生成・クリア画面の実データは認証後に本人のデータだけを取得する。未認証は `/` へ戻し、他ユーザー・不存在は 404。`demo` は個人データを使用しない公開固定データのままとする。
