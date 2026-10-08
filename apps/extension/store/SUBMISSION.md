# Chrome Web Store submission — v0.2.1

Dashboard: https://chrome.google.com/webstore/devconsole → upload a fresh build of `apps/extension/.output/extension-0.2.1-chrome.zip`.

Build the ZIP from this branch (or after merging):

```sh
pnpm install --frozen-lockfile
pnpm --filter extension zip
```

Do **not** upload the old v0.2.0 release ZIP: it still requests access to all sites.

## Store listing

| Field | Value |
|---|---|
| Language | English |
| Description | Copy the **Description** block from `description.md` |
| Category | Developer Tools |
| Store icon (128×128) | `apps/extension/public/icon-128.png` |
| Screenshots (1280×800) | `store/screenshot-1.png`, `store/screenshot-2.png`, `store/screenshot-3.png` |
| Small promo tile (440×280) | `store/promo-small-440x280.png` |
| Official URL / Homepage | `https://howitsbuilt.fyi` |
| Support URL | `https://github.com/Livvux/howitsbuilt-extension/issues` |

**Update screenshots if they still claim the badge runs automatically.** The user now explicitly opens the extension to scan.

## Privacy practices

**Single purpose**

> Identify the technologies used by the active website when the user opens the extension popup. The free scan runs locally; signed-in Pro users can request additional details for the current domain.

**Permission justifications**

| Permission | Justification |
|---|---|
| `activeTab` | Grants temporary access to the current website only after the user opens the extension popup to request a technology scan. |
| `scripting` | Injects bundled, read-only detection code into the user-invoked active tab. It reads HTML, scripts, meta tags, cookie names and values, and other website signals locally without altering pages. |
| `storage` | Stores only the optional account sign-in token in `chrome.storage.local`. No persistent scan history is kept. |
| Host permission `https://howitsbuilt.fyi/*` | Necessary to authenticate with our account and Pro API; this is the only permanently accessible host. The same host runs a dedicated sign-in bridge content script. |

**No `webRequest` and no `<all_urls>` permission.** HTTP response headers and automatic per-navigation scans are not included in the free scan.

**Remote code:** No. All JavaScript and fingerprint data are bundled. Signed-in account/Pro requests fetch JSON, not executable code.

**Data usage:** Disclose **Personally identifiable information** (account email), **Authentication information** (optional local session token), **Web history** (current domain sent for explicitly requested Pro details), and **Website content** (HTML, scripts, text, cookies and DOM inspected locally). The free scan does not send this page content to any server. For other data types, check the actual production website/API behavior before submitting.

**Certifications:** Tick all three only after confirming the account/Pro backend also meets the Chrome Web Store user-data policy.

**Privacy policy URL:** `https://github.com/Livvux/howitsbuilt-extension/blob/main/PRIVACY.md` (after merging this PR).

## Distribution

- Visibility: Public · Regions: all · Payment: free (optional paid Pro feature)
- Submit the freshly built ZIP for review.
- Optional: defer publication until the website is ready.

After approval, replace the GitHub-release link in the web app's `content/links.ts` with the Chrome Web Store URL.

## User experience after this change

1. Opening the toolbar popup grants `activeTab` and starts scanning the current page.
2. The toolbar badge shows the count only after the scan and resets when the page navigates.
3. Automatic per-page badge updates and header-only fingerprints are no longer available in the free extension.
4. Optional account status and Pro details still use the narrowly scoped `howitsbuilt.fyi` host permission.
