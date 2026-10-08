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
  // The worker is reported before its (large) script finished evaluating; navigating
  // earlier would fire webRequest/tabs events before the listeners exist.
  await expect.poll(() => sw.evaluate(() => chrome.tabs.onUpdated.hasListeners())).toBe(true);
});

test.afterAll(async () => {
  await ctx?.close();
  await fixture?.close();
});

test('detects stack and sets badge', async () => {
  const page = await ctx.newPage();
  await page.goto(fixture.url);

  const badge = () =>
    sw.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
      return chrome.action.getBadgeText({ tabId: tab!.id! });
    });
  await expect.poll(badge, { timeout: 10_000 }).not.toBe('');

  const result = await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
    const key = `result:${tab!.id}`;
    return (await chrome.storage.session.get(key))[key];
  });
  expect(result.status).toBe('ok');
  expect(result.detections.map((d: { tech: string }) => d.tech)).toEqual(
    expect.arrayContaining(['Next.js', 'WordPress', 'React', 'PHP']),
  );
  expect(await badge()).toBe(String(result.detections.length));
});

test('internal pages are reported as unsupported', async () => {
  const page = await ctx.newPage();
  await page.goto('chrome://version');
  // Without the "tabs" permission Chrome hides chrome:// URLs, so look the tab up by its id.
  const statusOfActiveTab = () =>
    sw.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const key = `result:${tab!.id}`;
      return (await chrome.storage.session.get(key))[key]?.status;
    });
  await page.bringToFront();
  await expect.poll(statusOfActiveTab, { timeout: 10_000 }).toBe('unsupported');
});
