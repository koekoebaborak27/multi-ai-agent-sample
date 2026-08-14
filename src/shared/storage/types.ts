/**
 * ファイルを取得するための一時的なURLの、既定の有効期限（秒）。
 *
 * このURLは知っている人なら誰でも開けてしまうため、
 * 画面を表示するたびに発行し直す前提で短くしている。
 * 長くすると、URLが誰かに共有されたり記録に残ったりしたときに、
 * 開ける状態が続く時間もそのまま延びてしまう。
 */
export const DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS = 60;

/**
 * ファイルの読み書きの取り決め。
 * ローカル保存と Supabase の保管場所が、どちらもこの形に合わせて作られているため、
 * 使う側は保存先の違いを意識せずに済む。
 */
export interface StorageClient {
  upload(path: string, data: Buffer, contentType?: string): Promise<void>;
  download(path: string): Promise<Buffer>;
  remove(path: string): Promise<void>;
  /**
   * ブラウザから直接ファイルを開くためのURLを発行する。
   * Supabase の場合は、外部から自由に見られない設定にしているため、
   * 期限付きのURLを発行してもらう必要があり、時間がかかる可能性がある。
   * ローカル保存の場合は期限という考え方が無いため、そのままの場所を返す。
   */
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
}
