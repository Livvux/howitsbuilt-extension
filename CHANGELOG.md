# Changelog

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
