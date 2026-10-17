# API 仕様

- 型の正は `src/lib/schemas.ts`。この文書とずれたらスキーマに合わせて直し、同じ PR で両方更新する
- リクエスト・レスポンスはすべて JSON。日時は ISO 8601（タイムゾーン付き）、ID は UUID
- キー名は camelCase（DB の snake_case は Route Handler 内で変換する）
- ログインは無い（単一ユーザー前提）

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
| GET      | `/api/quests/candidates`                | 3択の候補取得                  | @tutayadx         |
| POST     | `/api/quests`                           | クエスト開始                   | @tutayadx         |
| GET      | `/api/quests/{id}`                      | クエスト詳細（追加）           | @miyagunimikihiro |
| POST     | `/api/quests/{id}/checkpoints/generate` | AI チェックポイント生成        | @miyagunimikihiro |
| PATCH    | `/api/checkpoints/{id}`                 | チェックポイント達成状態の更新 | @miyagunimikihiro |
| POST     | `/api/quests/{id}/complete`             | クエスト完了                   | @miyagunimikihiro |
| GET      | `/api/stats`                            | 経験値などの集計（追加）       | @lovemeasure      |

「追加」はスライドの API 定義に無かったもの。画面の再読み込みと経験値の表示に必要なため加えた。

## 詳細

### GET /api/tasks

クエリ `status`（任意）: `active` / `in_quest` / `done` / `discarded`。省略時は `discarded` 以外。

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

### PATCH /api/tasks/{id}

```json
// リクエスト（すべて任意）
{ "title": "...", "dueAt": null, "status": "discarded" }
// 200
{ "task": Task }
```

`status: "discarded"` が「手放す」操作。

### DELETE /api/tasks/{id}

`204`（本文なし）。

### GET /api/quests/candidates

```json
// 200
{ "isUrgent": false, "candidates": [Task, Task, Task] }
```

- `isUrgent: true` のとき `candidates` は締切が近い 1 件だけ
- `active` なタスクが 3 件未満ならその件数だけ返す（0 件なら空配列）
- 提示したタスクの `shownCount` を増やす

### POST /api/quests

```json
// リクエスト
{ "selectedTaskId": "uuid", "shownTaskIds": ["uuid", "uuid", "uuid"] }
// 201
{ "quest": Quest }
```

- 選ばれたタスクの重みを上げ、`status` を `in_quest` にする
- 選ばれなかったタスクの重みを下げ、`skippedCount` を増やす
- `selection_logs` に記録する

### GET /api/quests/{id}

```json
// 200
{ "quest": Quest, "task": Task, "checkpoints": [Checkpoint] }
```

`checkpoints` は `parentId` が null の全体像のチェックポイントと、その子をすべて含む平らな配列。並び順は `position`。

### POST /api/quests/{id}/checkpoints/generate

リクエスト本文なし。既存のチェックポイントがあれば作り直す。

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

リクエスト本文なし。クエストを `completed`、タスクを `done` にし、経験値を付与する。

```json
// 200
{ "quest": Quest, "xpGained": 30, "totalXp": 120 }
```

### GET /api/stats

```json
// 200
{ "totalXp": 120, "completedQuests": 4 }
```

## 型

`src/lib/schemas.ts` の `Task` / `Quest` / `Checkpoint` を参照。
