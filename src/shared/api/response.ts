/**
 * 外部連携用の窓口が成功したときに返す、共通の形。
 * 中身を必ず data の中に入れるのは、後から補足情報を足しても
 * 呼び出し側の読み取り方が変わらないようにするため。
 */
export interface ApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/** 取得・更新が成功したときの応答を返す */
export function ok<T>(data: T, meta?: Record<string, unknown>): Response {
  const body: ApiSuccess<T> = meta ? { data, meta } : { data };
  return Response.json(body, { status: 200 });
}

/** 新しく登録できたときの応答を返す。取得の成功とは別の番号で区別する */
export function created<T>(data: T): Response {
  return Response.json({ data } satisfies ApiSuccess<T>, { status: 201 });
}

/** 成功したが返す中身が無いとき（削除など）の応答を返す */
export function noContent(): Response {
  return new Response(null, { status: 204 });
}
