# GitHub の SSH 鍵作成手順（Windows）

会社の GitHub アカウントと個人の GitHub アカウントを、**1台の PC で安全に使い分ける**ための手順。
Windows 標準の OpenSSH を使い、GUI でできる操作は GUI で行う。

対象読者: Git / SSH に不慣れな人。前提知識は不要。

---

## この手順で何ができるようになるか

- 個人アカウント専用の SSH 鍵が作られる
- `github-personal` という**あだ名**で GitHub に接続できるようになる
- 会社アカウントの鍵と混線しなくなる（後述の `IdentitiesOnly` による）

所要時間の目安: 10〜15 分。

---

## そもそも SSH 鍵とは

GitHub に「これは確かに本人だ」と証明するための仕組み。**2つで1組のファイル**を作る。

| ファイル | 例えるなら | 扱い |
|---|---|---|
| **秘密鍵**（`id_ed25519_personal`） | 家の**鍵** | 自分の PC に保管する。**誰にも渡さない** |
| **公開鍵**（`id_ed25519_personal.pub`） | 家の**鍵穴** | GitHub に登録する。人に見られてよい |

GitHub 側に鍵穴（公開鍵）を取り付けておくと、自分の PC にある鍵（秘密鍵）でそこを開けられる。
鍵穴だけを見ても鍵は複製できないので、公開鍵は公開しても安全。

---

## 表記について

| 表記 | 意味 |
|---|---|
| `%USERPROFILE%` | 自分のユーザーフォルダ。`C:\Users\<ユーザー名>` のこと |
| `<個人アカウント名>` | GitHub の個人アカウント名に読み替える |

---

## ステップ1: PowerShell を開く

どちらの方法でもよい。

**方法A: VS Code から**

1. メニューの **「ターミナル」→「新しいターミナル」** をクリック
2. 画面下部に入力欄が表示される

**方法B: スタートメニューから**

1. **Windows キー** を押す
2. `powershell` と入力
3. 表示された **「Windows PowerShell」** をクリック

`PS C:\...>` の後ろでカーソルが点滅していれば準備完了。

---

## ステップ2: 鍵を作る

以下の1行をコピーして PowerShell に貼り付け（右クリック または `Ctrl + V`）、**Enter** を押す。

```powershell
ssh-keygen -t ed25519 -C "<個人アカウント名>@work-pc" -f "$env:USERPROFILE\.ssh\id_ed25519_personal"
```

各オプションの意味:

| オプション | 意味 |
|---|---|
| `-t ed25519` | 鍵の種類。現在の推奨アルゴリズム（RSA より短く強い） |
| `-C "..."` | コメント。GitHub の鍵一覧で識別するためのラベル。**どの PC の鍵か**が分かる文字列にしておくと、後で失効させるときに迷わない |
| `-f "..."` | 出力先のファイルパス。会社用の鍵（`id_rsa` など）と名前が衝突しないようにしている |

### ① パスフレーズの入力

```
Enter passphrase (empty for no passphrase):
```

**何も入力せずに Enter** を押す（パスフレーズなしにする場合）。

### ② パスフレーズの再入力

```
Enter same passphrase again:
```

ここでも**何も入力せずに Enter**。

> パスフレーズを設定する場合、入力しても**画面には何も表示されない**（`*` すら出ない）。
> これは仕様なので、気にせず最後まで入力して Enter を押す。

### ③ 完成

```
Your identification has been saved in C:\Users\<ユーザー名>\.ssh\id_ed25519_personal
Your public key has been saved in C:\Users\<ユーザー名>\.ssh\id_ed25519_personal.pub
The key fingerprint is:
SHA256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx <個人アカウント名>@work-pc
The key's randomart image is:
+--[ED25519 256]--+
|      .. o+      |
|     ...  .      |
...
+----[SHA256]-----+
```

意味不明な模様（randomart）が表示されるが、これは**成功のサイン**。無視してよい。

- `identification has been saved` → **秘密鍵**が作られた
- `public key has been saved` → **公開鍵**が作られた

> `Overwrite (y/n)?` と聞かれた場合は、同名の鍵が既に存在するということ。
> `n` と入力して Enter で中止し、既存の鍵を確認する。

---

## ステップ3: 公開鍵をクリップボードにコピー

GitHub に登録するため、**公開鍵（`.pub` が付く方）** の中身をコピーする。以下を貼り付けて Enter。

```powershell
Get-Content "$env:USERPROFILE\.ssh\id_ed25519_personal.pub" | Set-Clipboard
```

何も表示されないが、これでクリップボードにコピーされている（`Ctrl + V` で貼り付けられる状態）。

中身を目で見たい場合は、エクスプローラーで `%USERPROFILE%\.ssh` を開き、
`id_ed25519_personal.pub` を右クリック →「プログラムから開く」→「メモ帳」。
`ssh-ed25519 AAAAC3Nza...` で始まる長い1行になっている。

> **注意**: `.pub` が**付いていない**方（秘密鍵）は、GitHub にも他人にも絶対に渡さない。

---

## ステップ4: GitHub に公開鍵を登録する（GUI）

1. ブラウザで <https://github.com> を開く
2. **右上のアイコン**をクリックし、ログイン中のアカウントが**個人アカウント**であることを確認する

   > **重要**: 会社アカウントでログインしている場合は必ず切り替える。
   > 同じ公開鍵を複数アカウントに登録することはできないため、間違えると後で面倒になる。
   > 会社アカウントと同時に作業したい場合は、シークレットウィンドウ（`Ctrl + Shift + N`）を使うと確実。

3. アドレスバーに以下を入力して移動する

   ```
   https://github.com/settings/ssh/new
   ```

4. 表示されたフォームを次のように埋める

   | 項目 | 入力内容 |
   |---|---|
   | **Title** | `work-pc-2026` など、どの PC の鍵か分かる名前（自由） |
   | **Key type** | `Authentication Key` のまま（変更不要） |
   | **Key** | 欄をクリックして `Ctrl + V` で貼り付け |

5. **「Add SSH key」** ボタンをクリック
6. GitHub のパスワード確認を求められたら入力する
7. 鍵の一覧に、登録した名前が表示されれば完了

---

## ステップ5: 設定ファイルを編集する（GUI）

PC に「`github-personal` という宛先に接続するときは、いま作った個人用の鍵を使う」と教える設定。

1. エクスプローラーを開く（`Windows キー + E`）
2. アドレスバーに以下を貼り付けて Enter

   ```
   %USERPROFILE%\.ssh
   ```

3. `config` という名前のファイル（拡張子なし）を**右クリック**
   - ファイルが存在しない場合は、メモ帳を開いて内容を書き、
     このフォルダに `config`（拡張子なし）という名前で保存する
4. **「プログラムから開く」→「メモ帳」**（VS Code でも可）
5. 以下の内容を記述する（既存の設定がある場合は、下に追記してよい）

   ```
   Host github-personal
     HostName github.com
     User git
     IdentityFile ~/.ssh/id_ed25519_personal
     IdentitiesOnly yes
   ```

   > 2行目以降の**先頭の空白2つ**（インデント）は必要。
   > 使わなくなった古い設定は、削除してよい。

6. **`Ctrl + S`** で保存して閉じる

各行の意味:

| 行 | 意味 |
|---|---|
| `Host github-personal` | この**あだ名**で接続先を呼べるようにする |
| `HostName github.com` | あだ名の実体は `github.com` |
| `User git` | GitHub の SSH は必ず `git` というユーザー名を使う決まり |
| `IdentityFile ...` | このあだ名では**この鍵を使う** |
| `IdentitiesOnly yes` | **他の鍵（会社用の `id_rsa` など）を使わせない**。会社アカウントとの混線を防ぐ要 |

### 会社の鍵（`id_rsa` など）はどうなるのか

**何も影響を受けない。** `config` には個人用のブロックだけ書いておけばよい。

SSH の鍵の選び方には2つのルールがある。

**ルール1: `Host` ブロックは、その名前で接続したときだけ効く**

`Host github-personal` のブロックが適用されるのは、`ssh github-personal` や
`git clone github-personal:...` のように、**あだ名を明示して接続したときだけ**。
会社の作業で `git@github.com:...` や社内サーバーへ接続するときは、このブロックは読み飛ばされる。

**ルール2: 設定がないホストでは、SSH がデフォルト名の鍵を自動で探す**

`config` に該当エントリがない接続先では、SSH は以下の決まった名前を順に探して提示する。

```
~/.ssh/id_rsa
~/.ssh/id_ecdsa
~/.ssh/id_ed25519
```

会社の `id_rsa` はこのデフォルト名に一致するため、従来通り自動的に使われる。
一方、個人鍵は `id_ed25519_personal` という**デフォルト名ではない**名前にしてあるため、
会社の接続時に誤って提示されることはない。

> これが鍵の名前に `_personal` を付けている理由。
> 個人鍵を `id_ed25519`（サフィックスなし）で作ると、会社の GitHub 接続時に SSH が自動で試し、
> **個人アカウントとして認証される事故**が起こり得る。

**会社側が壊れていないかの確認**

```powershell
ssh -T git@github.com
```

`Hi <会社のアカウント名>!` と返れば、会社側は従来通り `id_rsa` で認証されている。
会社の GitHub を HTTPS（`https://github.com/...`）で使っている場合は SSH が関与しないため、
このテストが `Permission denied` になっても問題ない（Git Credential Manager が認証を担当している）。

**明示的に書きたい場合（任意）**

暗黙のデフォルト動作に頼らず、会社用も併記する方法もある。

```
# 個人アカウント（あだ名で接続）
Host github-personal
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_personal
  IdentitiesOnly yes

# 会社アカウント（github.com をそのまま使う）
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_rsa
  IdentitiesOnly yes
```

ただし、会社の GitHub 接続に `id_rsa` 以外の鍵を使っている場合、`IdentitiesOnly yes` によって
接続できなくなる。会社側の設定を正確に把握していないうちは、**個人用ブロックだけ**にしておく方が安全。

---

## ステップ6: 接続を確認する

PowerShell に戻り、以下を貼り付けて Enter。

```powershell
ssh -T github-personal
```

### ① 初回だけ表示される確認

```
The authenticity of host 'github.com (140.82.x.x)' can't be established.
ED25519 key fingerprint is SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

「この接続先を初めて見るが信用するか」という確認。`yes` と**フルスペルで**入力して Enter
（`y` だけでは通らない）。

### ② 成功メッセージ

```
Hi <個人アカウント名>! You've successfully authenticated, but GitHub does not provide shell access.
```

これが表示されれば成功。
`does not provide shell access`（シェルは使えません）はエラーではなく、GitHub の通常の応答。

**`Hi` の後ろが個人アカウント名になっていること**を必ず確認する。

---

## トラブルシューティング

| 表示 | 原因と対処 |
|---|---|
| `Permission denied (publickey).` | ステップ4の登録ができていない。登録先のアカウントも確認する |
| `Hi` の後ろが会社アカウント名 | 公開鍵を会社アカウントに登録してしまっている。GitHub 側で削除して登録し直す |
| `Connection timed out` / `Connection refused` | ネットワークが SSH のポート22を遮断している可能性。下記「ポート22が使えない場合」を参照 |
| `Bad configuration option` | `config` の記述ミス。インデントやスペルを確認する |
| `config` を保存しても反映されない | メモ帳が `config.txt` として保存している可能性。エクスプローラーの「表示」→「ファイル名拡張子」にチェックを入れて確認する |

### ポート22が使えない場合

社内ネットワークが SSH の標準ポート（22番）を遮断していることがある。
その場合は `config` を以下に変更すると、HTTPS と同じ 443 番ポート経由で接続できる。

```
Host github-personal
  HostName ssh.github.com
  Port 443
  User git
  IdentityFile ~/.ssh/id_ed25519_personal
  IdentitiesOnly yes
```

---

## 使い方

リポジトリの接続先（remote）に、`github.com` の代わりに**あだ名**を使う。

```powershell
# 新しくクローンする場合
git clone github-personal:<個人アカウント名>/<リポジトリ名>.git

# 既存のリポジトリの接続先を変更する場合
git remote set-url origin github-personal:<個人アカウント名>/<リポジトリ名>.git
```

---

## 補足: パスフレーズなしの鍵について

この手順ではパスフレーズを設定していない。そのため**秘密鍵ファイルを入手した者は、
そのまま個人アカウントとして GitHub を操作できる**。以下に注意する。

- `%USERPROFILE%\.ssh` の中身を、共有フォルダやクラウドストレージに置かない
- 秘密鍵ファイルをメールやチャットで送らない
- PC を手放す / 初期化する際は、GitHub の <https://github.com/settings/keys> から
  対応する公開鍵を削除する（鍵を失効させる）
- PC の紛失・盗難時も、同じく GitHub 側で公開鍵を削除すれば以後の接続を遮断できる

後からパスフレーズを設定したくなった場合は、鍵を作り直さずに変更できる。

```powershell
ssh-keygen -p -f "$env:USERPROFILE\.ssh\id_ed25519_personal"
```

パスフレーズを設定すると接続のたびに入力を求められるが、`ssh-agent` サービスを
有効にすれば入力は初回のみになる（有効化には管理者権限が必要）。

```powershell
# 管理者権限の PowerShell で実行
Set-Service ssh-agent -StartupType Automatic
Start-Service ssh-agent

# 通常権限に戻って鍵を登録
ssh-add "$env:USERPROFILE\.ssh\id_ed25519_personal"
```

---

## PC を入れ替えるときの手順

原則: **秘密鍵は移行しない。新しい PC で作り直す。**

秘密鍵を USB メモリや共有フォルダで運ぶと、その経路がすべて漏洩リスクになる。
鍵の作成は数分で終わるので、運ぶのは鍵ではなく「設定内容」（本手順書）とする。

### 順序

```
新 PC で鍵を作成 → 接続確認 → 旧 PC の後始末
```

先に旧 PC の鍵を失効させると、新 PC の準備でつまずいたときに GitHub へ入れなくなる。
**新 PC で `Hi <個人アカウント名>!` が確認できてから**、旧 PC を片付ける。

### 新しい PC でやること

1. 本手順書のステップ1〜6を実行する
2. `~/.gitconfig` の会社／個人の切り替え設定を再現する

### 旧 PC を手放す前にやること

| # | 作業 | 場所 |
|---|---|---|
| 1 | **未 push のコミットがないか確認** | 各リポジトリで `git status` / `git log origin/main..HEAD` |
| 2 | **GitHub から旧 PC の公開鍵を削除** | <https://github.com/settings/keys>（GUI） |
| 3 | `.ssh` フォルダ内の鍵ファイルを削除 | `%USERPROFILE%\.ssh` |
| 4 | **資格情報マネージャーから GitHub の情報を削除** | コントロールパネル → ユーザーアカウント → 資格情報マネージャー → Windows 資格情報（GUI） |
| 5 | `gh` CLI からログアウト | `gh auth logout` |
| 6 | `.env` など秘密情報を含むファイルの確認 | 各プロジェクトフォルダ |

**2 が最も重要**。ローカルの鍵ファイルを削除しても、GitHub 側に公開鍵が残っていれば
その鍵は有効なままとなる。逆に GitHub 側さえ削除すれば、旧 PC に鍵ファイルが残っていても接続はできない。

鍵に `work-pc-2026` のような**どの PC のものか分かる名前**を付けておくのは、このときのため。
GitHub の鍵一覧には最終使用日も表示されるため、定期的な棚卸しにも使える。

### 2要素認証（2FA）に注意

PC 交換で最も困るのは鍵よりも 2FA。
GitHub の 2 要素認証に**その PC 上の認証アプリ**を使っている場合、PC を手放すとログインできなくなる。

リカバリーコードを PC 以外の場所（スマートフォンのパスワード管理アプリ、紙など）に保管しておく。

<https://github.com/settings/auth/recovery-codes>

スマートフォンの認証アプリを使っている場合は問題ない。

---

## 関連

- 会社アカウントと個人アカウントのコミット署名（`user.name` / `user.email`）の
  自動切り替えについては、Git の `includeIf` 設定を用いる（別途整備）
