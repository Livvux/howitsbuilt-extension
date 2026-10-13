# Changelog

## 0.3.0 — 2026-10-13

### Added
- Server, CDN and hosting technologies are detected again, from one cookieless request to the site's own homepage during the scan (no new permissions).
- Versions found on the page are shown next to each technology.
- Pro details are merged into the list (server-only technologies, versions, evidence) and cached for 10 minutes.
- Rescan button, Markdown and JSON export, and a filter for long lists.
- Keyboard shortcut Alt+Shift+H.
- German translation.
- Firefox build (`zip:firefox`).

### Changed
- Scans start faster: fingerprints compile while the page is being inspected.
- Runtime errors show "Something went wrong" instead of "Can't inspect this page".
- Fingerprints are synced weekly from upstream via an automated pull request.

## 0.2.1 — 2026-10-12

### Changed
- Removed the broad "access all sites" permission. Pages are now inspected only when you open the popup (`activeTab`); the only persistent host access is the How Its Built account API.
- Removed the unused `webRequest` permission.

## 0.2.0 — 2026-10-08

### Added
- Sign in with your How Its Built account from the website to see Pro details (versions, confidence and evidence) in the popup.
- A second scan a few seconds after load catches frameworks that hydrate late (for example React on large apps).

### Fixed
- Single-page apps keep header-based detections after in-app navigation.
- Modern Angular sites are no longer hidden by a conflicting AngularDart match.
- Closing a tab while it is being analyzed no longer logs errors.

## 0.1.0 — 2026-10-08

### Added
- Detects 7,600+ technologies on every page you visit: frameworks, CMS, e-commerce, analytics, CDN, payments and more.
- Badge with the number of technologies found on the current tab.
- Popup listing the stack grouped by category, with links to each technology's website.
- Copy the whole stack as text with one click.
- Detection runs locally in your browser; the extension sends no data anywhere.
