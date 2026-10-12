import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getStatus(): Promise<{
    service: string;
    status: string;
    database: string;
  }> {
    const status = await this.healthService.getStatus();

    if (status.database !== 'up') {
      throw new ServiceUnavailableException(status);
    }

    return status;
  }
}
