import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { env } from "@/shared/config/env";
import type { StorageClient } from "@/shared/storage/types";

/**
 * 開発・動作確認のときに使う、パソコン内のフォルダへの保存。
 * 本番では Supabase の保管場所を使うため、こちらは使わない。
 */
export const localStorage: StorageClient = {
  // ファイルを保存する。保存先のフォルダがまだ無い場合は先に作る。
  async upload(path, data) {
    const full = join(env.STORAGE_LOCAL_DIR, path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
  },

  // ファイルの中身を読み込む
  async download(path) {
    return readFile(join(env.STORAGE_LOCAL_DIR, path));
  },

  // ファイルを削除する。すでに無い場合もエラーにしない。
  async remove(path) {
    await rm(join(env.STORAGE_LOCAL_DIR, path), { force: true });
  },

  /** ローカル保存には期限付きURLという考え方が無いため、そのままの場所を返す */
  async getSignedUrl(path) {
    return `/uploads/${path}`;
  },
};
