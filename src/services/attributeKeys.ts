export const customAttributeKeyPattern = /^custom-[a-z][a-z0-9-]*$/;

export function normalizeCustomAttributeKey(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const key = trimmed.startsWith("custom-") ? trimmed : `custom-${trimmed}`;

  if (!customAttributeKeyPattern.test(key)) {
    throw new Error("Attribute key must use lowercase letters, numbers, and hyphens");
  }

  return key;
}

export function isNormalizableCustomAttributeKey(input: string): boolean {
  try {
    normalizeCustomAttributeKey(input);
    return true;
  } catch {
    return false;
  }
}
