import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const PAGE = `<!doctype html>
<html><head>
<meta name="generator" content="WordPress 6.4">
<title>Fixture</title>
</head><body><h1>Fixture</h1></body></html>`;

/** Serves one page whose stack the extension must detect. Returns its URL and a close fn. */
export async function startFixtureServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html', 'X-Powered-By': 'Next.js 15.2.1' });
    res.end(PAGE);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
