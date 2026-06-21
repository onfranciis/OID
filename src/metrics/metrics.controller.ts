import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  metrics(@Res() res: Response): void {
    res
      .type('text/plain; version=0.0.4')
      .send(this.metricsService.renderPrometheus());
  }
}
