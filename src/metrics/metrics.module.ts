import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [MetricsController],
  providers: [MetricsMiddleware, MetricsService],
  exports: [MetricsMiddleware, MetricsService],
})
export class MetricsModule {}
