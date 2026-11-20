import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as path from 'node:path';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { logAppStart, securityLogMiddleware } from './shared/infrastructure/security-log/security-log';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Registro de eventos de seguridad (tools/Seguridad/directrices-logs.md). Sin LOGS_DB_* queda apagado.
  app.use(securityLogMiddleware({ table: 'gestion_humana', service: 'gestion-humana-backend' }));
  const config = app.get(ConfigService<AppConfig, true>);
  const prefix = config.get('apiPrefix', { infer: true });

  app.setGlobalPrefix(prefix);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: config.get('corsOrigins', { infer: true }), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: false }));

  // Archivos subidos (imágenes de perfil, soportes, PDFs) servidos de forma estática.
  app.useStaticAssets(path.resolve(config.get('uploadsDir', { infer: true })), { prefix: '/uploads/' });

  const swagger = new DocumentBuilder()
    .setTitle('Gestión Humana Comfasucre — API')
    .setDescription('API REST del sistema de Gestión Humana. Arquitectura hexagonal sobre NestJS.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, swagger), {
    jsonDocumentUrl: `${prefix}/docs-json`,
  });

  const port = config.get('port', { infer: true });
  await app.listen(port);
  logAppStart();
  Logger.log(`API en http://localhost:${port}/${prefix} — docs en /${prefix}/docs`, 'Bootstrap');
}
void bootstrap();
