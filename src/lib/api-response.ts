/**
 * Route Handlers で使うレスポンス・入力検証のヘルパー。
 * エラーは必ず { error: { code, message } } の形で返す（docs/api.md 参照）。
 */
import { NextResponse } from "next/server";
import type { z } from "zod";
import type { ApiError } from "@/lib/schemas";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json<ApiError>({ error: { code, message } }, { status });
}

export function notImplemented(owner: string) {
  return apiError(501, "not_implemented", `未実装です（担当: ${owner}）`);
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse<ApiError> };

export async function parseJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<ParseResult<z.infer<S>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: apiError(400, "invalid_json", "JSON を解析できません") };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      response: apiError(
        400,
        "validation_error",
        result.error.issues[0]?.message ?? "入力が不正です",
      ),
    };
  }
  return { ok: true, data: result.data };
}
