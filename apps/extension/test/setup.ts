import { readFileSync } from 'node:fs';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// The fake browser doesn't implement i18n; serve the English catalog so UI assertions stay readable.
const en: Record<string, { message: string }> = JSON.parse(readFileSync('public/_locales/en/messages.json', 'utf8'));

beforeEach(() => {
  fakeBrowser.i18n.getMessage = ((key: string) => en[key]?.message ?? '') as typeof fakeBrowser.i18n.getMessage;
  fakeBrowser.i18n.getUILanguage = () => 'en';
});
