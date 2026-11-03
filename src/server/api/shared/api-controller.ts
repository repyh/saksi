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
  ): Promise<Response> {
    try {
      return apiSuccess(await operation());
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

      return apiFailure(unexpectedError.code, unexpectedError.message, 500);
    }
  }
}
