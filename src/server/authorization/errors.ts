export class AuthorizationError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 503,
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }

  get code(): string {
    switch (this.status) {
      case 400: return "INVALID_REQUEST";
      case 401: return "AUTHENTICATION_REQUIRED";
      case 403: return "PERMISSION_DENIED";
      case 404: return "NOT_FOUND";
      case 503: return "SERVICE_UNAVAILABLE";
    }
  }
}
