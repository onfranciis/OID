import { Injectable } from '@nestjs/common';
import nunjucks from 'nunjucks';
import { join } from 'node:path';

export interface LoginPageModel {
  csrfToken: string;
  errorMessage?: string | null;
  email?: string | null;
  returnTo?: string | null;
}

@Injectable()
export class LoginPageService {
  private readonly environment: nunjucks.Environment;

  constructor() {
    this.environment = nunjucks.configure(
      join(process.cwd(), 'src/authentication/views'),
      {
        autoescape: true,
        noCache: true,
      },
    );
  }

  renderLoginPage(model: LoginPageModel): string {
    return this.environment.render('login.njk', model);
  }
}
