import { chromium, expect, test, type BrowserContext, type Worker } from '@playwright/test';
import { join } from 'node:path';
import { startFixtureServer } from './fixture-server';

const EXTENSION = join(import.meta.dirname, '..', '.output', 'chrome-mv3');

let ctx: BrowserContext;
let sw: Worker;
let fixture: Awaited<ReturnType<typeof startFixtureServer>>;

test.beforeAll(async () => {
  fixture = await startFixtureServer();
  ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  await expect.poll(() => sw.evaluate(() => chrome.tabs.onUpdated.hasListeners())).toBe(true);
});

test.afterAll(async () => {
  await ctx?.close();
  await fixture?.close();
});

async function activeTabId(): Promise<number> {
  return sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab!.id!;
  });
}

test('opening a website no longer performs automatic scans or populates a badge', async () => {
  const page = await ctx.newPage();
  await page.goto(fixture.url);
  await page.bringToFront();
  const tabId = await activeTabId();

  // The service worker observes navigation only to clear stale badges.
  // It must not silently extract content or store browsing history.
  expect(await sw.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId)).toBe('');
  expect(await sw.evaluate(() => chrome.storage.session.get(null))).toEqual({});
  await page.close();
});

test('a badge from an on-demand scan is cleared on navigation', async () => {
  const page = await ctx.newPage();
  await page.goto(fixture.url);
  await page.bringToFront();
  const tabId = await activeTabId();

  await sw.evaluate((id) => chrome.action.setBadgeText({ tabId: id, text: '4' }), tabId);
  expect(await sw.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId)).toBe('4');
  await page.goto(`${fixture.url}?another-page`);
  await expect.poll(() => sw.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId)).toBe('');
  await page.close();
});

// User-invoked activeTab grants cannot be synthesized by opening popup.html as a
// regular tab. Page detection itself is covered by analyze.test.ts; test the
// complete gesture manually by clicking the real extension icon in Chrome.
