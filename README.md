# How Its Built — browser extension

Open-source Chrome extension that shows how the **current website** is built: frameworks, CMS, analytics and more.

**Click the extension icon to scan the active tab.** Detection runs locally, on demand, using Chrome's `activeTab` permission. The extension does not request access to every website, scan pages in the background, or transmit page contents. After a scan the toolbar badge displays the number of detected technologies until the page navigates.

Fingerprints come from [enthec/webappanalyzer](https://github.com/enthec/webappanalyzer) (GPL-3.0), so this repository is GPL-3.0 as well. Optional [How Its Built Pro](https://howitsbuilt.fyi) provides server-assisted details such as versions, hosting and evidence.

## Development

```sh
pnpm install
pnpm test
pnpm build
pnpm --filter extension zip           # Chrome / Edge
pnpm --filter extension zip:firefox   # Firefox (AMO, incl. sources zip)
```

Fingerprints are synced weekly from upstream by the `Update fingerprints` workflow (opens a PR).

## Chrome Web Store permissions

- `activeTab` + `scripting`: inspect the tab only when the user opens the popup.
- `storage`: locally retain the optional account token (and a 10-minute Pro result cache in session storage).
- `https://howitsbuilt.fyi/*`: optional sign-in and Pro API only.

There is no `<all_urls>` or `webRequest`: response headers are read from one cookieless same-origin `HEAD` request to the site's homepage during the scan. Shortcut: `Alt+Shift+H`. For store-submission text see [SUBMISSION.md](apps/extension/store/SUBMISSION.md).
