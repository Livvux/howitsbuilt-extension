// Vendor regexes include quadratic ones (`<[^>]+x`, `[\s\S]*`). Each exec costs up to
// O(input²), so documents are matched as bounded chunks instead of one big string.
const HTML_HEAD = 150_000;
const HTML_TAIL = 50_000;
const CHUNK = 10_000;

/** Splits into ≤ CHUNK pieces, cutting before the last `<` so a tag is never split (hard cut if a tag is longer). */
export function chunk(s: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + CHUNK, s.length);
    if (end < s.length) {
      const cut = s.lastIndexOf('<', end - 1);
      if (cut > i) end = cut;
    }
    out.push(s.slice(i, end));
    i = end;
  }
  return out;
}

/** Keeps the head (where frameworks announce themselves) and the tail (where trackers load). */
export function boundHtml(html: string): string[] {
  const kept = html.length > HTML_HEAD + HTML_TAIL ? [html.slice(0, HTML_HEAD), html.slice(-HTML_TAIL)] : [html];
  return kept.flatMap(chunk);
}
