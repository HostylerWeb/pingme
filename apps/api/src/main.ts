import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { assertRequiredSecrets } from './common/utils/assert-required-secrets';
import { createCorsOriginDelegate, parseCorsOrigins } from './common/utils/cors.util';
import { getRunMode, shouldRunApi } from './common/utils/run-mode';
import { resolveSiteDir } from './common/utils/site-pages.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  assertRequiredSecrets(config, nodeEnv);
  const allowedOrigins = parseCorsOrigins(config.get<string>('CORS_ORIGINS'), nodeEnv);
  const uploadsDir = config.get<string>('UPLOADS_DIR', 'uploads');

  app.enableShutdownHooks();
  app.disable('x-powered-by');
  app.use(
    helmet({
      // API is JSON; CSP mainly matters for admin HTML / accidental doc hosts.
      contentSecurityPolicy: nodeEnv === 'production',
      crossOriginEmbedderPolicy: false,
      hsts:
        nodeEnv === 'production'
          ? { maxAge: 31536000, includeSubDomains: true, preload: false }
          : false,
    }),
  );

  const redisAdapter = new RedisIoAdapter(app, config);
  await redisAdapter.connectToRedis();
  app.useWebSocketAdapter(redisAdapter);

  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { limit: '10mb', extended: true });

  app.set('trust proxy', 1);

  app.useStaticAssets(join(process.cwd(), uploadsDir), {
    prefix: '/v1/uploads/',
  });
  // Legal pages: monorepo root cwd (prod systemd) or apps/api cwd (local)
  const legalCandidates = [
    join(process.cwd(), 'apps/api/public/legal'),
    join(process.cwd(), 'public/legal'),
    join(__dirname, '..', 'public', 'legal'),
  ];
  for (const legalDir of legalCandidates) {
    app.useStaticAssets(legalDir, { prefix: '/v1/legal/' });
  }

  const siteDir = resolveSiteDir();
  if (siteDir) {
    // Browser visits to https://host/ (outside /v1 prefix)
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get('/', (_req: Request, res: Response) => {
      res.type('html').sendFile(join(siteDir, 'index.html'));
    });
  }

  app.enableCors({
    origin: createCorsOriginDelegate(allowedOrigins, nodeEnv),
    credentials: true,
  });

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('PingMe API')
      .setDescription('Proximity social API')
      .setVersion('0.0.1')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.get<number>('PORT', 3000);
  const host = config.get<string>('HOST', '0.0.0.0');
  const runMode = getRunMode();

  if (shouldRunApi()) {
    await app.listen(port, host);
    app.getHttpServer().on('close', () => {
      void redisAdapter.close();
    });
    console.log(`API running on http://localhost:${port}/v1 (RUN_MODE=${runMode})`);
    if (nodeEnv !== 'production') {
      console.log(`Swagger docs at http://localhost:${port}/docs`);
    }
  } else {
    await app.init();
    console.log(`Worker mode active — HTTP API disabled (RUN_MODE=${runMode})`);
  }

  const quitRedis = () => {
    void redisAdapter.close();
  };
  process.once('SIGINT', quitRedis);
  process.once('SIGTERM', quitRedis);
}

bootstrap();
