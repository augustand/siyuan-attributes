type I18nTree = Record<string, unknown>;

let currentI18n: I18nTree = {};

export function setI18n(i18n?: I18nTree): void {
  currentI18n = i18n ?? {};
}

export function getI18nText(path: string, fallback: string): string {
  let value: unknown = currentI18n;

  for (const segment of path.split(".")) {
    if (!value || typeof value !== "object" || !(segment in value)) {
      return fallback;
    }
    value = (value as I18nTree)[segment];
  }

  return typeof value === "string" ? value : fallback;
}
