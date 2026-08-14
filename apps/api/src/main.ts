import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createCorsOriginDelegate, parseCorsOrigins } from './common/utils/cors.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const allowedOrigins = parseCorsOrigins(config.get<string>('CORS_ORIGINS'), nodeEnv);

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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PingMe API')
    .setDescription('Proximity social API')
    .setVersion('0.0.1')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('PORT', 3000);
  const host = config.get<string>('HOST', '0.0.0.0');
  await app.listen(port, host);

  console.log(`API running on http://localhost:${port}/v1`);
  console.log(`Swagger docs at http://localhost:${port}/docs`);
}

bootstrap();
