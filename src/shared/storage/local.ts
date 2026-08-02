import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { env } from "@/shared/config/env";
import type { StorageClient } from "@/shared/storage/types";

/** 開発・検証用のローカルファイルシステム保存。本番では使わない（本番は Supabase Storage）。 */
export const localStorage: StorageClient = {
  async upload(path, data) {
    const full = join(env.STORAGE_LOCAL_DIR, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
  },

  async download(path) {
    return readFile(join(env.STORAGE_LOCAL_DIR, path));
  },

  async remove(path) {
    await rm(join(env.STORAGE_LOCAL_DIR, path), { force: true });
  },

  /** ローカル保存に署名の概念はないため、静的パスをそのまま返す（有効期限は無視する）。 */
  async getSignedUrl(path) {
    return `/uploads/${path}`;
  },
};
