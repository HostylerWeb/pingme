import http from 'k6/http';
import { check, sleep } from 'k6';

// Simulates a connected mobile client using reduced polling (post WebSocket optimization).
// Adjust intervals to compare old vs new behavior.

export const options = {
  vus: 20,
  duration: '2m',
};

const baseUrl = __ENV.API_URL ?? 'https://pingme.hostyler.cloud/v1';
const token = __ENV.ACCESS_TOKEN;

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

export default function pollingSim() {
  if (!token) {
    throw new Error('Set ACCESS_TOKEN env var (valid JWT)');
  }

  // Optimized: chats only when WS disconnected — simulate fallback poll every 15s
  const chats = http.get(`${baseUrl}/chats`, { headers });
  check(chats, { 'chats ok': (r) => r.status === 200 });

  // Icebreaker status slow poll when WS connected (60s) — k6 sleeps between iterations
  const status = http.get(`${baseUrl}/icebreaker/status`, { headers });
  check(status, { 'icebreaker status ok': (r) => r.status === 200 });

  sleep(15);
}
