# デザインと共通 UI

画面の見た目をメンバー（と各自の AI）ごとにばらつかせないためのルール。画面を作る・直す前に読むこと。

## 正とするもの

| 対象                     | 正                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 画面の構成・レイアウト   | Figma「TODO-ROGUE｜スマホ縦型UI-6画面」（https://www.figma.com/design/IjOn5pPLYYKsAUrXOLGh7i/ ）。画像は `docs/figma/`（取得方法は `docs/figma.md`） |
| 色                       | `src/app/tokens.css`                                                                                                                                 |
| ボタン・パネルなどの部品 | `src/components/ui/`                                                                                                                                 |
| 迷ったとき               | 共通 UI の担当 @ki-mutaku に聞く                                                                                                                     |

色は PR #6（ホーム・タスク一覧・3択の画面）、フォントは PR #7 の DotGothic16（`globals.css` で読み込み済み）がベース。Figma と実装が食い違うときは、勝手にどちらかへ寄せず担当に確認する。

## 担当

共通 UI（`src/components/ui/`、`src/app/tokens.css`、`src/app/globals.css`）の担当は **@ki-mutaku**。担当以外がこれらを変えたいときは、機能の PR に混ぜず、そのファイルだけの小さな PR を先に出す（`AGENTS.md`「共通ファイルと PR の大きさ」）。

このファイル（`docs/design.md`）の内容も @ki-mutaku が決める。`docs/` は PM の担当だが、デザインのルールは共通 UI の担当に従う。

## ルール

- スマホ縦型（幅390px前後）の操作性を維持し、タブレット・PCでは1カラムを最大幅 `48rem`（`max-w-3xl`、標準設定で768px）で中央寄せする。画面端まで本文を広げず、640px以上では左右の余白を32px、1024px以上では48pxに広げる。スマホの既存の左右余白（20〜24px）は維持する。
- ボトムナビは、画面中央に配置された最大幅指定のある親コンテナの直下に置く。ナビの最大幅は親から継承し、画面とナビの左右端を揃える。下部固定とセーフエリア対応は全画面幅で維持する。
- ログイン・読み込み中・タスク／クエスト／ステータス・チェックポイント生成／進行／クリア画面は同じ最大幅を使う。ダイアログは本文より狭い既存の幅を維持し、読みやすさを優先する。Figmaのスマホ画面を基準とし、Issue #30の承認範囲として大画面の幅と余白だけを拡張する。
- 色は `tokens.css` のトークンを Tailwind のクラスで使う（`bg-panel`、`text-muted`、`border-gold-accent` など）。新しく書くコードでは `bg-[#22273e]` のように 16 進数を直接書かない（既存のコードは下の「移行」で順に置き換える）
- 必要な色が無ければ、近い色で妥協せず `tokens.css` に足す PR を出す
- ボタン・パネル・入力欄・見出し・区切り線は `src/components/ui/` の部品を使う。無ければ自分の機能のフォルダに作らず、`src/components/ui/` に追加する
- 部品は Props で見た目の種類を切り替える（例: `variant="primary" | "secondary"`）。機能固有のロジックや API 呼び出しを入れない
- 機能固有の見た目（キャラクターのドット絵など）は `src/features/<機能>/` に置いてよい
- `globals.css` には全体に効く最小限のもの（`body`、フォーカスリング、`prefers-reduced-motion`）だけを書く。部品のスタイルは部品のファイルに Tailwind で書く。`globals.css` に部品のクラスを新しく足さない
- アプリアイコンは `public/icon.png` を正とし、favicon および apple-touch-icon に設定する
- ナビゲーション等のアイコンはピクセル調のSVGアイコンを用い、タップ・視認が容易な大きさ（24〜32px）を基準とする
- 文言は日本語
- デバッグ操作の「ダミータスクを追加」は、ゲーム内の行動ではなく仕事・学校・私生活のタスクを各2件、合計6件追加する。いずれも期限なしで、既存タスクは保持する。reject回数（`skippedCount`）は、会議の議事録0回・プレゼン資料1回・数学の課題2回・英単語の復習3回・食料品の買い物5回・部屋の掃除10回として保存し、抽選確率の違いを確認できるようにする。
- タスクリストの完了済み（`done`）は「完了済みタスク（N件）」のアコーディオンに分離し、初期状態では閉じる。クリック・Enter・Spaceで開閉でき、未完了・挑戦中は常時表示する。各一覧内のreject回数順と編集・削除メニューは維持する。完了済みが0件なら見出しを表示しない。開閉状態は画面を離れるとリセットする。

## トークン一覧

| トークン                                    | 用途                               |
| ------------------------------------------- | ---------------------------------- |
| `surface`                                   | 画面の背景                         |
| `panel` / `panel-active`                    | パネル・カード / 選択中            |
| `field`                                     | 入力欄の背景                       |
| `text` / `muted` / `placeholder`            | 本文 / 補足 / プレースホルダー     |
| `line` / `line-dim` / `frame`               | 入力欄の枠 / 区切り線 / パネル外枠 |
| `gold` / `gold-hover`                       | 主ボタンの背景                     |
| `gold-accent` / `gold-border` / `gold-text` | 強調・選択枠 / パネル枠 / 副ボタン |
| `gold-ink`                                  | 主ボタンの文字                     |
| `success` / `danger`                        | 成功・フォーカス / エラー          |

## 共通部品と移行

### 今の状態（2026-10-17 時点）

同じ役割の部品が 2 系統あり、色も 16 進数で直接書かれている。

- **CSS クラス**（PR #6、`globals.css`）: `.pixel-panel`、`.gold-button`、`.secondary-button`、`.pixel-input`、`.pixel-divider`、`.screen-heading`、`.quest-selected`。ホーム・タスク一覧・3択（`src/features/title/`、`task/`、`quest/`）で使用
- **React 部品**（PR #7 以降、`src/features/checkpoint/components/`）: `PixelButton`、`PixelCard`、`PixelHeader`、`PixelCheckbox`、`PixelProgressBar`。チェックポイント生成・進行・クリア画面で使用
- 16 進数の直書き: `src/features/` の画面コンポーネント 15 ファイル（ドット絵を含む）

### まとめ先

| 共通部品（`src/components/ui/`）                                                                                                                                                    | 元になるもの                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `PixelBottomNav`                                                                                                                                                                    | ボトムナビゲーション（タスク / クエスト / ステータス） |
| `PixelPanel`                                                                                                                                                                        | `.pixel-panel`、`PixelCard`                            |
| `PixelButton`                                                                                                                                                                       | `.gold-button` / `.secondary-button`、`PixelButton`    |
| `PixelInput`                                                                                                                                                                        | `.pixel-input`                                         |
| `ScreenHeading`                                                                                                                                                                     | `.screen-heading`、`PixelHeader`                       |
| `PixelDivider`                                                                                                                                                                      | `.pixel-divider`                                       |
| `PixelCheckbox`                                                                                                                                                                     | `PixelCheckbox`                                        |
| `PixelProgressBar`                                                                                                                                                                  | `PixelProgressBar`                                     |
| ドット絵（`HeroPixelArt`、`MagePixelArt`、`TreasureChestPixelArt`、`.pixel-wizard` など）は機能固有なので、各機能のフォルダに残してよい。ドット絵の中の色はトークンにしなくてよい。 |

### 移行の手順

AI に「`docs/design.md` の移行の手順に従って、<部品名> を移行して」と頼めば進められるように書いている。1 回の PR で 1〜2 部品ずつ進める。デモ直前は見た目が壊れる危険があるので、移行より機能を優先してよい。

1. 共通 UI の担当（@ki-mutaku）が、上の表の部品を `src/components/ui/` に作る。見た目は今の画面と変えず、色は `tokens.css` のトークンで書き、テストを付ける（共通ファイルだけの PR）
2. 各画面の担当者が、自分の画面の CSS クラスや `features/checkpoint/components/Pixel*` を共通部品に置き換える（自分の担当範囲だけの PR）
3. どこからも使われなくなった `globals.css` のクラスと `features/checkpoint/components/Pixel*` を消す
4. 画面コンポーネント内の 16 進数の色をトークンに置き換える。対応するトークンが無い色は、近いトークンに寄せるか `tokens.css` に追加する
5. `globals.css` の `:root`（`--background`、`--foreground`）と `.pixel-*` などのクラスにある 16 進数も、`tokens.css` のトークンを参照する形にする（今は `surface`・`text` と同じ値を二重に持っている）
