// @vitest-environment happy-dom
import type { Detection } from '@howitsbuilt/engine';
import type { ProScan } from '../lib/account';
import { renderPopup } from '../entrypoints/popup/render';

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

test('groups by primary category and shows the local version as a label', () => {
  renderPopup(root, { status: 'ok', url: 'https://vercel.com/', scannedAt: 0, detections: [nextjs, react, vercel] });
  expect(root.querySelector('[data-testid=domain]')!.textContent).toBe('vercel.com');
  const groups = [...root.querySelectorAll('[data-testid=category]')].map((e) => e.textContent);
  expect(groups).toEqual(['JavaScript frameworks', 'PaaS']);
  expect(root.querySelectorAll('[data-testid=tech]')).toHaveLength(3);
  expect(root.querySelector('.version')!.textContent).toBe('15.2');
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
  expect(root.textContent).toContain('Scanning this page');
});

test('runtime error shows "Something went wrong" with Rescan, not "unsupported"', () => {
  const onRescan = vi.fn();
  renderPopup(root, 'error', undefined, { onRescan });
  expect(root.textContent).toContain('Something went wrong');
  expect(root.textContent).not.toContain("Can't inspect");
  root.querySelector<HTMLButtonElement>('[data-testid=rescan]')!.click();
  expect(onRescan).toHaveBeenCalledOnce();
  renderPopup(root, { status: 'unsupported', url: 'chrome://x' }, undefined, { onRescan });
  expect(root.querySelector('[data-testid=rescan]')).toBeNull();
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

test('signed out: offers sign-in for server-side details', () => {
  renderPopup(root, { status: 'ok', url: 'https://a.test/', scannedAt: 0, detections: [react] }, { kind: 'signed-out' });
  expect(root.querySelector<HTMLAnchorElement>('a[href="https://howitsbuilt.fyi/connect"]')!.textContent).toMatch(/sign in.*hosting, dns/i);
});

test('free account: pro upsell link and email', () => {
  renderPopup(root, { status: 'ok', url: 'https://a.test/', scannedAt: 0, detections: [react] }, { kind: 'account', email: 'u@x.com', pro: false });
  expect(root.textContent).toContain('u@x.com');
  expect(root.querySelector('a[href="https://howitsbuilt.fyi/pricing"]')!.textContent).toBe('Hosting, DNS & more — Pro →');
});

const ok = (detections: Detection[]) => ({ status: 'ok' as const, url: 'https://a.test/', scannedAt: 42, detections });
const proAccount = { kind: 'account', email: 'u@x.com', pro: true } as const;
const proScan: ProScan = {
  domain: 'a.test',
  scannedAt: 1,
  technologies: [
    { name: 'react', category: 'JavaScript frameworks', version: '19.0', confidence: 90, evidence: [{ source: 'js', key: 'React.version', match: '19.0' }] },
    { name: 'Next.js', category: 'JavaScript frameworks', version: '99', confidence: 100, evidence: [{ source: 'header', key: 'x-powered-by', match: 'Next.js 15.2' }] },
    { name: 'Cloudflare', category: 'CDN', confidence: 80, evidence: [{ source: 'dns', key: 'NS', match: 'ns.cloudflare.com' }] },
  ],
};

test('pro: fills missing versions, keeps local ones, adds a server-only section', () => {
  renderPopup(root, ok([nextjs, react]), proAccount, { pro: proScan });
  const rows = [...root.querySelectorAll('[data-testid=tech]')];
  expect(rows).toHaveLength(3);
  expect(rows.find((r) => r.textContent?.includes('Next.js'))!.querySelector('.version')!.textContent).toBe('15.2');
  expect(rows.find((r) => r.textContent?.includes('React'))!.querySelector('.version')!.textContent).toBe('19.0');
  const server = [...root.querySelectorAll('section')].find((s) => s.querySelector('h2')!.textContent === 'From How Its Built servers')!;
  expect(server.textContent).toContain('Cloudflare');
  expect(server.querySelectorAll('[data-testid=tech]')).toHaveLength(1);
  expect(root.querySelector('a[href="https://howitsbuilt.fyi/pricing"]')).toBeNull();
});

test('pro: evidence is a native details with confidence in the summary', () => {
  renderPopup(root, ok([nextjs, react]), proAccount, { pro: proScan });
  const next = [...root.querySelectorAll('[data-testid=tech]')].find((r) => r.textContent?.includes('Next.js'))!;
  expect(next.querySelector('details > summary')!.textContent).toContain('100%');
  expect(next.querySelector('details')!.textContent).toContain('header x-powered-by: Next.js 15.2');
  expect(root.querySelector('[data-testid=tab-details]')).toBeNull();
  expect(root.querySelectorAll('details')).toHaveLength(3);
});

test('pro: loading and error lines; free rows stay', () => {
  renderPopup(root, ok([react]), proAccount, { pro: 'loading' });
  expect(root.querySelector('[role=status]')!.textContent).toMatch(/loading/i);
  expect(root.querySelectorAll('[data-testid=tech]')).toHaveLength(1);
  renderPopup(root, ok([react]), proAccount, { pro: 'error' });
  expect(root.querySelector('[role=status]')!.textContent).toMatch(/couldn.t load/i);
  renderPopup(root, ok([react]), proAccount, {});
  expect(root.querySelector('[role=status]')).toBeNull();
});

test('pro: server-only techs show even when the local scan found nothing', () => {
  renderPopup(root, ok([]), proAccount, { pro: proScan });
  expect(root.textContent).not.toContain('No technologies found');
  expect(root.querySelectorAll('[data-testid=tech]')).toHaveLength(3);
});

const many = Array.from({ length: 16 }, (_, i): Detection => ({ ...react, tech: `Tech${i}`, categories: [i < 8 ? js : ssg] }));

test('filter appears above 15 detections and hides rows and empty categories', () => {
  renderPopup(root, ok(many.slice(0, 15)));
  expect(root.querySelector('input[type=search]')).toBeNull();
  renderPopup(root, ok(many));
  const input = root.querySelector<HTMLInputElement>('input[type=search]')!;
  expect(input.getAttribute('aria-label')).toBeTruthy();
  input.value = 'TECH12';
  input.dispatchEvent(new Event('input'));
  const visible = [...root.querySelectorAll('[data-testid=tech]')].filter((e) => !e.hasAttribute('hidden'));
  expect(visible.map((e) => e.textContent)).toEqual(['Tech12']);
  const sections = [...root.querySelectorAll('section')];
  expect(sections.filter((s) => !s.hasAttribute('hidden'))).toHaveLength(1);
  input.value = '';
  input.dispatchEvent(new Event('input'));
  expect(root.querySelectorAll('[data-testid=tech]:not([hidden])')).toHaveLength(16);
});

test('filter text survives a re-render', () => {
  renderPopup(root, ok(many));
  const input = root.querySelector<HTMLInputElement>('input[type=search]')!;
  input.value = 'tech3';
  renderPopup(root, ok(many), undefined, { pro: 'loading' });
  expect(root.querySelector<HTMLInputElement>('input[type=search]')!.value).toBe('tech3');
  expect(root.querySelectorAll('[data-testid=tech]:not([hidden])')).toHaveLength(1);
});

test('export: Markdown and JSON copy the merged list', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  renderPopup(root, ok([nextjs, vercel]));
  root.querySelector<HTMLButtonElement>('button[aria-label="Copy as Markdown"]')!.click();
  expect(writeText).toHaveBeenLastCalledWith('# a.test\n\n## JavaScript frameworks\n- Next.js 15.2\n\n## PaaS\n- Vercel');
  root.querySelector<HTMLButtonElement>('button[aria-label="Copy as JSON"]')!.click();
  expect(JSON.parse(writeText.mock.lastCall![0])).toEqual({
    url: 'https://a.test/',
    scannedAt: 42,
    technologies: [
      { name: 'Next.js', version: '15.2', categories: ['JavaScript frameworks', 'Static site generator'] },
      { name: 'Vercel', categories: ['PaaS'] },
    ],
  });
});
