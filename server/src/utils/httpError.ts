import { StatusCodes } from "http-status-codes";

export class HttpError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }

  static badRequest(msg = "Bad request", details?: unknown) {
    return new HttpError(StatusCodes.BAD_REQUEST, msg, details);
  }
  static unauthorized(msg = "Unauthorized") {
    return new HttpError(StatusCodes.UNAUTHORIZED, msg);
  }
  static forbidden(msg = "Forbidden") {
    return new HttpError(StatusCodes.FORBIDDEN, msg);
  }
  static notFound(msg = "Not found") {
    return new HttpError(StatusCodes.NOT_FOUND, msg);
  }
  static conflict(msg = "Conflict") {
    return new HttpError(StatusCodes.CONFLICT, msg);
  }
}
