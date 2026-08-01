import "server-only";
import { env } from "@/shared/config/env";
import { AppError } from "@/shared/errors/app-error";
import type { StorageClient } from "@/shared/storage/types";

/** Supabase Storage の REST API（`@supabase/supabase-js` 非依存の最小実装）。 */
function requireConfig() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です");
  }
  return { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY };
}

function objectUrl(path: string): string {
  const { url } = requireConfig();
  return `${url}/storage/v1/object/${env.SUPABASE_STORAGE_BUCKET}/${path}`;
}

export const supabaseStorage: StorageClient = {
  async upload(path, data, contentType) {
    const { key } = requireConfig();
    const res = await fetch(objectUrl(path), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": contentType ?? "application/octet-stream",
        "x-upsert": "true",
      },
      body: new Uint8Array(data),
    });
    if (!res.ok) {
      throw new AppError("STORAGE_UPLOAD_FAILED", 502, "ファイルのアップロードに失敗しました", {
        status: res.status,
      });
    }
  },

  async download(path) {
    const { key } = requireConfig();
    const res = await fetch(objectUrl(path), {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      throw new AppError("STORAGE_DOWNLOAD_FAILED", 502, "ファイルの取得に失敗しました", {
        status: res.status,
      });
    }
    return Buffer.from(await res.arrayBuffer());
  },

  async remove(path) {
    const { key } = requireConfig();
    const res = await fetch(objectUrl(path), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      throw new AppError("STORAGE_DELETE_FAILED", 502, "ファイルの削除に失敗しました", {
        status: res.status,
      });
    }
  },

  getPublicUrl(path) {
    const { url } = requireConfig();
    return `${url}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/${path}`;
  },
};
