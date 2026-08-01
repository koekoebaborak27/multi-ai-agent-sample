import "server-only";
import { env } from "@/shared/config/env";
import { localStorage } from "@/shared/storage/local";
import { supabaseStorage } from "@/shared/storage/supabase";
import type { StorageClient } from "@/shared/storage/types";

/** `STORAGE_TYPE` に応じてローカル/Supabase Storage を切り替える（設計メモ §8）。 */
export const storage: StorageClient =
  env.STORAGE_TYPE === "supabase" ? supabaseStorage : localStorage;

export type { StorageClient } from "@/shared/storage/types";
