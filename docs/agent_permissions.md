# エージェント権限ポリシー（正本）

Claude Code / Codex / GitHub Copilot が**確認なしで実行してよいコマンド**と**実行してはならない操作**を定める。
ポリシーの正本はこのファイルのみ。各ツールの設定ファイルはこの表を機械可読な形へ写しただけの入口であり、**内容を変えるときはまずこのファイルを直す**。

## 許可（確認なしで実行してよい）

| 分類 | コマンド | 理由 |
|---|---|---|
| 依存 | `pnpm install` | ネットワークアクセスを伴うが、副作用は `node_modules/` に閉じる |
| 検証 | `pnpm lint` / `pnpm format:check` / `pnpm typecheck` | 読み取りのみ |
| 検証 | `pnpm test` / `pnpm test:*` | 読み取りのみ（DB を破壊しない） |
| ビルド | `pnpm build` / `pnpm prisma:generate` | 生成物のみ |
| DB（ローカル） | `docker compose -f docker/docker-compose.yml up` / `ps` / `logs` | ローカル開発 DB の起動・状態確認 |
| Git（読み取り） | `git status` / `git diff` / `git log` / `git show` / `git branch` | 読み取りのみ |

## 禁止（エージェントが単独で実行してはならない）

| 対象 | 理由 |
|---|---|
| `.env` の読み取り | 実クレデンシャルを含む。参照が必要なら `.env.example` を見る |
| `pnpm db:reset*` | 開発 DB を破壊する |
| `prisma migrate reset*` | マイグレーション履歴とデータを破壊する |
| `git push --force*` | リモート履歴を破壊する |
| `git reset --hard*` | 未コミットの変更を破壊する |

上記に加えて、`AGENTS.md` の最小規約どおり **`main` への直接 push はドキュメント（`*.md` / `docs/`）のみ**、CI スキップ push は `docs/skills/push-skip-ci.md` に従いユーザー承認を得ること。

## ツールごとの適用先

| ツール | 設定ファイル | 強制の仕方 |
|---|---|---|
| Claude Code | `.claude/settings.json` | `permissions.allow` / `permissions.deny` でコマンド単位に強制 |
| GitHub Copilot（VS Code Agent モード） | `.vscode/settings.json` の `chat.tools.terminal.autoApprove` | 正規表現ルール。`true` = 自動承認、`false` = 常に手動承認 |
| Codex CLI | `.codex/config.toml` | `sandbox_mode` / `approval_policy` による面での制御。**コマンド単位の allow/deny は持たない**ため、上表の禁止事項は `AGENTS.md` の規約として遵守する |

### 注意点

- Copilot の `false` ルールは「常に確認を出す」であり、実行の禁止ではない。**確認された人間が拒否することで初めて禁止が成立する。**
- Codex はプロジェクト設定 `.codex/config.toml` を、そのプロジェクトを **trusted** として承認した場合のみ読み込む。初回起動時の信頼確認で承認していないと設定は効かない。
- 3 ツールとも粒度が異なるため完全な等価にはならない。**強制力の弱いツールほど、この文書の禁止リストを規約として守ることが重要になる。**
