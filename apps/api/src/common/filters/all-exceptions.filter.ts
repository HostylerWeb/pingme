import { Catch, ExceptionFilter, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { join } from 'path';
import {
  isNestRouteNotFoundMessage,
  prefersHtml,
  resolveSiteDir,
} from '../utils/site-pages.util';

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
    const request = ctx.getRequest<Request>();

    const status = getExceptionStatus(exception);

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    let message = getExceptionMessage(exception, exceptionResponse);
    const routeMissing = status === HttpStatus.NOT_FOUND && isNestRouteNotFoundMessage(message);

    if (routeMissing && prefersHtml(request.headers.accept)) {
      const siteDir = resolveSiteDir();
      if (siteDir) {
        response.status(status).type('html').sendFile(join(siteDir, 'not-found.html'));
        return;
      }
    }

    if (routeMissing) {
      message = 'Not found';
    }

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
