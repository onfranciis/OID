import { Injectable } from '@nestjs/common';
import nunjucks from 'nunjucks';
import { join } from 'node:path';

export interface AdminIndexModel {
  displayName: string;
  csrfToken: string;
}

@Injectable()
export class AdminPageService {
  private readonly environment: nunjucks.Environment;

  constructor() {
    this.environment = nunjucks.configure(
      join(process.cwd(), 'src/admin/views'),
      {
        autoescape: true,
        noCache: true,
      },
    );
  }

  renderIndex(model: AdminIndexModel): string {
    return this.environment.render('index.njk', model);
  }
}
