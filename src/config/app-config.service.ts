import { Injectable } from '@nestjs/common';
import {
  ConfigService,
  type ConfigGetOptions,
  type Path,
  type PathValue,
} from '@nestjs/config';
import type { AppEnvironment } from './app-environment';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<AppEnvironment>) {}

  get<P extends Path<AppEnvironment>>(
    path: P,
    options: ConfigGetOptions = { infer: true },
  ): Exclude<PathValue<AppEnvironment, P>, undefined> {
    return this.configService.getOrThrow(path, options);
  }
}
