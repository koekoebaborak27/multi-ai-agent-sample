# 図（mermaid）の作成・更新手順

ドキュメントに埋め込む構成図・フロー図は **mermaid を別ファイル（`.mmd`）で管理し、SVG に変換して `.md` から画像参照する**。`.md` に mermaid ブロックを直接埋め込まない。

> 理由: ブラウザネイティブの mermaid 描画は環境差（フォント・バージョン）で**日本語が文字切れ**しやすい。`.mmd` をローカル（mmdc）で SVG 化して固定すれば、どこで見ても同じ図になり、差分レビューも `.mmd` で追える。

## 1. 命名規約

同じドキュメントに複数の図が載ることを想定し、**図番号**で対応付ける。

```
<ドキュメント名>.md          ← 正本（図は画像参照）
<ドキュメント名>.<図番号>.mmd ← 図のソース（mermaid）
<ドキュメント名>.<図番号>.svg ← .mmd から生成した画像（コミット対象）
```

- 図番号は **2 桁ゼロ埋め**（`01`, `02`, …）。同一ドキュメント内で図ごとに採番する。
- 例（`docs/`）:
  ```
  foundation_plan.md
  foundation_plan.01.mmd
  foundation_plan.01.svg
  ```
- `.mmd` と `.svg` は**同じディレクトリ**に置く（`.md` からの相対参照を単純に保つ）。
- `.svg` は生成物だが**コミットする**（GitHub 等で `.md` を開いたとき図が表示されるため）。`.mmd` を変更したら必ず `.svg` を再生成して一緒にコミットする。

## 2. 前提ツール

- **mmdc**（`@mermaid-js/mermaid-cli`）をグローバルインストール:
  ```sh
  npm install -g @mermaid-js/mermaid-cli
  ```
- **日本語フォント**が「**mmdc を実行するマシン**」に入っていること（描画は headless Chromium が行うため、図を閲覧する側ではなく**変換する側**の環境に依存する）。フォントは環境差の影響が大きく、未導入だと日本語が豆腐（□）になったり、別フォントで幅がずれて文字が切れる。
- WSL / CI など**サンドボックス制約のある環境**では puppeteer に `--no-sandbox` が必要。次の 1 行で設定ファイルを `/tmp` に作り、mmdc 実行時に `-p` で渡す（サンドボックスが効く環境でも無害なので常に付けてよい）:
  ```sh
  printf '{"args":["--no-sandbox","--disable-setuid-sandbox"]}' > /tmp/mmdc-puppeteer.json
  ```

### OS 別の日本語フォント事情

| OS | デフォルトの日本語フォント | 対応 |
|---|---|---|
| **macOS** | Hiragino Sans（ヒラギノ角ゴ）が標準で入っている | 追加インストール不要 |
| **Windows** | Yu Gothic（游ゴシック）/ Meiryo が標準で入っている | 追加インストール不要 |
| **Linux（素の Ubuntu/Debian 等）/ WSL** | **既定では日本語フォントが入っていない**ことが多い | 下記でインストールが必要 |
| **CI コンテナ** | ベースイメージ次第。多くは未導入 | ジョブ内で下記をインストール |

WSL / Linux / CI でのインストール例（Debian/Ubuntu 系）:

```sh
sudo apt-get update && sudo apt-get install -y fonts-noto-cjk
fc-list | grep -i "noto sans cjk jp"   # 入ったか確認
```

> `.mmd` の `fontFamily` は **複数フォントのフォールバックチェーン**で書き、どの OS でも当たるようにする（§3）。チェーン先頭から「実行マシンに存在する最初のフォント」が使われる。

## 3. `.mmd` テンプレート

**先頭に init ディレクティブを必ず入れる**。これがないと描画フォントと計測フォントが食い違い、ボックス幅が足りず文字が切れる。

```
%%{init: {'theme':'default','themeVariables':{'fontFamily':"'Noto Sans CJK JP','Hiragino Sans','Yu Gothic',sans-serif"},'flowchart':{'nodeSpacing':50,'rankSpacing':85,'padding':12}}}%%
flowchart TB
  %% ここに図の定義
```

- `fontFamily` … mermaid のテキスト幅計測を実フォントに合わせ、**文字切れを防ぐ**最重要設定。OS 差を吸収するため**フォールバックチェーン**で書く（先頭から実行マシンに存在する最初のものが使われる）:
  - `Noto Sans CJK JP` … Linux / WSL / CI（要インストール、§2）
  - `Hiragino Sans` … macOS 標準
  - `Yu Gothic` … Windows 標準
  - 末尾の `sans-serif` … 最終フォールバック
- `nodeSpacing` / `rankSpacing` … ノード/段の間隔。**エッジラベルがノードに重なる**ときは `rankSpacing` を広げる（80〜100 程度）。
- 設定を `.mmd` に内包しておくことで、変換時に追加オプション（`-c`）が不要になり再現性が高い。

> 図の `.svg` を**最終的に生成するマシンは統一する**のが望ましい（OS が違うと選ばれるフォントが変わり、`.svg` の差分が出るため）。本リポジトリでは Linux/WSL（Noto Sans CJK JP）を基準とする。

## 4. 新しい図を追加する

1. `<doc>.<NN>.mmd` を作成（§3 のテンプレートから）。
2. SVG に変換（§6）。
3. `<doc>.md` の該当箇所に画像参照と再生成メモを書く:
   ```markdown
   ![図のタイトル](./<doc>.<NN>.svg)

   > 図のソースは [`<doc>.<NN>.mmd`](./<doc>.<NN>.mmd)（mermaid）。編集後は次で再生成する:
   >
   > ```sh
   > mmdc -i <doc>.<NN>.mmd -o <doc>.<NN>.svg -p /tmp/mmdc-puppeteer.json
   > ```
   ```
   （`/tmp/mmdc-puppeteer.json` は §2 の 1 行コマンドで事前に作る）
4. `.mmd` / `.svg` / `.md` を一緒にコミット。

## 5. 既存の図を更新する

1. `<doc>.<NN>.mmd` を編集。
2. 同名で `.svg` を再生成（§6）。**`.svg` を手で編集しない**（次回再生成で消える）。
3. `.mmd` と `.svg` をセットでコミット。

## 6. 変換コマンド

`.mmd` → `.svg`（1 ファイル）。出力名を `.<NN>.svg` に合わせる:

```sh
printf '{"args":["--no-sandbox","--disable-setuid-sandbox"]}' > /tmp/mmdc-puppeteer.json
cd docs   # .mmd のあるディレクトリ
mmdc -i foundation_plan.01.mmd -o foundation_plan.01.svg -p /tmp/mmdc-puppeteer.json
```

### 仕上がり確認（任意）

SVG は端末で直接見られないため、確認したいときは PNG を一時出力して目視する（PNG はコミットしない）:

```sh
mmdc -i foundation_plan.01.mmd -o /tmp/preview.png -e png -s 2 -b white -p /tmp/mmdc-puppeteer.json
```

## 7. レイアウト崩れの対処

| 症状 | 対処 |
|---|---|
| 日本語が切れる / はみ出す | `.mmd` 先頭の init ディレクティブで `fontFamily` を指定（§3）。**mmdc 実行マシン**に CJK フォントが入っているか確認（§2 の OS 別表） |
| エッジラベルがノードに重なる | `rankSpacing` を広げる。関連ノードを `subgraph` でグルーピングして段を分けると交差が減る |
| 日本語が □（豆腐）になる | mmdc 実行マシンに CJK フォント未導入。Linux/WSL/CI は `fonts-noto-cjk` を入れる（macOS/Windows は標準で同梱、§2） |
| WSL/CI で描画が落ちる | `-p /tmp/mmdc-puppeteer.json`（`--no-sandbox`、§2 の 1 行コマンドで作成）を付ける。`libnss3` 等の不足ライブラリ導入も検討 |
