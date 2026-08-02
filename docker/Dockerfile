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

# 実行時に使わないものをここで落とす（runner は build の成果物をコピーするだけなので、
# runner 側で消してもレイヤは減らない。必ず build ステージ内で削る）。
#  - .next/cache : 次回ビルドを速くするための中間生成物。実行には不要
#  - devDependencies : typescript / eslint / vitest / prisma CLI 等。実行時に一切使わない
# prisma generate 済みの成果物（node_modules 配下の生成クライアントとクエリエンジン）は
# @prisma/client が dependencies 側にあるため prune 後も残る（起動確認で担保する）。
RUN rm -rf .next/cache \
  && pnpm prune --prod
# musl 向けのネイティブバイナリを落とす。ベースイメージは bookworm-slim（glibc）で、
# @next/swc・rolldown・sharp は gnu 版だけを読み込むため musl 版は絶対に使われない
# （pnpm は optionalDependencies として両方の libc 版を配置する）。
# 変更は本番イメージ内で閉じており、package.json も lockfile も触らないので
# ローカル開発・CI のインストール結果には影響しない。
RUN rm -rf node_modules/.pnpm/*musl*

# ── runner: 実行環境（app / worker 共用）──
# NOTE: node_modules は build ステージで devDependencies を落としたものを持ち込み、
#       app=next / worker=tsx の両立を保つ（tsx / pg-boss / @node-rs/argon2 は dependencies 側）。
#       `output: "standalone"` によるさらなるスリム化は、worker 用イメージを
#       runner から分離する段階で併せて検討する（docs/todo/TODO.md）。
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

EXPOSE 3000
# 実行ファイルを直接起動する。`pnpm start` 経由だと corepack → pnpm → next CLI と
# 3 段プロセスを挟むぶん起動が遅く、pnpm 実体をイメージに抱える必要も出るため。
# worker は同じ要領で `./node_modules/.bin/tsx src/worker/index.ts` に差し替える
# （`pnpm worker` は --env-file=.env を渡すため、.env を持たない本番では使えない）。
CMD ["./node_modules/.bin/next", "start"]
