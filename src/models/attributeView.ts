export type DatabaseFieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "mSelect"
  | "url"
  | "email"
  | "phone"
  | "checkbox"
  | "template"
  | "relation"
  | "rollup"
  | "mAsset"
  | "created"
  | "updated"
  | "block"
  | "lineNumber";

export interface DatabaseOption {
  name: string;
  color: string;
}

export interface DatabaseDateValue {
  content: number;
  content2: number;
  isNotEmpty2: boolean;
  hasEndDate: boolean;
  isNotTime: boolean;
  isNotEmpty: boolean;
}

export interface DatabaseValue {
  id: string;
  keyID: string;
  itemID: string;
  type: DatabaseFieldType;
  text: string;
  number?: number;
  url: string;
  email: string;
  phone: string;
  template: string;
  checked: boolean;
  date: DatabaseDateValue;
  options: DatabaseOption[];
  raw: Record<string, unknown>;
}

export interface DatabaseField {
  keyID: string;
  name: string;
  type: DatabaseFieldType;
  icon: string;
  editable: boolean;
  value: DatabaseValue;
  options: DatabaseOption[];
}

export interface DatabasePanel {
  avID: string;
  avName: string;
  fields: DatabaseField[];
}

const editableTypes = new Set<DatabaseFieldType>([
  "text",
  "url",
  "number",
  "checkbox",
  "date",
  "select",
  "mSelect",
]);

const optionTypes = new Set<DatabaseFieldType>(["select", "mSelect"]);

function emptyDatabaseDate(): DatabaseDateValue {
  return {
    content: 0,
    content2: 0,
    isNotEmpty: false,
    isNotEmpty2: false,
    hasEndDate: false,
    isNotTime: true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readBoolean(source: Record<string, unknown>, key: string, fallback = false): boolean {
  return typeof source[key] === "boolean" ? source[key] as boolean : fallback;
}

function readOptions(value: unknown): DatabaseOption[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const source = asRecord(item);
    const name = readString(source, "content");
    return name ? [{ name, color: readString(source, "color") }] : [];
  });
}

function readKeyOptions(value: unknown): DatabaseOption[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const source = asRecord(item);
    const name = readString(source, "name");
    return name ? [{ name, color: readString(source, "color") }] : [];
  });
}

function normalizeDate(value: unknown): DatabaseDateValue | undefined {
  const source = asRecord(value);
  const content = readOptionalNumber(source.content);
  const content2 = readOptionalNumber(source.content2);
  const isNotEmpty = readBoolean(source, "isNotEmpty", content !== undefined);
  const isNotEmpty2 = readBoolean(source, "isNotEmpty2", content2 !== undefined);

  if (!isNotEmpty && content === undefined && content2 === undefined) return undefined;

  return {
    content: content ?? 0,
    content2: content2 ?? 0,
    isNotEmpty2,
    hasEndDate: readBoolean(source, "hasEndDate"),
    isNotTime: readBoolean(source, "isNotTime", true),
    isNotEmpty,
  };
}

function normalizeDatabaseValue(
  key: Record<string, unknown>,
  rawValue: Record<string, unknown>,
): DatabaseValue {
  const keyID = readString(key, "id");
  const type = readString(rawValue, "type") as DatabaseFieldType;

  return {
    id: readString(rawValue, "id"),
    keyID: readString(rawValue, "keyID") || keyID,
    itemID: readString(rawValue, "blockID"),
    type,
    text: readString(asRecord(rawValue.text), "content"),
    number: readOptionalNumber(asRecord(rawValue.number).content),
    url: readString(asRecord(rawValue.url), "content"),
    email: readString(asRecord(rawValue.email), "content"),
    phone: readString(asRecord(rawValue.phone), "content"),
    template: readString(asRecord(rawValue.template), "content"),
    checked: readBoolean(asRecord(rawValue.checkbox), "checked"),
    date: normalizeDate(rawValue.date) ?? emptyDatabaseDate(),
    options: readOptions(rawValue.mSelect),
    raw: rawValue,
  };
}

export function normalizeAttributeViews(input: unknown): DatabasePanel[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((tableInput) => {
    const table = asRecord(tableInput);
    const avID = readString(table, "avID");
    if (!avID) return [];

    const keyValues = Array.isArray(table.keyValues) ? table.keyValues : [];
    const fields = keyValues.flatMap((keyValueInput) => {
      const keyValue = asRecord(keyValueInput);
      const key = asRecord(keyValue.key);
      const keyID = readString(key, "id");
      if (!keyID || readString(key, "type") === "block") return [];

      const keyType = readString(key, "type") as DatabaseFieldType;
      const options = readKeyOptions(key.options);
      const rawValues = Array.isArray(keyValue.values) ? keyValue.values : [];
      const rawValue = rawValues.map((item) => asRecord(item)).find((item) => readString(item, "blockID"));

      if (!rawValue) return [];

      const value = normalizeDatabaseValue(key, rawValue);
      const field: DatabaseField = {
        keyID,
        name: readString(key, "name"),
        type: keyType,
        icon: readString(key, "icon") || "view-list",
        editable: editableTypes.has(keyType)
          && Boolean(value.itemID)
          && (!optionTypes.has(keyType) || options.length > 0),
        value,
        options,
      };

      return [field];
    });

    return [{
      avID,
      avName: readString(table, "avName") || avID,
      fields,
    }];
  });
}

export function buildDatabaseCellValue(field: DatabaseField, value: DatabaseValue): unknown {
  switch (field.type) {
    case "text":
      return { text: { content: value.text } };
    case "number":
      return {
        number: {
          content: value.number ?? 0,
          isNotEmpty: value.number !== undefined,
        },
      };
    case "url":
      return { url: { content: value.url } };
    case "email":
      return { email: { content: value.email } };
    case "phone":
      return { phone: { content: value.phone } };
    case "checkbox":
      return { checkbox: { checked: value.checked } };
    case "date":
      return { date: value.date };
    case "select":
    case "mSelect":
      return { mSelect: value.options.map(({ name, color }) => ({ name, color })) };
    default:
      throw new Error(`Database field type is not writable: ${field.type}`);
  }
}
