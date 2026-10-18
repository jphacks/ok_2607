# API 仕様

- 型の正は `src/lib/schemas.ts`。この文書とずれたらスキーマに合わせて直し、同じ PR で両方更新する
- リクエスト・レスポンスはすべて JSON。日時は ISO 8601（タイムゾーン付き）、ID は UUID
- キー名は camelCase（DB の snake_case は Route Handler 内で変換する）
- Supabase Auth による Google アカウント認証に対応。ログイン中は各ユーザー固有のデータ（タスク・クエスト・経験値）が取得・保存される。タスク編集・削除には認証が必須。

クエスト詳細取得・チェックポイント生成・達成状態更新・クエスト完了にはログインが必要。
未認証は `401 unauthorized`。他ユーザーの対象は、存在しない対象と区別せず `404 not_found` を返す。
認証ユーザーのIDはCookieのセッションからサーバーで取得し、リクエスト本文やクエリからは受け取らない。
認証と所有者を確認する前に、対象データの返却・変更・AI呼び出しを行わない。成功応答のデータ形状は変更しない。

Issue #20 の残るデータ分離対応は、この共通契約の先行PRと、API・サーバー画面の修正PRに分けて進める。

この文書は API の共通コントラクトを定義する。タスク編集・削除の復旧は Issue #48 で管理する。

## エラー形式

```json
{ "error": { "code": "validation_error", "message": "入力が不正です" } }
```

| ステータス | code                                | 用途                                             |
| ---------- | ----------------------------------- | ------------------------------------------------ |
| 400        | `invalid_json` / `validation_error` | 入力が不正                                       |
| 401        | `unauthorized`                      | ログインが必要                                   |
| 404        | `not_found`                         | 対象が無い                                       |
| 409        | `conflict`                          | 状態が合わない（完了済みのクエストを再完了など） |
| 501        | `not_implemented`                   | 未実装（雛形の状態）                             |
| 502        | `ai_error`                          | Gemini の呼び出し失敗・出力の検証失敗            |
| 500        | `internal_error`                    | その他                                           |

## エンドポイント一覧

| メソッド | エンドポイント                          | 用途                           | 担当              |
| -------- | --------------------------------------- | ------------------------------ | ----------------- |
| GET      | `/api/auth/me`                          | ログイン中ユーザー情報取得     | @miyagunimikihiro |
| POST     | `/api/auth/signout`                     | ログアウト                     | @miyagunimikihiro |
| GET      | `/auth/callback`                        | OAuth コールバック             | @miyagunimikihiro |
| GET      | `/api/tasks`                            | タスク一覧                     | @lovemeasure      |
| POST     | `/api/tasks`                            | タスク登録                     | @lovemeasure      |
| PATCH    | `/api/tasks/{id}`                       | タスク編集                     | @lovemeasure      |
| DELETE   | `/api/tasks/{id}`                       | タスク削除                     | @lovemeasure      |
| GET      | `/api/quests/candidates`                | 3択の候補取得                  | @ki-mutaku        |
| POST     | `/api/quests/candidates`                | キャッシュ抽選の提示記録       | @ki-mutaku        |
| POST     | `/api/quests`                           | クエスト開始                   | @ki-mutaku        |
| GET      | `/api/quests/{id}`                      | クエスト詳細（追加）           | @miyagunimikihiro |
| POST     | `/api/quests/{id}/checkpoints/generate` | AI チェックポイント生成        | @miyagunimikihiro |
| PATCH    | `/api/checkpoints/{id}`                 | チェックポイント達成状態の更新 | @miyagunimikihiro |
| POST     | `/api/quests/{id}/complete`             | クエスト完了                   | @miyagunimikihiro |
| GET      | `/api/stats`                            | 経験値などの集計（追加）       | @lovemeasure      |

「追加」はスライドの API 定義に無かったもの。画面の再読み込みと経験値の表示に必要なため加えた。

## 詳細

### GET /api/tasks

クエリ `status`（任意）: `active` / `in_quest` / `done` / `discarded`。省略時は `discarded` 以外。

並び順は `createdAt` 降順、同時刻ならID降順。登録直後も再読み込み後も新しいタスクから表示する。

```json
// 200
{ "tasks": [Task] }
```

### POST /api/tasks

```json
// リクエスト
{ "title": "レポートの参考文献を3本探す", "dueAt": "2026-10-20T23:59:00+09:00" }
// 201
{ "task": Task }
```

`dueAt` は省略・`null` 可。

通常の登録画面の入力はタスク名と任意の期限だけ。画面で日付だけを指定した場合は、端末のタイムゾーンで当日の終わりをISO 8601へ変換する。

デモ用データの登録では、任意の `skippedCount`（reject回数）を指定できる。0〜2147483647の整数に限り、省略時は0。負数・小数・範囲外・`null`・文字列は `400 validation_error`。保存した値はレスポンスの `task.skippedCount` と以降の抽選に反映する。既存タスクのreject回数を編集するAPIではない。

### PATCH /api/tasks/{id}

```json
// リクエスト（すべて任意）
{ "title": "...", "dueAt": null, "status": "discarded" }
// 200
{ "task": Task }
```

`status: "discarded"` が「手放す」操作。

更新項目は1つ以上必須。空の更新（未知のキーだけの入力を含む）は `400 validation_error`。
成功応答の型は `UpdateTaskResponse`。`dueAt: null` は期限の解除を表す。
編集にはログインが必要。未認証は `401 unauthorized`、存在しないタスク・他ユーザーのタスクは区別せず `404 not_found` を返す。

### DELETE /api/tasks/{id}

`204`（本文なし）。

削除にはログインが必要。未認証は `401 unauthorized`、存在しないタスク・他ユーザーのタスクは区別せず `404 not_found` を返す。
物理削除により関連クエスト・チェックポイントも削除される。完了クエストの削除に伴い経験値集計も変化する。

### GET /api/quests/candidates

```json
// 200（新しいクエストを選べる場合）
{ "isUrgent": false, "candidates": [Task, Task, Task], "inProgressQuest": null }
// 200（進行中のクエストがある場合）
{ "isUrgent": false, "candidates": [], "inProgressQuest": Quest }
```

- `isUrgent: true` のとき `candidates` は締切が近い 1 件だけ
- `active` かつ（期限なし、または期限が現在時刻以降）のタスクだけが候補。対象が3件未満ならその件数だけ返す（0件なら空配列）
- 提示したタスクの `shownCount` を増やす
- 期限切れ（期限が現在時刻より前）のタスクは通常・緊急とも候補から除外する。期限が現在時刻ちょうどから24時間後までなら、最も早い1件を緊急候補とする
- 通常は `1 / (skippedCount + 1)` を残り候補の総和で正規化した確率で、最大3件を重複なし抽選する。1件選ぶたびに残り候補で再計算する
- 提示回数はDB内で原子的に加算する。抽選中に候補の状態が変わった場合は `409 conflict`
- 抽選前に進行中クエストを確認する。存在する場合は `inProgressQuest` を返し、`candidates` は空、`isUrgent` は `false`。抽選・`record_quest_candidates`・提示回数加算は行わない
- 画面は進行中の案内と「ホームで確認する」を表示し、新規開始・再抽選ボタンは表示しない

### POST /api/quests/candidates

読み込み済みタスクから端末で抽選した候補の提示を記録する。GETと異なりタスク一覧の再取得・再抽選は行わない。

- 入力: `{ "shownTaskIds": ["uuid"] }`。重複なしの1〜3件。型は `RecordQuestCandidatesRequest`。
- 成功: `200 { "tasks": [Task] }`。提示回数加算後のタスク。型は `RecordQuestCandidatesResponse`。
- 認証必須。本人のactiveな未期限切れタスクだけを対象とし、進行中クエストがある場合や緊急候補と矛盾する場合は `409 conflict`。
- DBの `record_quest_candidates(uuid[], uuid)` で検証と提示回数更新を原子的に行う。実行権限はservice_roleのみ。
- 画面はローカル抽選を即時表示できるが、提示の保存成功までは開始できない。失敗を完了扱いせず、再取得を案内する。

### POST /api/quests

```json
// リクエスト
{ "selectedTaskId": "uuid", "shownTaskIds": ["uuid", "uuid", "uuid"] }
// 201
{ "quest": Quest }
```

- 選ばれたタスクの `status` を `in_quest` にする。選択したタスクの `skippedCount` は変更しない
- 提示された未選択タスクのみ `skippedCount`（reject回数）を1増やす
- `selection_logs` に記録する
- 旧 `weight` 項目と加算・減衰は廃止。通常抽選の確率は `skippedCount` のみで決める
- `shownTaskIds` は重複不可で、`selectedTaskId` を含める。不正な入力は `400 validation_error`
- 全件が `active` であることをロック後に検証する。進行中クエストがある場合や状態変更との競合は `409 conflict`
- タスク更新・クエスト作成・ログ保存は `start_quest` RPC の1トランザクション。同時開始も直列化する

### GET /api/quests/{id}

```json
// 200
{ "quest": Quest, "task": Task, "checkpoints": [Checkpoint] }
```

`checkpoints` は `parentId` が null の全体像のチェックポイントと、その子をすべて含む平らな配列。並び順は `position`。

### POST /api/quests/{id}/checkpoints/generate

リクエスト本文なし。既存のチェックポイントがある場合は DB トランザクション（RPC `replace_quest_checkpoints`）により原子的に作り直す（再生成途中での失敗時に元データ損失を防ぐ）。
AI 生成結果は全体像（1〜5 件）および各アクションステップ（1〜5 件）の 2 段階で構成される。

- 400: `validation_error`（id が不正な UUID）
- 404: `not_found`（指定されたクエストが見つからない）
- 409: `conflict`（クエストが進行中 `in_progress` ではない）
- 502: `ai_error`（Gemini API 呼び出し失敗、またはスキーマ検証失敗）
- 500: `internal_error`（DB エラー等）

```json
// 200
{ "checkpoints": [Checkpoint] }
```

### PATCH /api/checkpoints/{id}

```json
// リクエスト
{ "isDone": true }
// 200
{ "checkpoint": Checkpoint }
```

### POST /api/quests/{id}/complete

リクエスト本文なし。ストアドプロシージャ `complete_quest` により、クエストを `completed`、元タスクを `done` に原子的に更新し、経験値を付与して合計経験値を集計する。
経験値の計算ロジック:

- 基本経験値: 20 XP
- 達成済みチェックポイント（`isDone: true`）1 件につき: +10 XP
- 緊急クエスト（`isUrgent: true`）の場合: 1.5 倍（四捨五入）

エラーレスポンス:

- 400: `validation_error`（id が不正な UUID）
- 404: `not_found`（指定されたクエストが見つからない）
- 409: `conflict`（クエストが進行中 `in_progress` ではない、またはすでに完了・中止済み）
- 500: `internal_error`（DB エラー等）

```json
// 200
{ "quest": Quest, "xpGained": 30, "totalXp": 120 }
```

### GET /api/stats

```json
// 200
{ "totalXp": 120, "completedQuests": 4 }
```

`completed` のクエストだけから `xpEarned` と件数を集計する。未完了の経験値は含めない。

## 型

`src/lib/schemas.ts` の `Task` / `Quest` / `Checkpoint` を参照。
