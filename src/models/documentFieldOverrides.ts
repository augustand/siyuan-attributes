/** Valid SiYuan custom attr: custom-[a-z][a-z0-9-]* (no underscores). */
export const DOCUMENT_FIELD_OVERRIDES_ATTR = "custom-mux-attrs-doc-fields";

/** Legacy key with underscores — rejected by SiYuan setBlockAttrs; migrate away. */
export const DOCUMENT_FIELD_OVERRIDES_ATTR_LEGACY = "custom-mux-attrs__doc__fields";

export interface DocumentFieldOverride {
  display: boolean;
  displayAs: string;
  order: number;
  editable: boolean;
}

export interface DocumentFieldOverrides {
  v: 1;
  fields: Record<string, DocumentFieldOverride>;
}

export function isReservedDocumentAttributeKey(name: string): boolean {
  return name === DOCUMENT_FIELD_OVERRIDES_ATTR || name === DOCUMENT_FIELD_OVERRIDES_ATTR_LEGACY;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function string(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeOverride(input: unknown): DocumentFieldOverride | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const source = input as Record<string, unknown>;
  return {
    display: bool(source.display, true),
    displayAs: string(source.displayAs, ""),
    order: number(source.order, 1000),
    editable: bool(source.editable, true),
  };
}

export function parseDocumentFieldOverrides(raw: unknown): DocumentFieldOverrides {
  const empty: DocumentFieldOverrides = { v: 1, fields: {} };
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return empty;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return empty;
    }
  }
  if (typeof parsed !== "object" || parsed === null) return empty;
  const source = parsed as Record<string, unknown>;
  const fieldsIn = typeof source.fields === "object" && source.fields !== null
    ? source.fields as Record<string, unknown>
    : {};
  const fields: Record<string, DocumentFieldOverride> = {};
  for (const [key, value] of Object.entries(fieldsIn)) {
    if (!key || isReservedDocumentAttributeKey(key)) continue;
    const override = normalizeOverride(value);
    if (override) fields[key] = override;
  }
  return { v: 1, fields };
}

/** Prefer the valid key; fall back to legacy underscore key if present. */
export function readDocumentFieldOverridesFromAttrs(
  attrs: Record<string, string>,
): DocumentFieldOverrides {
  if (Object.prototype.hasOwnProperty.call(attrs, DOCUMENT_FIELD_OVERRIDES_ATTR)) {
    return parseDocumentFieldOverrides(attrs[DOCUMENT_FIELD_OVERRIDES_ATTR]);
  }
  if (Object.prototype.hasOwnProperty.call(attrs, DOCUMENT_FIELD_OVERRIDES_ATTR_LEGACY)) {
    return parseDocumentFieldOverrides(attrs[DOCUMENT_FIELD_OVERRIDES_ATTR_LEGACY]);
  }
  return { v: 1, fields: {} };
}

export function serializeDocumentFieldOverrides(data: DocumentFieldOverrides): string {
  return JSON.stringify({
    v: 1,
    fields: data.fields ?? {},
  });
}

export function applyDocumentFieldOverride<T extends DocumentFieldOverride>(
  base: T,
  override: DocumentFieldOverride | undefined,
): T {
  if (!override) return base;
  return {
    ...base,
    display: override.display,
    displayAs: override.displayAs,
    order: override.order,
    editable: override.editable,
  };
}
