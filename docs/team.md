# チームと担当範囲

| メンバー          | 役割 | 担当範囲                                                                                                   |
| ----------------- | ---- | ---------------------------------------------------------------------------------------------------------- |
| @lovemeasure      | PM   | 全体の進行・レビュー、共通部分（`src/lib/`、`supabase/`、`docs/`、設定ファイル）、タスク登録、経験値の集計 |
| @tutayadx         | 開発 | タイトル画面、3択タスク選択、レコメンドアルゴリズム                                                        |
| @miyagunimikihiro | 開発 | AI チェックポイント生成、チェックポイント画面、クエスト完了                                                |

タスク登録と経験値の集計は、手が空いた人が引き取ってよい（その場合はこの表と `.github/CODEOWNERS` を更新する）。

## ディレクトリと担当

| パス                                                                 | 担当                                   |
| -------------------------------------------------------------------- | -------------------------------------- |
| `src/features/title/`                                                | @tutayadx                              |
| `src/features/quest/`                                                | @tutayadx                              |
| `src/app/api/quests/candidates/`、`src/app/api/quests/route.ts`      | @tutayadx                              |
| `src/features/checkpoint/`                                           | @miyagunimikihiro                      |
| `src/app/api/quests/[id]/`、`src/app/api/checkpoints/`               | @miyagunimikihiro                      |
| `src/features/task/`、`src/app/api/tasks/`、`src/app/api/stats/`     | @lovemeasure                           |
| `src/lib/`、`src/app/layout.tsx`、`supabase/`、`docs/`、設定ファイル | @lovemeasure（共通。変更は PR で共有） |

## 依存関係

```
タスク登録 (tasks API) ──▶ 3択 (candidates / quests API) ──▶ チェックポイント (generate / checkpoints API) ──▶ 完了・経験値
```

- 3択とチェックポイントは、`supabase/seed.sql` のサンプルデータを使えば、タスク登録の完成を待たずに開発できる
- チェックポイント側は、`quests` に手で 1 行入れれば 3択の完成を待たずに開発できる
- 画面同士のつなぎ込み（3択で選んだらチェックポイント画面へ遷移する等）は、両方のページができた時点で相談する
