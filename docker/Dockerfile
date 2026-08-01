# syntax=docker/dockerfile:1

# ── base: pnpm を有効化した Node ベースイメージ ──
FROM node:22-bookworm-slim AS base
# bookworm-slim には openssl が無く、Prisma engine が libssl を検出できず
# openssl-1.1.x にフォールバックして DB への TLS 接続が壊れる恐れがあるため明示的に入れる
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ── deps: 依存インストール（lockfile 固定）──
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── dev: ローカル開発用（ソースは docker-compose のバインドマウントで供給）──
FROM deps AS dev
ENV NODE_ENV=development
EXPOSE 3000
CMD ["pnpm", "dev"]

# ── build: Prisma Client 生成 + Next ビルド ──
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
# リポジトリに public/ が無くても runner ステージの COPY が失敗しないよう確保する
RUN mkdir -p public
# next build はページデータ収集で env.ts（DATABASE_URL 必須チェック）を評価するため、
# .env を持たない build ステージにはダミー値を与える（実行時の値は ECS / compose が注入）
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm build

# ── runner: 実行環境（app / worker 共用）──
# NOTE: 簡潔さ優先で node_modules を丸ごと持ち込み、app=next start / worker=tsx を両立。
#       standalone 出力による node_modules スリム化は将来のフォローアップ。
FROM base AS runner
ENV NODE_ENV=production
# 非 root（node ユーザー）で実行するため所有権を付けてコピーする
# （.next は next start が cache 等を書き込むため書き込み権限が必要）
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/.next ./.next
COPY --chown=node:node --from=build /app/public ./public
COPY --chown=node:node --from=build /app/src ./src
COPY --chown=node:node --from=build /app/prisma ./prisma
COPY --chown=node:node --from=build /app/package.json ./package.json
COPY --chown=node:node --from=build /app/tsconfig.json ./tsconfig.json
COPY --chown=node:node --from=build /app/next.config.ts ./next.config.ts

# コンテナ侵害時の影響を限定するため非 root で実行
USER node
# packageManager の pnpm 実体をイメージ内にキャッシュし、
# コンテナ起動のたびに corepack がレジストリへ取得しに行くのを防ぐ
RUN corepack install

EXPOSE 3000
# app の既定起動コマンド。worker は compose/ECS 側で `pnpm worker` に差し替える。
CMD ["pnpm", "start"]
