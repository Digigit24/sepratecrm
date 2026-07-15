// scripts/webrtcAudit.mjs — count webrtc-config requests on dashboard load
// when the backend answers 424 (TeleCMI not configured).
// Usage: node scripts/webrtcAudit.mjs <projectDir> <port>
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const projectDir = process.argv[2];
const port = Number(process.argv[3] || 4175);

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const fakeJwt = `${b64url({ alg: 'none' })}.${b64url({
  exp: Math.floor(Date.now() / 1000) + 86400, tenant_id: 't1', tenant_slug: 't',
  enabled_modules: ['crm', 'whatsapp', 'admin', 'integrations', 'telephony'],
})}.sig`;
const fakeUser = {
  id: 'u1', _uid: 'u1', email: 'qa@test.local',
  tenant: { id: 't1', name: 'T', slug: 't', enabled_modules: ['crm', 'whatsapp', 'admin', 'integrations', 'telephony'], whatsapp_vendor_uid: 'VEND1', whatsapp_api_token: 'tok', settings: {} },
  preferences: {},
};

const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: projectDir, stdio: 'pipe' });
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  try { const r = await fetch(`http://localhost:${port}/`); up = r.status < 500; }
  catch { await new Promise((r) => setTimeout(r, 500)); }
}
if (!up) { preview.kill('SIGKILL'); throw new Error('preview did not start'); }

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript(([jwt, user]) => {
  localStorage.setItem('celiyo_access_token', jwt);
  localStorage.setItem('celiyo_refresh_token', jwt);
  localStorage.setItem('celiyo_user', JSON.stringify(user));
}, [fakeJwt, fakeUser]);

let webrtcCount = 0;
const consoleErrors = [];
await context.route('**/*', async (route) => {
  const url = route.request().url();
  if (url.startsWith(`http://localhost:${port}`) || url.startsWith('data:')) return route.continue();
  if (url.startsWith('ws') || url.includes('pusher') || url.includes('broadcasting')) return route.abort();
  if (url.includes('webrtc-config')) {
    webrtcCount++;
    return route.fulfill({ status: 424, contentType: 'application/json', body: JSON.stringify({ error: 'TeleCMI is not configured for this tenant' }) });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [], next: null, data: [] }) });
});

const page = await context.newPage();
page.on('console', (msg) => {
  // Count only APP-emitted console errors. "Failed to load resource" is the
  // browser's own network log for any non-2xx response — it cannot be
  // suppressed from JS and only disappears when no request is made at all.
  if (
    msg.type() === 'error' &&
    /webrtc|telephony|424/i.test(msg.text()) &&
    !msg.text().startsWith('Failed to load resource')
  ) {
    consoleErrors.push(msg.text().slice(0, 200));
  }
});

await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
// Wait long enough to catch SWR error-retry attempts (5s interval, x3)
await page.waitForTimeout(18000);
const firstLoad = webrtcCount;
const firstLoadConsoleErrors = consoleErrors.length;

// Second load in the same session (navigation/remount) — with the session
// "not configured" flag this must be ZERO requests.
webrtcCount = 0;
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
const secondLoad = webrtcCount;

console.log(JSON.stringify({
  firstLoad: { webrtcConfigRequests: firstLoad, appConsoleErrors: firstLoadConsoleErrors },
  secondLoadSameSession: { webrtcConfigRequests: secondLoad },
  samples: consoleErrors.slice(0, 5),
}, null, 2));

await browser.close();
preview.kill('SIGKILL');
setTimeout(() => process.exit(0), 500);
