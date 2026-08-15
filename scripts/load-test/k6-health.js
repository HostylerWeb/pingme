import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const baseUrl = __ENV.API_URL ?? 'https://pingme.hostyler.cloud/v1';

export default function healthCheck() {
  const response = http.get(`${baseUrl}/health`);
  check(response, {
    'status is 200': (r) => r.status === 200,
    'body has ok': (r) => r.body.includes('"status":"ok"'),
  });
  sleep(1);
}
