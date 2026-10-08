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

How Its Built Pro (optional, paid) sends the URL of the page you choose to analyze to `howitsbuilt.fyi` when you open the Pro view. That is a separate, explicit action and is covered by the website's privacy policy.

Contact: privacy@howitsbuilt.fyi
