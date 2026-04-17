/**
 * Polls until an HTTP endpoint returns 2xx (default: Next `/api/auth/providers`).
 * Used by CI after `next start` — avoids fixed sleeps only.
 *
 * Env: `WAIT_URL` (optional), `WAIT_MAX_ATTEMPTS` (default 60), `WAIT_MS` between attempts (default 2000).
 */
const url = process.env.WAIT_URL ?? "http://127.0.0.1:3000/api/auth/providers";
const maxAttempts = Number.parseInt(process.env.WAIT_MAX_ATTEMPTS ?? "60", 10);
const delayMs = Number.parseInt(process.env.WAIT_MS ?? "2000", 10);

for (let i = 0; i < maxAttempts; i++) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    if (res.ok) {
      console.log(`[wait-for-http] OK after ${i + 1} attempt(s): ${url}`);
      process.exit(0);
    }
    console.log(`[wait-for-http] attempt ${i + 1}/${maxAttempts} status ${res.status}`);
  } catch (e) {
    console.log(`[wait-for-http] attempt ${i + 1}/${maxAttempts} error: ${String(e)}`);
  }
  await new Promise((r) => setTimeout(r, delayMs));
}

console.error(`[wait-for-http] Timed out waiting for ${url}`);
process.exit(1);
