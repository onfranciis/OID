import { describe, expect, it } from 'vitest';
import { LoginPageService } from './login-page.service';

describe('LoginPageService', () => {
  it('escapes user-controlled login page values', () => {
    const service = new LoginPageService();
    const html = service.renderLoginPage({
      csrfToken: '<script>alert("csrf")</script>',
      errorMessage: '<img src=x onerror=alert(1)>',
      returnTo: '"><script>alert("return")</script>',
      email: '<script>alert("email")</script>',
    });

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x');
  });
});
