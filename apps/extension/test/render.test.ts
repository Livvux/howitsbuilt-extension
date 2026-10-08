// @vitest-environment happy-dom
import type { Detection } from '@howitsbuilt/engine';
import { renderDetails, renderPopup } from '../entrypoints/popup/render';

const js = { id: 12, name: 'JavaScript frameworks', priority: 8 };
const ssg = { id: 57, name: 'Static site generator', priority: 9 };
const nextjs: Detection = {
  tech: 'Next.js', icon: 'Next.js.svg', website: 'https://nextjs.org', categories: [js, ssg],
  version: '15.2', confidence: 100, evidence: [{ source: 'header', key: 'x-powered-by', match: 'Next.js 15.2' }],
};
const react: Detection = { tech: 'React', icon: 'React.svg', categories: [js], confidence: 100, evidence: [] };
const vercel: Detection = { tech: 'Vercel', categories: [{ id: 62, name: 'PaaS', priority: 8 }], confidence: 100, evidence: [] };

let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app')!;
});

test('groups by primary category, no versions shown in free', () => {
  renderPopup(root, { status: 'ok', url: 'https://vercel.com/', scannedAt: 0, detections: [nextjs, react, vercel] });
  expect(root.querySelector('[data-testid=domain]')!.textContent).toBe('vercel.com');
  const groups = [...root.querySelectorAll('[data-testid=category]')].map((e) => e.textContent);
  expect(groups).toEqual(['JavaScript frameworks', 'PaaS']);
  expect(root.querySelectorAll('[data-testid=tech]')).toHaveLength(3);
  expect(root.textContent).not.toContain('15.2');
});

test('tech links to website and shows bundled icon', () => {
  renderPopup(root, { status: 'ok', url: 'https://a.test/', scannedAt: 0, detections: [nextjs, vercel] });
  const link = root.querySelector<HTMLAnchorElement>('a[href="https://nextjs.org"]')!;
  expect(link.target).toBe('_blank');
  expect(link.rel).toContain('noopener');
  expect(link.querySelector('img')!.getAttribute('src')).toBe('/tech-icons/Next.js.webp');
  // No website → plain row, no icon → letter placeholder.
  const plain = [...root.querySelectorAll('[data-testid=tech]')].find((e) => e.textContent?.includes('Vercel'))!;
  expect(plain.querySelector('a')).toBeNull();
  expect(plain.textContent).toContain('V');
});

test('empty, unsupported, not-yet-scanned states', () => {
  renderPopup(root, { status: 'ok', url: 'https://a.test/', scannedAt: 0, detections: [] });
  expect(root.textContent).toContain('No technologies found');
  renderPopup(root, { status: 'unsupported', url: 'chrome://x' });
  expect(root.textContent).toContain("Can't inspect this page");
  renderPopup(root, null);
  expect(root.textContent).toContain('Reload the page to scan it');
});

test('re-render replaces previous content', () => {
  renderPopup(root, { status: 'ok', url: 'https://a.test/', scannedAt: 0, detections: [react] });
  renderPopup(root, { status: 'ok', url: 'https://a.test/', scannedAt: 0, detections: [react] });
  expect(root.querySelectorAll('[data-testid=tech]')).toHaveLength(1);
});

test('tech names are rendered as text, not HTML', () => {
  renderPopup(root, { status: 'ok', url: 'https://a.test/', scannedAt: 0, detections: [{ ...react, tech: '<img src=x onerror=alert(1)>' }] });
  expect(root.querySelector('img[onerror]')).toBeNull();
  expect(root.textContent).toContain('<img src=x onerror=alert(1)>');
});

test('pro link points to pricing', () => {
  renderPopup(root, { status: 'ok', url: 'https://a.test/', scannedAt: 0, detections: [react] });
  expect(root.querySelector('a[href="https://howitsbuilt.fyi/pricing"]')).not.toBeNull();
});

test('copy button copies "Category: Tech, Tech" lines', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  renderPopup(root, { status: 'ok', url: 'https://vercel.com/', scannedAt: 0, detections: [nextjs, react, vercel] });
  root.querySelector<HTMLButtonElement>('[data-testid=copy]')!.click();
  expect(writeText).toHaveBeenCalledWith('vercel.com\nJavaScript frameworks: Next.js, React\nPaaS: Vercel');
});

test('signed out: offers sign-in for Pro details', () => {
  renderPopup(root, { status: 'ok', url: 'https://a.test/', scannedAt: 0, detections: [react] }, { kind: 'signed-out' });
  expect(root.querySelector<HTMLAnchorElement>('a[href="https://howitsbuilt.fyi/connect"]')!.textContent).toMatch(/sign in/i);
});

test('free account: upgrade link and email', () => {
  renderPopup(root, { status: 'ok', url: 'https://a.test/', scannedAt: 0, detections: [react] }, { kind: 'account', email: 'u@x.com', pro: false });
  expect(root.textContent).toContain('u@x.com');
  expect(root.querySelector('a[href="https://howitsbuilt.fyi/pricing"]')!.textContent).toMatch(/upgrade/i);
});

test('pro account: details tab renders versions and evidence', () => {
  const onDetails = vi.fn();
  renderPopup(root, { status: 'ok', url: 'https://a.test/', scannedAt: 0, detections: [react] }, { kind: 'account', email: 'u@x.com', pro: true }, onDetails);
  root.querySelector<HTMLButtonElement>('[data-testid=tab-details]')!.click();
  expect(onDetails).toHaveBeenCalledWith('a.test');
  const box = document.createElement('div');
  renderDetails(box, { domain: 'a.test', scannedAt: 0, technologies: [{ name: 'Next.js', category: 'X', version: '15.2', confidence: 100, evidence: [{ source: 'header', key: 'x-powered-by', match: 'Next.js 15.2' }] }] });
  expect(box.textContent).toContain('15.2');
  expect(box.textContent).toContain('x-powered-by');
  renderDetails(box, null);
  expect(box.textContent).toMatch(/couldn.t load/i);
});
