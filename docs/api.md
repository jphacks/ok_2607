# API 仕様

- 型の正は `src/lib/schemas.ts`。この文書とずれたらスキーマに合わせて直し、同じ PR で両方更新する
- レスポンスは原則 JSON（DELETE 成功時は本文なし）。日時は ISO 8601（タイムゾーン付き）、ID は UUID
- キー名は camelCase（DB の snake_case は Route Handler 内で変換する）
- ログインは無い（単一ユーザー前提）

タスク一覧・登録・編集・削除、3択候補、クエスト開始、経験値集計を提供する。チェックポイント関連APIの詳細は各エンドポイントの仕様を参照。

## エラー形式

```json
{ "error": { "code": "validation_error", "message": "入力が不正です" } }
```

| ステータス | code                                | 用途                                             |
| ---------- | ----------------------------------- | ------------------------------------------------ |
| 400        | `invalid_json` / `validation_error` | 入力が不正                                       |
| 404        | `not_found`                         | 対象が無い                                       |
| 409        | `conflict`                          | 状態が合わない（完了済みのクエストを再完了など） |
| 501        | `not_implemented`                   | 未実装（雛形の状態）                             |
| 502        | `ai_error`                          | Gemini の呼び出し失敗・出力の検証失敗            |
| 500        | `internal_error`                    | その他                                           |

## エンドポイント一覧

| メソッド | エンドポイント                          | 用途                           | 担当              |
| -------- | --------------------------------------- | ------------------------------ | ----------------- |
| GET      | `/api/tasks`                            | タスク一覧                     | @lovemeasure      |
| POST     | `/api/tasks`                            | タスク登録                     | @lovemeasure      |
| PATCH    | `/api/tasks/{id}`                       | タスク編集                     | @lovemeasure      |
| DELETE   | `/api/tasks/{id}`                       | タスク削除                     | @lovemeasure      |
| GET      | `/api/quests/candidates`                | 3択の候補取得                  | @ki-mutaku        |
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

入力はタスク名と任意の期限だけ。画面で日付だけを指定した場合は、端末のタイムゾーンで当日の終わりをISO 8601へ変換する。

### PATCH /api/tasks/{id}

```json
// リクエスト（すべて任意）
{ "title": "...", "dueAt": null, "status": "discarded" }
// 200
{ "task": Task }
```

`status: "discarded"` が「手放す」操作。

- `title`・`dueAt`・`status` のうち少なくとも1項目を指定する。空の更新、不正なUUID・タイトル・日時・状態は `400 validation_error`
- 指定を省略した項目は維持する。`dueAt: null` は期限の解除。タスクリストの編集画面ではタスク名と期限だけを編集する
- タイトルだけを編集した場合、元の期限の時刻も維持する。日付を変更した場合は端末のタイムゾーンで当日の23:59:59にする
- 対象が存在しない場合は `404 not_found`。更新結果はDBへ保存し、`UpdateTaskResponse` で返す

### DELETE /api/tasks/{id}

`204`（本文なし）。

存在しないタスクは `404 not_found`、不正なUUIDは `400 validation_error`。タスクリストの3点メニューから確認ダイアログを経て完全削除する。既存の外部キー制約に従い、関連するクエストとチェックポイントも削除する。

### GET /api/quests/candidates

```json
// 200（新しいクエストを選べる場合）
{ "isUrgent": false, "candidates": [Task, Task, Task], "inProgressQuest": null }
// 200（進行中のクエストがある場合）
{ "isUrgent": false, "candidates": [], "inProgressQuest": Quest }
```

- 期限ありの対象タスクがあれば、最も期限が近い1件を先頭へ必ず入れる（重みが0でも対象）。その期限が24時間以内なら `isUrgent: true`。緊急でも1択にはせず、残りの対象タスクから最大3件まで補充する
- `active` かつ（期限なし、または期限が現在時刻以降）のタスクだけが候補。対象が3件未満ならその件数だけ返す（0件なら空配列）
- 提示したタスクの `shownCount` を増やす
- 期限切れ（期限が現在時刻より前）のタスクは候補から除外する。現在時刻ちょうどの期限は対象
- 先頭の期限ありタスク以外は重みに比例した重複なし抽選。ほかの期限ありタスクも抽選対象。期限ありの対象タスクがなければ全枠を抽選する。残りの重みがすべて0なら等確率
- 提示回数はDB内で原子的に加算する。抽選中に候補の状態が変わった場合は `409 conflict`
- 抽選前に進行中クエストを確認する。存在する場合は `inProgressQuest` を返し、`candidates` は空、`isUrgent` は `false`。抽選・`record_quest_candidates`・提示回数加算は行わない
- 画面は進行中の案内と「ホームで確認する」を表示し、新規開始・再抽選ボタンは表示しない

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
- 旧重みの加算・減衰は停止。抽選方式と `weight` 項目の廃止は #36 の段階的な移行で行う
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
