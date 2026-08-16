import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { assertRequiredSecrets } from './common/utils/assert-required-secrets';
import { createCorsOriginDelegate, parseCorsOrigins } from './common/utils/cors.util';
import { getRunMode, shouldRunApi } from './common/utils/run-mode';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  assertRequiredSecrets(config, nodeEnv);
  const allowedOrigins = parseCorsOrigins(config.get<string>('CORS_ORIGINS'), nodeEnv);
  const uploadsDir = config.get<string>('UPLOADS_DIR', 'uploads');

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
    console.log(`API running on http://localhost:${port}/v1 (RUN_MODE=${runMode})`);
    console.log(`Swagger docs at http://localhost:${port}/docs`);
  } else {
    await app.init();
    console.log(`Worker mode active — HTTP API disabled (RUN_MODE=${runMode})`);
  }
}

bootstrap();
