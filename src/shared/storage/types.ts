/**
 * 署名 URL の既定の有効期限（秒）。
 * 署名 URL は「URL を知っていれば誰でも開ける」ため、画面表示のたびに発行し直す前提で短く保つ。
 * 長くすると、リンクが共有・ログ記録された場合の露出時間がそのまま延びる。
 */
export const DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS = 60;

/** ファイル保存の抽象インターフェース（ローカル/Supabase Storage を切り替える） */
export interface StorageClient {
  upload(path: string, data: Buffer, contentType?: string): Promise<void>;
  download(path: string): Promise<Buffer>;
  remove(path: string): Promise<void>;
  /**
   * ブラウザから直接ファイルを取得できる URL を発行する。
   * Supabase の非公開バケットでは有効期限付きの署名 URL を発行するため非同期。
   * ローカル保存には署名の概念がないため、静的パスをそのまま返す（有効期限は無視される）。
   */
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
}
