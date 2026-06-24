import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { urlencoded } from 'express';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableShutdownHooks();
  app.use(urlencoded({ extended: false }));

  const configService = app.get(AppConfigService);
  const port = configService.get('app.port');
  const host = configService.get('app.host');

  await app.listen(port, host);
  logger.log(`Server started on ${await app.getUrl()}`);
}

void bootstrap();
