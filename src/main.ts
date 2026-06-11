import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableShutdownHooks();
  app.use(urlencoded({ extended: false }));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 3000;
  const host = configService.get<string>('app.host') ?? '0.0.0.0';

  await app.listen(port, host);
}

void bootstrap();
