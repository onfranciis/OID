import { describe, expect, it } from 'vitest';

import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('renders request counters and duration totals in Prometheus format', () => {
    const metrics = new MetricsService();

    metrics.recordRequest({
      method: 'POST',
      route: '/oauth/token',
      statusCode: 200,
      durationSeconds: 0.125,
    });
    metrics.recordRequest({
      method: 'POST',
      route: '/oauth/token',
      statusCode: 200,
      durationSeconds: 0.375,
    });

    expect(metrics.renderPrometheus()).toContain(
      'internal_id_http_requests_total{method="POST",route="/oauth/token",status="200"} 2',
    );
    expect(metrics.renderPrometheus()).toContain(
      'internal_id_http_request_duration_seconds_total{method="POST",route="/oauth/token",status="200"} 0.500000',
    );
  });

  it('keeps status codes separated for the same route', () => {
    const metrics = new MetricsService();

    metrics.recordRequest({
      method: 'GET',
      route: '/login',
      statusCode: 200,
      durationSeconds: 0.01,
    });
    metrics.recordRequest({
      method: 'GET',
      route: '/login',
      statusCode: 500,
      durationSeconds: 0.02,
    });

    const output = metrics.renderPrometheus();

    expect(output).toContain(
      'internal_id_http_requests_total{method="GET",route="/login",status="200"} 1',
    );
    expect(output).toContain(
      'internal_id_http_requests_total{method="GET",route="/login",status="500"} 1',
    );
  });

  it('escapes Prometheus label values', () => {
    const metrics = new MetricsService();

    metrics.recordRequest({
      method: 'GET',
      route: '/quoted/"path"',
      statusCode: 404,
      durationSeconds: 0.01,
    });

    expect(metrics.renderPrometheus()).toContain(
      'internal_id_http_requests_total{method="GET",route="/quoted/\\"path\\"",status="404"} 1',
    );
  });
});
