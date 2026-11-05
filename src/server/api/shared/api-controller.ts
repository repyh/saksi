import "server-only";
import { AuthorizationError } from "@/server/authorization/errors";
import { ApiError } from "./api-error";
import { apiFailure, apiSuccess } from "./api-response";

type UnexpectedError = {
  code: string;
  message: string;
};

/** Shared transport behavior for domain API classes. Domain policy stays in each API. */
export abstract class ApiController {
  protected async respond<T>(
    operation: () => Promise<T>,
    unexpectedError: UnexpectedError,
    successStatus = 200,
    mapUnexpectedError?: (error: unknown) => ApiError | undefined,
  ): Promise<Response> {
    try {
      return apiSuccess(await operation(), successStatus);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return apiFailure(
          error.status === 401 ? "AUTHENTICATION_REQUIRED" : "PERMISSION_DENIED",
          error.message,
          error.status,
        );
      }

      if (error instanceof ApiError) {
        return apiFailure(error.code, error.message, error.status);
      }

      const mappedError = mapUnexpectedError?.(error);
      if (mappedError) return apiFailure(mappedError.code, mappedError.message, mappedError.status);

      return apiFailure(unexpectedError.code, unexpectedError.message, 500);
    }
  }
}
