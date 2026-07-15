// scripts/requestAudit.mjs
// Runtime request-count verification harness.
// Serves a built dist/ via `vite preview`, drives it with Playwright, mocks
// EVERY backend endpoint, and counts requests per bucket for each scenario.
//
// Usage: node scripts/requestAudit.mjs <projectDir> <port>
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const projectDir = process.argv[2];
const port = Number(process.argv[3] || 4173);

// ── Fake auth data ───────────────────────────────────────────────────────────
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const fakeJwt = `${b64url({ alg: 'none' })}.${b64url({
  exp: Math.floor(Date.now() / 1000) + 86400,
  tenant_id: 't1',
  tenant_slug: 't',
  enabled_modules: ['crm', 'whatsapp', 'admin', 'integrations'],
})}.sig`;
const fakeUser = {
  id: 'u1', _uid: 'u1', email: 'qa@test.local', name: 'QA',
  tenant: {
    id: 't1', name: 'Tenant', slug: 't',
    enabled_modules: ['crm', 'whatsapp', 'admin', 'integrations'],
    whatsapp_vendor_uid: 'VEND1', whatsapp_api_token: 'tok-123',
    settings: { whatsapp_vendor_uid: 'VEND1', whatsapp_api_token: 'tok-123' },
  },
  preferences: {},
};

// ── Mock payloads ────────────────────────────────────────────────────────────
const CONTACTS = [
  { _uid: 'c1', phone_number: '919000000001', name: 'Alice', first_name: 'Alice', unread_count: 2, last_message: 'hello', last_message_at: '2026-07-15T08:00:00Z', labels: [] },
  { _uid: 'c2', phone_number: '919000000002', name: 'Bob', first_name: 'Bob', unread_count: 1, last_message: 'yo', last_message_at: '2026-07-15T07:00:00Z', labels: [] },
];
const MESSAGES = [
  { _uid: 'm1', message: 'hello', message_type: 'text', is_incoming_message: true, status: 'read', messaged_at: '2026-07-15T08:00:00Z' },
  { _uid: 'm2', message: 'hi there', message_type: 'text', is_incoming_message: false, status: 'delivered', messaged_at: '2026-07-15T08:01:00Z' },
];

function classify(method, url) {
  const u = url.toLowerCase();
  if (u.includes('/chat/contacts')) return 'contacts GET';
  if (u.includes('/chat/unread-count')) return 'unread GET';
  if (u.includes('/chat/team-members')) return 'team-members GET';
  if (u.includes('/messages/read')) return 'mark-as-read POST';
  if (/\/contacts\/[^/]+\/messages/.test(u) && method === 'GET') return 'messages GET';
  if (u.includes('send-message') || u.includes('send-template-message') || u.includes('send-media-message') || (/\/contacts\/[^/]+\/messages/.test(u) && method === 'POST')) return 'send POST';
  if (u.includes('chat-context')) return 'chat-context GET';
  if (u.includes('/labels')) return 'labels GET';
  if (u.includes('lead-statuses')) return 'lead-statuses GET';
  if (u.includes('field_schema') || u.includes('field-configurations')) return 'field-schema GET';
  if (u.includes('/users')) return 'users GET';
  if (u.includes('/tenants')) return 'tenants GET';
  if (u.includes('lead-groups')) return 'lead-groups GET';
  if (u.includes('/crm/leads')) return 'leads GET';
  if (u.includes('/tasks')) return 'tasks GET';
  if (u.includes('/activities')) return 'activities GET';
  if (u.includes('/meetings')) return 'meetings GET';
  return `other ${method}`;
}

function mockBody(method, url) {
  const u = url.toLowerCase();
  if (u.includes('/chat/contacts')) {
    const search = new URL(url).searchParams.get('search');
    const list = search
      ? CONTACTS.filter(c => c.phone_number.includes(search.replace('+', '')) || c.name.toLowerCase().includes(search.toLowerCase()))
      : CONTACTS;
    return { data: list, total: list.length };
  }
  if (u.includes('/chat/unread-count')) return { total: 3, contacts: { c1: 2, c2: 1 } };
  if (u.includes('/chat/team-members')) return { data: [] };
  if (u.includes('/messages/read')) return { success: true };
  if (/\/contacts\/[^/]+\/messages/.test(u) && method === 'GET') return { data: MESSAGES, total: MESSAGES.length, contact: CONTACTS[0] };
  if (u.includes('send-message') || u.includes('send-template') || u.includes('send-media')) return { success: true, message: 'queued' };
  if (u.includes('chat-context')) return { data: { contact: CONTACTS[0], labels: [], teamMembers: [], replyWindowStatus: { is_open: true, expires_at: null } } };
  if (u.includes('/labels')) return { data: [] };
  if (u.includes('field_schema')) return { standard_fields: [], custom_fields: [] };
  if (u.includes('/tenants')) return { id: 't1', name: 'Tenant', settings: {} };
  return { count: 0, results: [], next: null, data: [] };
}

async function scenario(baseUrl) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  let counts = {};
  const log = [];
  const record = (method, url) => {
    const bucket = classify(method, url);
    counts[bucket] = (counts[bucket] || 0) + 1;
    log.push(`${bucket} :: ${method} ${url}`);
  };

  await context.addInitScript(([jwt, user]) => {
    localStorage.setItem('celiyo_access_token', jwt);
    localStorage.setItem('celiyo_refresh_token', jwt);
    localStorage.setItem('celiyo_user', JSON.stringify(user));
  }, [fakeJwt, fakeUser]);

  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.startsWith(baseUrl) || url.startsWith('data:')) return route.continue();
    if (url.startsWith('ws') || url.includes('pusher') || url.includes('broadcasting')) return route.abort();
    record(req.method(), url);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockBody(req.method(), url)) });
  });

  const page = await context.newPage();
  page.on('pageerror', (e) => log.push(`PAGEERROR :: ${e.message}`));
  const settle = (ms = 2500) => page.waitForTimeout(ms);
  const snap = (name) => { const c = { ...counts }; counts = {}; return { name, counts: c }; };
  const results = [];

  // ── Test A: load Chats page ────────────────────────────────────────────────
  await page.goto(`${baseUrl}/whatsapp/chats`, { waitUntil: 'domcontentloaded' });
  await settle(3500);
  results.push(snap('A: load /whatsapp/chats'));

  // ── Test B + E: select one conversation (drawer stays closed) ─────────────
  try {
    await page.getByText('Alice', { exact: true }).first().click({ timeout: 8000 });
  } catch (e) { log.push(`CLICK-FAIL Alice :: ${e.message}`); }
  await settle(3000);
  results.push(snap('B/E: select conversation (drawer closed)'));

  // ── Test D: send one text message ──────────────────────────────────────────
  try {
    const input = page.getByPlaceholder('Type a message or / for templates...');
    await input.fill('hello from harness', { timeout: 5000 });
    await input.press('Enter');
  } catch (e) { log.push(`SEND-FAIL :: ${e.message}`); }
  await settle(2500);
  results.push(snap('D: send one text message'));

  // ── Test F: open contact drawer, then Add Lead tab ────────────────────────
  try {
    await page.locator('[title="Show contact details"]').first().click({ timeout: 5000 });
    await settle(2000);
    results.push(snap('F1: open Contact drawer (contact tab)'));
    await page.getByText('Add to CRM', { exact: true }).first().click({ timeout: 5000 });
    await settle(2000);
    results.push(snap('F2: switch to Add Lead tab'));
  } catch (e) {
    log.push(`DRAWER-FAIL :: ${e.message}`);
    results.push(snap('F: drawer interaction (partial/failed)'));
  }

  // ── Test G: reconnect on a page with active SWR queries (CRM leads) ───────
  await page.goto(`${baseUrl}/crm/leads`, { waitUntil: 'domcontentloaded' });
  await settle(3500);
  snap('discard: crm leads initial load');
  await context.setOffline(true);
  await settle(1200);
  await context.setOffline(false);
  await settle(3500);
  results.push(snap('G: network reconnect on /crm/leads'));

  await browser.close();
  return { results, log };
}

const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: projectDir, stdio: 'pipe', shell: false,
});
preview.stderr.on('data', (d) => console.error('[preview]', String(d).trim()));

// Poll until the preview server responds (up to 30s)
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  try {
    const res = await fetch(`http://localhost:${port}/`);
    up = res.ok || res.status < 500;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!up) { preview.kill('SIGTERM'); throw new Error('vite preview did not start'); }

try {
  const { results, log } = await scenario(`http://localhost:${port}`);
  console.log(JSON.stringify({ results }, null, 2));
  const errs = log.filter(l => l.includes('FAIL') || l.includes('PAGEERROR') || l.startsWith('other'));
  if (errs.length) console.error('NOTES:\n' + errs.slice(0, 15).join('\n'));
} finally {
  preview.kill('SIGKILL');
  setTimeout(() => process.exit(0), 500);
}
