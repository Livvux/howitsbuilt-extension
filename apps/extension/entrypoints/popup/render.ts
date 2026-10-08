import type { Category, Detection } from '@howitsbuilt/engine';
import type { TabResult } from '@/lib/analyze';

const PRICING_URL = 'https://howitsbuilt.fyi/pricing';

type Attrs = Record<string, string>;

/** Tiny element builder. Children strings become text nodes — never parsed as HTML. */
function h(tag: string, attrs: Attrs = {}, ...children: (Node | string)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

const primaryCategory = (d: Detection): Category | undefined =>
  [...d.categories].sort((a, b) => a.priority - b.priority)[0];

function groupByCategory(detections: Detection[]): [string, Detection[]][] {
  const groups = new Map<string, { priority: number; items: Detection[] }>();
  for (const d of detections) {
    const cat = primaryCategory(d) ?? { name: 'Other', priority: Infinity };
    const group = groups.get(cat.name) ?? { priority: cat.priority, items: [] };
    groups.set(cat.name, { ...group, items: [...group.items, d] });
  }
  return [...groups]
    .sort(([an, a], [bn, b]) => a.priority - b.priority || an.localeCompare(bn))
    .map(([name, g]) => [name, g.items]);
}

const hostOf = (url: string): string => (URL.canParse(url) ? new URL(url).hostname : url);

function techRow(d: Detection): HTMLElement {
  const icon = d.icon
    ? h('img', { class: 'icon', src: `/tech-icons/${d.icon.replace(/\.[^.]+$/, '.webp')}`, alt: '', width: '16', height: '16' })
    : h('span', { class: 'icon placeholder', 'aria-hidden': 'true' }, d.tech.charAt(0).toUpperCase());
  const content = [icon, h('span', { class: 'name' }, d.tech)];
  const body = d.website
    ? h('a', { href: d.website, target: '_blank', rel: 'noopener noreferrer' }, ...content)
    : h('span', { class: 'row' }, ...content);
  return h('li', { 'data-testid': 'tech' }, body);
}

function message(title: string, detail: string): HTMLElement {
  return h('div', { class: 'message' }, h('p', { class: 'title' }, title), h('p', { class: 'detail' }, detail));
}

function copyText(host: string, groups: [string, Detection[]][]): string {
  return [host, ...groups.map(([cat, items]) => `${cat}: ${items.map((d) => d.tech).join(', ')}`)].join('\n');
}

export function renderPopup(root: HTMLElement, state: TabResult | null): void {
  const host = state ? hostOf(state.url) : '';
  const header = h(
    'header',
    {},
    h('span', { class: 'brand' }, 'How Its Built'),
    h('span', { class: 'domain', 'data-testid': 'domain' }, host),
  );

  let main: HTMLElement;
  let groups: [string, Detection[]][] = [];
  if (!state) {
    main = message('Reload the page to scan it', 'Pages opened before the extension was installed are scanned on the next load.');
  } else if (state.status === 'unsupported') {
    main = message("Can't inspect this page", 'Chrome blocks extensions on internal pages, the Web Store and file viewers.');
  } else if (state.detections.length === 0) {
    main = message('No technologies found', "This page doesn't expose a stack we recognize.");
  } else {
    groups = groupByCategory(state.detections);
    main = h(
      'main',
      {},
      ...groups.map(([cat, items]) =>
        h('section', {}, h('h2', { 'data-testid': 'category' }, cat), h('ul', {}, ...items.map(techRow))),
      ),
    );
  }

  const footer = h('footer', {});
  if (groups.length > 0) {
    const copy = h('button', { type: 'button', 'data-testid': 'copy' }, 'Copy');
    copy.addEventListener('click', () => {
      navigator.clipboard
        .writeText(copyText(host, groups))
        .then(() => {
          copy.textContent = 'Copied';
          setTimeout(() => (copy.textContent = 'Copy'), 1500);
        })
        .catch(console.error);
    });
    footer.append(copy);
  }
  footer.append(h('a', { class: 'pro', href: PRICING_URL, target: '_blank', rel: 'noopener noreferrer' }, 'Versions, hosting & evidence — Pro →'));

  root.replaceChildren(header, main, footer);
}
