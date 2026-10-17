---
name: ship
description: 作業を PR にしてマージまで進める。チェック、AI レビュー（code-reviewer サブエージェント）、指摘の修正、PR 作成、自動マージの予約を順に行う。「PR にして」「マージまでやって」「出して」と言われたときに使う。
---

# /ship

人の承認なしで、CI と AI レビューが通った変更をマージまで進める。ルールの詳細は `docs/ai-review.md` と `docs/working-agreement.md`。

## 手順

1. **ブランチを確認する**
   - `main` にいるなら、変更内容に合った `<種類>/<内容>` のブランチを作って移る
   - `git fetch origin main` し、`main` から遅れていれば取り込む（`git rebase origin/main`）。コンフリクトしたら止めて人に伝える

2. **チェックする**
   - `npm run check` を実行する。失敗したら直す。直せなければ止めて人に伝える

3. **コミットする**
   - 未コミットの変更があれば `<種類>: <内容>` でコミットする。`--no-verify` は使わない

4. **AI レビューを受ける**
   - `code-reviewer` サブエージェントを呼び出す。プロンプトには、このブランチで何をしたか（目的と変更の概要）だけを書き、自分の判断や言い訳は書かない
   - FAIL なら、ブロッカーを直してコミットし、もう一度レビューを受ける
   - 3 回で PASS にならない、または指摘が誤りだと考える場合は、止めて人に判断を求める

5. **PR を作る**
   - `git push -u origin <ブランチ>`
   - `.github/pull_request_template.md` の形式で本文を書き、「AI レビュー」欄に最後のレビュー結果をそのまま貼る
   - `gh pr create --base main --title "<種類>: <内容>" --body-file <本文ファイル>`

6. **自動マージを予約する**
   - `gh pr merge <番号> --auto --squash --delete-branch`
   - CI が通ると GitHub が自動でマージする。CI が失敗したら `gh pr checks <番号>` で原因を確認して直し、push する（AI レビューの対象になる変更なら手順 4 からやり直す）

7. **報告する**
   - PR の URL、AI レビューの結果（PASS までの回数）、自動マージを予約したことを人に伝える
