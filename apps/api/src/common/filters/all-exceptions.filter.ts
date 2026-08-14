import { Catch, ExceptionFilter, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

function getExceptionStatus(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }

  if (
    typeof exception === 'object' &&
    exception !== null &&
    'type' in exception &&
    (exception as { type?: string }).type === 'entity.too.large'
  ) {
    return HttpStatus.PAYLOAD_TOO_LARGE;
  }

  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function getExceptionMessage(exception: unknown, exceptionResponse: unknown): string {
  if (
    typeof exception === 'object' &&
    exception !== null &&
    'type' in exception &&
    (exception as { type?: string }).type === 'entity.too.large'
  ) {
    return 'Uploaded file is too large';
  }

  const message =
    typeof exceptionResponse === 'string'
      ? exceptionResponse
      : (exceptionResponse as { message?: string | string[] }).message ?? 'Error';

  return Array.isArray(message) ? message.join(', ') : message;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = getExceptionStatus(exception);

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    const message = getExceptionMessage(exception, exceptionResponse);

    const customCode =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as { code?: string }).code
        : undefined;

    response.status(status).json({
      success: false,
      error: {
        code: customCode ?? HttpStatus[status],
        message,
      },
    });
  }
}
