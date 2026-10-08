# How Its Built — browser extension

Open-source Chrome extension that shows how the **current website** is built: frameworks, CMS, analytics and more.

**Click the extension icon to scan the active tab.** Detection runs locally, on demand, using Chrome's `activeTab` permission. The extension does not request access to every website, scan pages in the background, or transmit page contents. After a scan the toolbar badge displays the number of detected technologies until the page navigates.

Fingerprints come from [enthec/webappanalyzer](https://github.com/enthec/webappanalyzer) (GPL-3.0), so this repository is GPL-3.0 as well. Optional [How Its Built Pro](https://howitsbuilt.fyi) provides server-assisted details such as versions, hosting and evidence.

## Development

```sh
pnpm install
pnpm test
pnpm build
pnpm --filter extension zip
```

## Chrome Web Store permissions

- `activeTab` + `scripting`: inspect the tab only when the user opens the popup.
- `storage`: locally retain the optional account token.
- `https://howitsbuilt.fyi/*`: optional sign-in and Pro API only.

The previous automatic badge scanning and HTTP response-header detection have been removed to avoid `<all_urls>` and `webRequest`. Technologies detected **only** from response headers may no longer appear in the free scan; Pro details can provide additional server-side evidence. For store-submission text see [SUBMISSION.md](apps/extension/store/SUBMISSION.md).
