import "server-only";
import { env } from "@/shared/config/env";
import { localStorage } from "@/shared/storage/local";
import { supabaseStorage } from "@/shared/storage/supabase";
import type { StorageClient } from "@/shared/storage/types";

/**
 * ファイルの保存先を、環境変数の設定に応じて切り替える。
 * ローカル開発ではパソコン内のフォルダに、本番では Supabase のファイル保管場所に保存する。
 * 呼び出す側はどちらか意識せず、同じ書き方で読み書きできる。
 */
export const storage: StorageClient =
  env.STORAGE_TYPE === "supabase" ? supabaseStorage : localStorage;

export type { StorageClient } from "@/shared/storage/types";
