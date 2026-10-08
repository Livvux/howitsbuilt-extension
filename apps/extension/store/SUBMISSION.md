# Chrome Web Store submission — v0.1.0

Dashboard: https://chrome.google.com/webstore/devconsole → **New item** → upload `apps/extension/.output/extension-0.1.0-chrome.zip`
(also attached to the GitHub release: https://github.com/Livvux/howitsbuilt-extension/releases/tag/v0.1.0).

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

## Privacy practices

**Single purpose**

> Identify the technologies (frameworks, CMS, analytics, hosting and similar tools) used by the website in the current tab and show them in the toolbar popup.

**Permission justifications**

| Permission | Justification |
|---|---|
| `scripting` | Runs a read-only detection script in the page after it loads to read script URLs, meta tags, cookie names and JavaScript globals that identify technologies. It never modifies the page. |
| `storage` | Keeps the detection result for each open tab in `chrome.storage.session` so the popup can show it; cleared when the tab or browser closes. |
| `webRequest` | Reads the response headers of the top-level page (e.g. `server`, `x-powered-by`) because many technologies are only identifiable from headers. Headers are only read, never blocked or modified. |
| Host permission `<all_urls>` | Technology detection must work on any website the user visits; the extension reads the current page and its headers locally. No data is sent to any server. |

**Remote code:** No, I am not using remote code. (All JavaScript is bundled in the package.)

**Data usage:** check **none** of the data types. Page content and headers are processed locally and never collected or transmitted.

Tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** `https://github.com/Livvux/howitsbuilt-extension/blob/main/PRIVACY.md`

## Distribution

- Visibility: Public · Regions: all · Payment: free
- Submit for review. Optional: tick "Defer publish" if the website should be live first.

After approval: replace the GitHub-release link in the web app's `content/links.ts` with the store URL.
