import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { join } from 'path';
import { Public } from '../common/decorators/public.decorator';
import { prefersHtml, resolveSiteDir } from '../common/utils/site-pages.util';

/** Friendly responses for GET /v1 (global prefix root). */
@ApiExcludeController()
@SkipThrottle()
@Controller()
export class SiteController {
  @Public()
  @Get()
  root(@Req() req: Request, @Res() res: Response) {
    if (prefersHtml(req.headers.accept)) {
      const siteDir = resolveSiteDir();
      if (siteDir) {
        return res.type('html').sendFile(join(siteDir, 'index.html'));
      }
    }

    return res.json({
      success: true,
      data: {
        name: 'PingMe API',
        version: 'v1',
      },
    });
  }
}
