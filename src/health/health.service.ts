import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getStatus(): Promise<{
    service: string;
    status: string;
    database: string;
  }> {
    let databaseStatus = 'down';

    try {
      await this.dataSource.query('SELECT 1');
      databaseStatus = 'up';
    } catch {
      databaseStatus = 'down';
    }

    return {
      service: 'internal-id',
      status: 'ok',
      database: databaseStatus,
    };
  }
}
