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

  await prisma.news.upsert({
    where: { id: "seed-master-update-20260818" },
    update: {
      title: "システムアップデート",
      body: "マスタ管理画面をアップデートしました。\n一覧・登録・更新・削除・CSVダウンロードなど一般的な画面構成に変更しました。\nまた、Node.jsのexcel.jsを利用したEXCELダウンロードの機能を追加しました。本機能は\n別サーバで処理することで処理に時間がかかってもシステムに影響を与えない仕組みにしています。",
      category: "NEWS",
      createdAt: new Date("2026-08-18T20:00:00+09:00"),
    },
    create: {
      id: "seed-master-update-20260818",
      title: "システムアップデート",
      body: "マスタ管理画面をアップデートしました。\n一覧・登録・更新・削除・CSVダウンロードなど一般的な画面構成に変更しました。\nまた、Node.jsのexcel.jsを利用したEXCELダウンロードの機能を追加しました。本機能は\n別サーバで処理することで処理に時間がかかってもシステムに影響を与えない仕組みにしています。",
      category: "NEWS",
      createdBy: adminId,
      updatedBy: adminId,
      createdAt: new Date("2026-08-18T20:00:00+09:00"),
    },
  });

  await prisma.news.upsert({
    where: { id: "seed-welcome" },
    update: {
      title: "サンプル契約管理システムをリリースしました。",
      body: "本システムはClaudeCode、Codex、gitHubCopilotによるマルチAI開発を行う上での開発基盤となるサンプルシステムです。\nまずはサンプルプログラムのREADME.mdなどをご確認ください。",
      category: "NEWS",
      createdAt: new Date("2026-08-10T19:00:00+09:00"),
    },
    create: {
      id: "seed-welcome",
      title: "サンプル契約管理システムをリリースしました。",
      body: "本システムはClaudeCode、Codex、gitHubCopilotによるマルチAI開発を行う上での開発基盤となるサンプルシステムです。\nまずはサンプルプログラムのREADME.mdなどをご確認ください。",
      category: "NEWS",
      createdBy: adminId,
      updatedBy: adminId,
      createdAt: new Date("2026-08-10T19:00:00+09:00"),
    },
  });

  // 契約先・契約が分類を選ぶマスタ分類の初期データ。
  // ここで使う分類コードの値は src/modules/party/types.ts の PARTY_COMPANY_TYPE_CATEGORY_CODE、
  // src/modules/contract/types.ts の CONTRACT_CATEGORY_MASTER_CATEGORY_CODE と必ず一致させること
  // （アプリ側はこの文字列を手がかりに対象のマスタ分類を検索する）。
  await prisma.masterCategory.upsert({
    where: { code: "CONTRACT_COMPANY_TYPE" },
    update: {},
    create: { code: "CONTRACT_COMPANY_TYPE", name: "契約先分類" },
  });
  await prisma.masterCategory.upsert({
    where: { code: "CONTRACT_TYPE" },
    update: {},
    create: { code: "CONTRACT_TYPE", name: "契約分類" },
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
