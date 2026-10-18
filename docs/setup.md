# 環境構築

人間が読んでも、AI エージェントに「`docs/setup.md` に従って環境構築して」と頼んでも進められるように書いている。

## 必要なもの

| ツール  | バージョン                           | 確認コマンド    |
| ------- | ------------------------------------ | --------------- |
| Node.js | 22 以上（推奨: `.nvmrc` の 24）      | `node -v`       |
| npm     | Node.js に付属                       | `npm -v`        |
| Docker  | ローカルで Supabase を動かす場合のみ | `docker info`   |
| Git     | 任意                                 | `git --version` |

## 手順

### 1. 依存パッケージを入れる

```sh
npm ci
```

`prepare` スクリプトで husky の pre-commit フックも自動で設定される。

### 2. 環境変数ファイルを作る

```sh
cp .env.example .env.local
```

`.env.local` はコミットしない（`.gitignore` 済み）。

### 3. データベースを用意する

どちらかを選ぶ。

**A. ローカルの Supabase（Docker が必要、推奨）**

```sh
npm run db:start   # 初回はイメージのダウンロードで数分かかる
npm run db:reset   # マイグレーションと seed.sql を適用する
```

`db:start` の出力にある `API URL` を `SUPABASE_URL` に、`service_role key`（新しい CLI では `Secret key`）を `SUPABASE_SERVICE_ROLE_KEY` に書く。出力を見失ったら `npx supabase status` で再表示できる。

Supabase Studio（DB を GUI で見る画面）は http://127.0.0.1:54323 で開ける。

**B. チームで共有する Supabase プロジェクト**

PM (@lovemeasure) から `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を受け取って `.env.local` に書く。共有DBのservice_roleキーは全ユーザーのデータにアクセスできるため、サーバー専用として扱う。アプリではユーザーごとの分離が必要であり、認証・所有者検証はPR #72で対応済み。本番DB反映は#73で追跡する。

### 4. Gemini の API キーを設定する

https://aistudio.google.com/apikey でキーを発行し、`GEMINI_API_KEY` に書く。チェックポイント生成を触らない人は空のままでもよい（その API を呼んだときだけエラーになる）。

### 5. 起動して確認する

```sh
npm run dev
```

- http://localhost:3000 は未ログイン時にログイン画面を表示する。既存のGoogle OAuthには公開用Supabase URL/anon keyとSupabase側のGoogleプロバイダー・コールバックURL設定が必要（`.env.example`参照）。認証設定がない環境はユニットテストとビルドで検証する。
- ログイン後は3択のクエスト画面が表示される。タスクがなければ「新しいタスクを追加」から登録する。
- ログイン済みブラウザでタスク一覧の取得を確認する。未認証のcurlで200を期待する確認方法は使わない。
- 「タスク」タブでタスク名と任意の期限を登録し、再読み込みしても保存されていることを確認する。
- ローカルDBがすでにある場合は `npx supabase migration up --local` で追加マイグレーションを適用する。リモートDBへの適用は担当者が行う。

### 6. チェックが通ることを確認する

```sh
npm run check
```

## よく使うコマンド

| コマンド                              | 内容                                                          |
| ------------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                         | 開発サーバー                                                  |
| `npm run check`                       | lint・format・型チェック・テストをまとめて実行（PR 前に必ず） |
| `npm run test:watch`                  | テストを監視モードで実行                                      |
| `npm run lint:fix` / `npm run format` | 自動修正                                                      |
| `npm run db:new <名前>`               | 新しいマイグレーションファイルを作る                          |
| `npm run db:reset`                    | ローカル DB を作り直してマイグレーションと seed を適用        |
| `npm run db:stop`                     | ローカル Supabase を止める                                    |

## AI エージェント向けの手順

AI に環境構築を任せるときは、次の順で進めること。

1. `node -v` が 22 以上か確認する。足りなければ人間に Node.js の更新を依頼して止まる
2. `npm ci` を実行する
3. `.env.local` が無ければ `cp .env.example .env.local` で作る。**既にあれば上書きしない**
4. `docker info` が成功するなら手順 3-A を実行し、出力されたキーを `.env.local` に書く。失敗するなら人間に「Docker を起動するか、共有 Supabase のキーを `.env.local` に書いてほしい」と依頼して止まる
5. `GEMINI_API_KEY` は AI が発行・推測しない。空なら人間に伝える
6. `npm run check` と `npm run dev` で動作を確認し、結果（成功・失敗とエラー内容）を報告する

禁止事項: リモートの Supabase プロジェクトに対する `supabase db push` / `db reset --linked`、`.env.local` の内容をログやコミットに含めること。

## AI ツールの設定

メンバーは Claude Code・Codex・Antigravity などを使い分けている。ルールの正は `AGENTS.md` で、どのツールでも最初にそれが読み込まれていることを確認する。各ツールでは、`AGENTS.md` の禁止事項（リモート Supabase の破壊、`main` への直接 push、強制 push、`--no-verify`、無視ファイルの強制追加）を、ツール側でもよくある書き方に限って止める。コマンドの先頭一致でしか判定できないため、`git push origin x --force` のように順番を変えた書き方は止まらない。あくまで補助で、本当の防御は `main` のブランチ保護と AGENTS.md のルール。

### Claude Code

- `CLAUDE.md` 経由で `AGENTS.md` が読み込まれる。追加の設定は不要
- `.claude/settings.json` で、よく使うチェック・git の読み取り系コマンドを許可し、禁止事項のコマンドを拒否している
- 自分だけの許可設定は `.claude/settings.local.json` に書く（コミットしない）
- `/ship` で PR からマージまで進められる

### Codex

- `AGENTS.md` を自動で読む
- `.codex/rules/project.rules` に禁止コマンドを書いている。プロジェクトの `.codex/` が trusted のときだけ読み込まれるので、初回に Codex がこのリポジトリを信頼するか聞いてきたら許可する
- ルールの動作確認: `codex execpolicy check --rules .codex/rules/project.rules -- git push --force`（`"decision":"forbidden"` になればよい）
- AI レビューは `docs/ai-review.md` の「仕組み」にあるとおり、`codex exec` など別のプロセスで行う

### Antigravity

- `AGENTS.md` を自動で読む（2026 年 3 月以降の版）。読まれていないようなら Antigravity を更新する
- `GEMINI.md` は作らない（`AGENTS.md` より優先されるため）
- ターミナルの許可・拒否はリポジトリに置けないので、各自で設定する。設定のターミナルコマンド実行（Terminal Command Auto Execution）の **Deny list** に次を追加する（設定画面の名前は版によって違うことがある）
  - `supabase db push`、`npx supabase db push`
  - `supabase db reset --linked`、`npx supabase db reset --linked`
  - `supabase link`、`npx supabase link`
  - `git push --force`、`git push -f`、`git push origin main`
    - 単純な文字列の前方一致で判定される場合、`git push --force` を入れると `/ship` が使う `git push --force-with-lease` まで止まることがある。止まったら `git push --force` を外し、`git push -f` だけにする
  - `git commit --no-verify`、`git commit -n`
  - `git add -f`、`git add --force`
- AI レビューは、別のエージェント（新しい会話）に `docs/ai-review.md` と差分を渡して行う

### その他のツール

`AGENTS.md` を自動で読まないツールでは、会話の最初に「`AGENTS.md` を読んでから作業して」と伝える。

## トラブルシューティング

- **`環境変数が不足しています` エラー**: `.env.local` の値が空。手順 2〜4 を確認し、`npm run dev` を再起動する
- **`db:start` が失敗する**: Docker Desktop が起動しているか確認する。ポート 54321〜54324 を他で使っていないか確認する
- **pre-commit で止まる**: 表示された lint エラーを直すか `npm run lint:fix` を実行してから再度コミットする
