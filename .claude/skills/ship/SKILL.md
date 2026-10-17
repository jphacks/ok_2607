---
name: ship
description: 作業を PR にしてマージまで進める。チェック、AI レビュー（code-reviewer サブエージェント）、指摘の修正、PR 作成、自動マージの予約を順に行う。「PR にして」「マージまでやって」「出して」と言われたときに使う。
---

# /ship

人の承認なしで、CI と AI レビューが通った変更をマージまで進める。ルールの詳細は `docs/ai-review.md` と `docs/working-agreement.md`。

## 手順

1. **ブランチを確認してコミットする**
   - `main` にいるなら、変更内容に合った `<種類>/<内容>` のブランチを作って移る
   - 未コミットの変更があれば `<種類>: <内容>` でコミットする。`--no-verify` は使わない

2. **main を取り込む**
   - `git fetch origin main` し、遅れていれば `git rebase origin/main` で取り込む。コンフリクトしたら止めて人に伝える

3. **チェックする**
   - `npm run check` を実行する。pre-commit は lint と format だけなので、型チェックとテストはここで確認する
   - 失敗したら直してコミットし、もう一度実行する。直せなければ止めて人に伝える

4. **AI レビューを受ける**
   - `code-reviewer` サブエージェントを呼び出す。プロンプトには、このブランチで何をしたか（目的と変更の概要）だけを書き、自分の判断や言い訳は書かない
   - FAIL なら、ブロッカーを直してコミットし、手順 3 からやり直す
   - 3 回で PASS にならない、または指摘が誤りだと考える場合は、PR を作らずに止めて人に判断を求める

5. **PR を作る**
   - push する。初回は `git push -u origin <ブランチ>`。手順 2 で rebase した後に既に push 済みのブランチを更新するときは `git push --force-with-lease`
   - `.github/pull_request_template.md` の形式で本文を書き、「AI レビュー」欄に最後のレビュー結果をそのまま貼る
   - PR が無ければ `gh pr create --base main --title "<種類>: <内容>" --body-file <本文ファイル>`、既にあれば `gh pr edit <番号> --body-file <本文ファイル>` で本文を更新する

6. **自動マージを予約する**
   - `gh pr merge <番号> --auto --squash --delete-branch`
   - CI が通ると GitHub が自動でマージする
   - CI が失敗したら、`gh pr merge <番号> --disable-auto` で予約を外してから `gh pr checks <番号>` で原因を確認し、直して**手順 3 からやり直す**。コードを変えたら、どんなに小さな修正でも AI レビューを受け直し、PR 本文の結果も更新する

7. **報告する**
   - PR の URL、AI レビューの結果（PASS までの回数）、自動マージを予約したことを人に伝える
