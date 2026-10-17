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

PM (@lovemeasure) から `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を受け取って `.env.local` に書く。共有 DB なので、他のメンバーのデータも見える点に注意。

### 4. Gemini の API キーを設定する

https://aistudio.google.com/apikey でキーを発行し、`GEMINI_API_KEY` に書く。チェックポイント生成を触らない人は空のままでもよい（その API を呼んだときだけエラーになる）。

### 5. 起動して確認する

```sh
npm run dev
```

- http://localhost:3000 でタイトル画面（仮）が表示される
- `curl -i http://localhost:3000/api/tasks` が `501`（未実装）または実装済みなら `200` を返す

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

## トラブルシューティング

- **`環境変数が不足しています` エラー**: `.env.local` の値が空。手順 2〜4 を確認し、`npm run dev` を再起動する
- **`db:start` が失敗する**: Docker Desktop が起動しているか確認する。ポート 54321〜54324 を他で使っていないか確認する
- **pre-commit で止まる**: 表示された lint エラーを直すか `npm run lint:fix` を実行してから再度コミットする
