# Privacy — How Its Built extension

**The free extension sends no data anywhere.** Detection runs entirely inside your browser.

What the extension reads, and why:

| Permission | Why |
|---|---|
| Access to all sites (`<all_urls>`) | To inspect the page you are on: its HTML, script URLs, meta tags, cookie names and JavaScript globals. Technologies are recognized from these signals. |
| `webRequest` | To read the response headers of the page you load (for example `x-powered-by`, `server`). Headers are read, never modified or blocked. |
| `scripting` | To run the detection script in the page when it finishes loading. |
| `storage` | To keep the result for each open tab until you close it (`chrome.storage.session`, cleared when the browser closes). |

Nothing is stored after the tab is closed, nothing is sold, and there are no analytics or trackers in the extension.

**Optional account.** If you sign in on howitsbuilt.fyi/connect, a small script that runs only on howitsbuilt.fyi passes your session token to the extension, which stores it locally (`chrome.storage.local`). The extension then asks `howitsbuilt.fyi` which plan you have when you open the popup. Only when you open the **Details** tab (Pro) does it send the domain of the current tab to `howitsbuilt.fyi` to fetch versions and evidence. Signing out on the website ends the session; the extension then forgets the token. This is covered by the website's privacy policy: https://howitsbuilt.fyi/privacy

Questions: https://github.com/Livvux/howitsbuilt-extension/issues
