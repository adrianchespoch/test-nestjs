// k6 load smoke test — ejecutar post-deploy a staging para detectar regresiones de perf.
// Uso:
//   BASE_URL=https://api.staging.example.com k6 run scripts/smoke.k6.js
//
// Verifica:
//   - p95 latency en endpoints críticos
//   - error rate < 1%
//   - 100 RPS sostenidos durante 1 min

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    steady: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    errors: ['rate<0.01'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Liveness — debe ser sub-50ms
  const live = http.get(`${BASE}/api/health/live`);
  check(live, {
    'live status 200': (r) => r.status === 200,
    'live duration < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);

  // Readiness — más caro, toca DB+Redis
  const ready = http.get(`${BASE}/api/health/ready`);
  check(ready, {
    'ready status 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.1);
}
