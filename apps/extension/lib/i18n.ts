/** Localized string from public/_locales/<lang>/messages.json; keys are type-checked by WXT. */
type Key = Parameters<typeof browser.i18n.getMessage>[0];
export const t = (key: Key, ...subs: string[]): string => browser.i18n.getMessage(key, subs);
