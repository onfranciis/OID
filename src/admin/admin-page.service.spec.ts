import { describe, expect, it } from 'vitest';
import { AdminPageService } from './admin-page.service';

describe('AdminPageService', () => {
  it('escapes user-controlled admin display names', () => {
    const service = new AdminPageService();
    const html = service.renderIndex({
      displayName: '<script>alert("admin")</script>',
      csrfToken: 'csrf-token',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert');
  });
});
