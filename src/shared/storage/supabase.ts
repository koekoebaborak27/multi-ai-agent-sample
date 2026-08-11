import "server-only";
import { env } from "@/shared/config/env";
import { AppError } from "@/shared/errors/app-error";
import { DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS, type StorageClient } from "@/shared/storage/types";

// Supabase のファイル保管場所とのやり取り。
// 専用の追加ライブラリは使わず、必要な通信だけを自分で組み立てている（依存を増やさないため）。

/** 接続に必要な設定が揃っているか確かめ、揃っていればその値を返す */
function requireConfig() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です");
  }
  return { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY };
}

/**
 * 通信時に添える、自分が誰かを示す情報。
 *
 * 同じ鍵を Authorization と apikey の2か所に入れて送っている。
 * 新しい形式の鍵は Authorization だけで送ると Supabase 側が読み取りに失敗し、
 * すべての操作が拒否されてしまう。apikey も一緒に送ると正しく認識される。
 * 古い形式の鍵でも、両方送って問題なく動く。
 */
function authHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}`, apikey: key };
}

/** ファイルそのものを読み書きするための通信先を組み立てる */
function objectUrl(path: string): string {
  const { url } = requireConfig();
  return `${url}/storage/v1/object/${env.SUPABASE_STORAGE_BUCKET}/${path}`;
}

/** 期限付きURLの発行を依頼するための通信先を組み立てる */
function signUrl(path: string): string {
  const { url } = requireConfig();
  return `${url}/storage/v1/object/sign/${env.SUPABASE_STORAGE_BUCKET}/${path}`;
}

export const supabaseStorage: StorageClient = {
  // ファイルを保存する。同じ場所に既にファイルがあれば上書きする。
  async upload(path, data, contentType) {
    const { key } = requireConfig();
    const res = await fetch(objectUrl(path), {
      method: "POST",
      headers: {
        ...authHeaders(key),
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

  // ファイルの中身を取得する
  async download(path) {
    const { key } = requireConfig();
    const res = await fetch(objectUrl(path), {
      headers: authHeaders(key),
    });
    if (!res.ok) {
      throw new AppError("STORAGE_DOWNLOAD_FAILED", 502, "ファイルの取得に失敗しました", {
        status: res.status,
      });
    }
    return Buffer.from(await res.arrayBuffer());
  },

  // ファイルを削除する
  async remove(path) {
    const { key } = requireConfig();
    const res = await fetch(objectUrl(path), {
      method: "DELETE",
      headers: authHeaders(key),
    });
    if (!res.ok) {
      throw new AppError("STORAGE_DELETE_FAILED", 502, "ファイルの削除に失敗しました", {
        status: res.status,
      });
    }
  },

  /**
   * ブラウザからファイルを開くための、期限付きURLを発行してもらう。
   *
   * 保管場所は外部から自由に見られない設定にしているため、
   * 誰でも開ける形のURLを使おうとしても拒否される。必ずこの方法で発行する。
   * 返ってくるURLは途中までしか含まれていないため、前半を補って完全な形にしてから返す。
   */
  async getSignedUrl(path, expiresInSeconds = DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS) {
    const { url, key } = requireConfig();
    const res = await fetch(signUrl(path), {
      method: "POST",
      headers: { ...authHeaders(key), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });
    if (!res.ok) {
      throw new AppError("STORAGE_SIGNED_URL_FAILED", 502, "ファイルURLの発行に失敗しました", {
        status: res.status,
      });
    }
    const body = (await res.json()) as { signedURL?: string };
    if (!body.signedURL) {
      throw new AppError("STORAGE_SIGNED_URL_FAILED", 502, "ファイルURLの発行に失敗しました", {
        reason: "signedURL が応答に含まれていません",
      });
    }
    // 返ってくる値の先頭に「/」が付く場合と付かない場合があるため、どちらでも同じ形に整える
    const relative = body.signedURL.startsWith("/") ? body.signedURL : `/${body.signedURL}`;
    return `${url}/storage/v1${relative}`;
  },
};
