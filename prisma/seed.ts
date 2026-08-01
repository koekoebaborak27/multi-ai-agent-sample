import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

// Argon2id の推奨パラメータ（OWASP 準拠の控えめな設定）
const ARGON2_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

async function main() {
  const adminId = "admin";
  const initialPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123";
  const passwordHash = await hash(initialPassword, ARGON2_OPTS);

  await prisma.user.upsert({
    where: { id: adminId },
    update: {},
    create: {
      id: adminId,
      role: "ADMIN",
      passwordHash,
      mustChangePassword: true, // 初回ログイン時にパスワード変更を強制
      displayName: "初期管理者",
    },
  });

  await prisma.announcement.upsert({
    where: { id: "seed-welcome" },
    update: {},
    create: {
      id: "seed-welcome",
      title: "ようこそ",
      body: "開発基盤のセットアップが完了しました。",
    },
  });

  console.log(`Seed 完了: 初期ADMIN(${adminId}) / 初期PW=${initialPassword}（要変更）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
