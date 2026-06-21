import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEventEntity } from '../database/entities/audit-event.entity';
import { AuditService } from './audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEventEntity])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
