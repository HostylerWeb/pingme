import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '1m',
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

const baseUrl = __ENV.API_URL ?? 'https://pingme.hostyler.cloud/v1';
const email = __ENV.TEST_EMAIL;
const password = __ENV.TEST_PASSWORD;

export default function authFlow() {
  if (!email || !password) {
    throw new Error('Set TEST_EMAIL and TEST_PASSWORD env vars');
  }

  const login = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(login, { 'login ok': (r) => r.status === 200 || r.status === 201 });

  const body = login.json();
  const refreshToken = body?.refreshToken;
  if (refreshToken) {
    const refresh = http.post(
      `${baseUrl}/auth/refresh`,
      JSON.stringify({ refreshToken }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    check(refresh, { 'refresh ok': (r) => r.status === 200 || r.status === 201 });
  }

  sleep(2);
}
