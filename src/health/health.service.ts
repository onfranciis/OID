import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getStatus(): { service: string; status: string } {
    return {
      service: 'internal-id',
      status: 'ok',
    };
  }
}
