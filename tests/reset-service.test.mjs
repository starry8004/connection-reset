import test from 'node:test';
import assert from 'node:assert/strict';
import { webTarget, removalRequest, GUIDES } from '../core.js';
import { createResetService } from '../reset-service.js';

function fixture(overrides = {}) {
  const calls = [];
  let state;
  let tab = { id: 11, url: 'https://www.example.com/page?a=1' };
  const api = {
    getJob: async () => state,
    setJob: async job => { state = structuredClone(job); },
    getTab: async () => tab,
    reloadTab: async id => { calls.push(['reload', id]); },
    remove: async (options, data) => { calls.push(['remove', options, data]); },
    ...overrides
  };
  const service = createResetService(api);
  return { service, calls, api, setTab: next => { tab = next; }, state: () => state };
}
const payload = { tabId: 11, origin: 'https://www.example.com', reload: true };

test('rejects privileged, local, malformed, and script URLs', () => {
  for (const url of ['chrome://settings', 'chrome-extension://abc/popup.html', 'file:///a', 'javascript:alert(1)', 'about:blank', 'not a url', undefined, 'data:text/html,test']) {
    assert.equal(webTarget(url), null);
    assert.throws(() => removalRequest(url));
  }
});
test('scope contains exactly one origin, preserves port, excludes history/passwords', () => {
  const req = removalRequest('https://user:password@sub.example.com:8443/path?q=1#frag');
  assert.deepEqual(req.options.origins, ['https://sub.example.com:8443']);
  assert.equal(req.options.since, 0);
  assert.equal(req.options.originTypes.extension, false);
  assert.equal(req.options.originTypes.protectedWeb, false);
  assert.equal(req.data.history, undefined);
  assert.equal(req.data.passwords, undefined);
  assert.equal(req.data.cookies, true);
});
test('deletes the confirmed origin and reloads after completion', async () => {
  const f = fixture();
  const result = await f.service.start(payload);
  assert.equal(result.status, 'done');
  assert.deepEqual(f.calls.map(x=>x[0]), ['remove','reload']);
  assert.deepEqual(f.calls[0][1].origins, [payload.origin]);
});
test('refuses a changed site before any deletion', async () => {
  const f = fixture();
  f.setTab({ id: 11, url: 'https://different.example' });
  await assert.rejects(f.service.start(payload), /페이지 주소가 바뀌었습니다/);
  assert.equal(f.calls.length, 0);
});
test('rejects missing tab id and never attempts whole-profile deletion', async () => {
  const f = fixture();
  await assert.rejects(f.service.start({origin: payload.origin}), /삭제할 탭/);
  assert.equal(f.calls.length, 0);
});
test('an API failure is reported without broad fallback or reload', async () => {
  let attempts = 0;
  const f = fixture({ remove: async () => { attempts++; throw new Error('API denied'); } });
  await assert.rejects(f.service.start(payload), /API denied/);
  assert.equal(attempts, 1);
  assert.equal(f.state().status, 'error');
  assert.equal(f.calls.length, 0);
});
test('does not reload a tab that navigates to a different origin during deletion', async () => {
  const f = fixture();
  f.api.remove = async () => f.setTab({ id: 11, url: 'https://different.example' });
  const result = await f.service.start(payload);
  assert.equal(result.status, 'done');
  assert.match(result.message, /생략/);
  assert.equal(f.calls.length, 0);
});
test('reports deletion success even when the tab closes before reload', async () => {
  let reads = 0;
  const f = fixture({ getTab: async () => {
    if (reads++) throw new Error('No tab');
    return { url: 'https://www.example.com' };
  }});
  const result = await f.service.start(payload);
  assert.equal(result.status, 'done');
  assert.match(result.message, /직접/);
});
test('honors no-reload selection', async () => {
  const f = fixture();
  await f.service.start({ ...payload, reload: false });
  assert.deepEqual(f.calls.map(x=>x[0]), ['remove']);
});
test('blocks concurrent requests and permits a later request', async () => {
  let resolveRemoval;
  const f = fixture({remove: () => new Promise(resolve => { resolveRemoval = resolve; })});
  const first = f.service.start(payload);
  await assert.rejects(f.service.start(payload), /진행 중/);
  while (!resolveRemoval) await new Promise(resolve=>setImmediate(resolve));
  resolveRemoval();
  await first;
  f.api.remove = async () => {};
  assert.equal((await f.service.start(payload)).status, 'done');
});
test('marks a stale job interrupted instead of silently repeating deletion', async () => {
  const f = fixture({ getJob: async () => ({ ...payload, status: 'running' }) });
  await f.service.ready;
  assert.equal(f.state().status, 'interrupted');
  assert.equal(f.calls.length, 0);
});
test('the Windows guide copies only the requested DHCP command', () => {
  assert.equal(GUIDES.renew.command, 'ipconfig /renew');
  assert.match(GUIDES.renew.note, /공인 IP 변경을 보장하지/);
});
