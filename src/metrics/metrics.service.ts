import { Injectable } from '@nestjs/common';

interface RequestMetricKey {
  method: string;
  route: string;
  statusCode: number;
}

interface RequestMetricValue {
  count: number;
  durationSecondsTotal: number;
}

@Injectable()
export class MetricsService {
  private readonly requestMetrics = new Map<string, RequestMetricValue>();

  recordRequest(input: RequestMetricKey & { durationSeconds: number }): void {
    const key = serializeMetricKey(input);
    const existing = this.requestMetrics.get(key) ?? {
      count: 0,
      durationSecondsTotal: 0,
    };

    existing.count += 1;
    existing.durationSecondsTotal += input.durationSeconds;
    this.requestMetrics.set(key, existing);
  }

  renderPrometheus(): string {
    const lines = [
      '# HELP internal_id_http_requests_total Total HTTP requests.',
      '# TYPE internal_id_http_requests_total counter',
      ...[...this.requestMetrics.entries()].map(([key, value]) => {
        const labels = deserializeMetricKey(key);
        return `internal_id_http_requests_total{method="${escapeLabelValue(labels.method)}",route="${escapeLabelValue(labels.route)}",status="${labels.statusCode}"} ${value.count}`;
      }),
      '# HELP internal_id_http_request_duration_seconds_total Total HTTP request duration in seconds.',
      '# TYPE internal_id_http_request_duration_seconds_total counter',
      ...[...this.requestMetrics.entries()].map(([key, value]) => {
        const labels = deserializeMetricKey(key);
        return `internal_id_http_request_duration_seconds_total{method="${escapeLabelValue(labels.method)}",route="${escapeLabelValue(labels.route)}",status="${labels.statusCode}"} ${value.durationSecondsTotal.toFixed(6)}`;
      }),
    ];

    return `${lines.join('\n')}\n`;
  }
}

function serializeMetricKey(input: RequestMetricKey): string {
  return JSON.stringify({
    method: input.method,
    route: input.route,
    statusCode: input.statusCode,
  });
}

function deserializeMetricKey(value: string): RequestMetricKey {
  return JSON.parse(value) as RequestMetricKey;
}

function escapeLabelValue(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll('"', '\\"');
}
