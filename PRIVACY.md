# Privacy — How Its Built extension

**Free technology detection is local.** The extension does not send scanned page contents or browsing history to our servers. It does not silently scan every page: detection starts only when you open the extension popup.

## Permissions and local processing

| Permission | Why |
|---|---|
| `activeTab` | Temporarily access the current website after you explicitly open the extension. Access ends when Chrome revokes the temporary grant. |
| `scripting` | Run the bundled, read-only detection code on the active website. |
| `storage` | Store an optional How Its Built account token locally. |
| `https://howitsbuilt.fyi/*` | Connect to our account and Pro API and receive an optional sign-in token from our own website. This is the only persistent host permission. |

While you invoke a scan, the extension locally reads website signals such as HTML, visible page text, meta tags, script URLs and inline scripts, selected DOM elements and JavaScript globals, and accessible cookie names **and values**. These signals may contain personal information depending on the website. They are matched to a bundled technology fingerprint database entirely in your browser. We do not transmit scanned HTML, page text, scripts, cookies or other page contents.

Detection results are kept only in the popup while it is open; the extension can set a technology-count badge for the tab, cleared on navigation. No browsing history or scan results are persistently saved. The extension does not read network response headers or monitor browsing traffic.

## Optional account and Pro features

If you sign in through [howitsbuilt.fyi/connect](https://howitsbuilt.fyi/connect), a content script running **only on howitsbuilt.fyi** passes your session token to the extension. The token is kept in `chrome.storage.local`. While signed in, opening the popup requests your account email and subscription tier from `https://howitsbuilt.fyi/api/v1/me` to display account status. Only if a signed-in Pro user explicitly opens **Details** does the extension send the active website's **domain** to `https://howitsbuilt.fyi/api/v1/scan` for additional technology details.

Signing out invalidates the session on the website; the extension removes the token when the API reports an invalid session. Optional account activity is also covered by the [website privacy policy](https://howitsbuilt.fyi/privacy).

The extension itself includes no analytics, advertising or tracking SDKs. We do not sell browsing data or use it for unrelated purposes.

Questions: https://github.com/Livvux/howitsbuilt-extension/issues
