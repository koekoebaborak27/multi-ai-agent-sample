/** 成功レスポンスのエンベロープ（REST API 共通形式） */
export interface ApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export function ok<T>(data: T, meta?: Record<string, unknown>): Response {
  const body: ApiSuccess<T> = meta ? { data, meta } : { data };
  return Response.json(body, { status: 200 });
}

export function created<T>(data: T): Response {
  return Response.json({ data } satisfies ApiSuccess<T>, { status: 201 });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}
