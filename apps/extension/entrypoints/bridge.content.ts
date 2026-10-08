import { bridgeHandler, SITE_ORIGIN } from '@/lib/account';

/** Runs only on howitsbuilt.fyi: lets /connect hand the session token to the extension. */
export default defineContentScript({
  matches: [`${SITE_ORIGIN}/*`],
  runAt: 'document_start',
  main() {
    window.addEventListener(
      'message',
      bridgeHandler(
        (m) => browser.runtime.sendMessage(m),
        (m) => window.postMessage(m, SITE_ORIGIN),
      ),
    );
  },
});
