/** ファイル保存の抽象インターフェース（ローカル/Supabase Storage を切り替える） */
export interface StorageClient {
  upload(path: string, data: Buffer, contentType?: string): Promise<void>;
  download(path: string): Promise<Buffer>;
  remove(path: string): Promise<void>;
  /** 公開URL（署名なし）。非公開バケットの場合は呼び出し元で署名URL発行に置き換える */
  getPublicUrl(path: string): string;
}
