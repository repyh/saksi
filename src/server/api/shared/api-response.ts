import "server-only";
import type { ApiResult } from "@/contracts/shared/api.contract";

export function apiSuccess<T>(data: T, status = 200): Response {
  const result: ApiResult<T> = { data, error: null };
  return Response.json(result, { status });
}

export function apiFailure(code: string, message: string, status: number): Response {
  const result: ApiResult<never> = {
    data: null,
    error: { code, message },
  };
  return Response.json(result, { status });
}
