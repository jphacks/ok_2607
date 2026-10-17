# Figma 画像の取得ガイド

Figma のデザインデータ（スマホ縦型UI 6画面）から画像を自動取得するための環境とスクリプトです。

対象 URL:
`https://www.figma.com/design/IjOn5pPLYYKsAUrXOLGh7i/TODO-ROGUE｜スマホ縦型UI-6画面?node-id=0-1&p=f&t=BBvvYIghqFNYlZKl-0`

---

## 1. 事前準備 (Figma Personal Access Token の取得)

Figma API を利用して画像をエクスポート・ダウンロードするには、Figma の Personal Access Token が必要です。

1. ブラウザで [Figma](https://www.figma.com/) にログイン
2. 画面左上のユーザーアイコンをクリックし、**Settings** を開く
3. **Security** タブを開き、**Personal access tokens** セクションまでスクロール
4. **Generate new token** をクリック
   - Token name: `todo-rogue` などの任意の名前
   - Expiration: 任意（例: 30 days や No expiration）
   - Scopes: `File content` の **Read-only** (`files:read`) にチェック
5. 発行されたトークン（`figd_...`）をコピー
6. `.env.local` に以下を追記:
   ```sh
   FIGMA_ACCESS_TOKEN=figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

---

## 2. 実行コマンド

### デフォルト設定で取得（指定 URL の画面を `docs/figma/` に保存）

```sh
npm run figma:fetch
```

デフォルトで 2倍解像度（scale 2）の PNG 画像として `docs/figma/` ディレクトリに保存されます。

### オプション指定の例

```sh
# 保存先を public/figma に変更
npm run figma:fetch -- -o public/figma

# 全画面・全フレームをまとめて取得
npm run figma:fetch -- --all

# 画像形式を SVG や JPG に変更
npm run figma:fetch -- -f svg

# 解像度倍率を 3倍に変更
npm run figma:fetch -- -s 3

# 別の Figma URL を指定
npm run figma:fetch -- -u "https://www.figma.com/design/.../..."

# ヘルプの表示
npm run figma:fetch -- --help
```

---

## 3. スクリプトの仕組み

- `scripts/fetch-figma-images.mjs`
- Node.js 標準モジュール（`fetch`, `fs`, `util.parseArgs`）のみを使用しているため、追加パッケージのインストールなしで動作します。
- URL から `fileKey` と `nodeId` を自動解析し、Figma REST API (`/v1/files/:key`, `/v1/images/:key`) を呼び出して各フレームごとの高解像度画像をダウンロードします。
