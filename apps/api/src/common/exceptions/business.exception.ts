import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Business-level exception with a structured error code + optional details.
 *
 * Use this instead of throwing generic NestJS exceptions when an error
 * represents a known business rule violation (e.g. insufficient stock,
 * invalid transfer state, document already registered).
 *
 * The AllExceptionsFilter picks up the errorCode and serialises the response
 * according to the shared ApiError shape in @kardex/types.
 */
export class BusinessException extends HttpException {
  public readonly errorCode: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    errorCode: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, unknown>,
  ) {
    super(message, status);
    this.errorCode = errorCode;
    this.details = details;
  }
}
