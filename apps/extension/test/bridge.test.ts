// @vitest-environment happy-dom
import { acceptToken, bridgeHandler, SITE_ORIGIN } from '../lib/account';

const msg = (data: unknown, origin = SITE_ORIGIN, source: unknown = window) => ({ data, origin, source }) as unknown as MessageEvent;

test('bridge forwards a token only from our origin and this window, then acknowledges', async () => {
  const sent: unknown[] = [];
  const acks: unknown[] = [];
  const handle = bridgeHandler(async (m) => void sent.push(m), (m) => acks.push(m));
  await handle(msg({ type: 'hib:connect', token: 'tok_1' }, 'https://evil.test'));
  await handle(msg({ type: 'hib:connect', token: 'tok_1' }, SITE_ORIGIN, {}));
  await handle(msg({ type: 'hib:connect', token: 42 }));
  await handle(msg({ type: 'hib:connect', token: 'x'.repeat(600) }));
  expect(sent).toEqual([]);
  await handle(msg({ type: 'hib:connect', token: 'tok_1' }));
  expect(sent).toEqual([{ type: 'hib:token', token: 'tok_1' }]);
  expect(acks).toEqual([{ type: 'hib:connected' }]);
});

test('background accepts tokens only from our own content script on our site', () => {
  const self = 'ext-id';
  const ok = { id: self, url: `${SITE_ORIGIN}/connect` };
  expect(acceptToken({ type: 'hib:token', token: 'tok_1' }, ok, self)).toBe('tok_1');
  expect(acceptToken({ type: 'hib:token', token: 'tok_1' }, { id: 'other', url: ok.url }, self)).toBeNull();
  expect(acceptToken({ type: 'hib:token', token: 'tok_1' }, { id: self, url: 'https://evil.test/connect' }, self)).toBeNull();
  expect(acceptToken({ type: 'other' }, ok, self)).toBeNull();
});
