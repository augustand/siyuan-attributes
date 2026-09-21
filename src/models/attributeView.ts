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
  content?: number;
  content2?: number;
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
  date?: DatabaseDateValue;
  options: DatabaseOption[];
  blockContent: string;
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
  "email",
  "phone",
  "number",
  "checkbox",
  "date",
  "select",
  "mSelect",
]);

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
  return typeof source[key] === "boolean" ? (source[key] as boolean) : fallback;
}

function readOptions(value: unknown): DatabaseOption[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const source = asRecord(item);
    const name = readString(source, "content") || readString(source, "name");
    return name ? [{ name, color: readString(source, "color") }] : [];
  });
}

function readKeyOptions(value: unknown): DatabaseOption[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const source = asRecord(item);
    const name = readString(source, "name") || readString(source, "content");
    return name ? [{ name, color: readString(source, "color") }] : [];
  });
}

function normalizeDate(value: unknown): DatabaseDateValue | undefined {
  const source = asRecord(value);
  const content = readOptionalNumber(source.content);
  const content2 = readOptionalNumber(source.content2);
  const isNotEmpty = readBoolean(source, "isNotEmpty", content !== undefined);

  if (!isNotEmpty && content === undefined && content2 === undefined) return undefined;

  return {
    content,
    content2,
    hasEndDate: readBoolean(source, "hasEndDate"),
    isNotTime: readBoolean(source, "isNotTime", true),
    isNotEmpty,
  };
}

function emptyDatabaseValue(
  key: Record<string, unknown>,
  keyType: DatabaseFieldType,
  itemID: string,
): DatabaseValue {
  const keyID = readString(key, "id");
  return {
    id: "",
    keyID,
    itemID,
    type: keyType,
    text: "",
    number: undefined,
    url: "",
    email: "",
    phone: "",
    template: "",
    checked: false,
    date: undefined,
    options: [],
    blockContent: "",
    raw: {},
  };
}

function normalizeDatabaseValue(
  key: Record<string, unknown>,
  rawValue: Record<string, unknown>,
): DatabaseValue {
  const keyID = readString(key, "id");
  const type = (readString(rawValue, "type") || readString(key, "type")) as DatabaseFieldType;

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
    date: normalizeDate(rawValue.date),
    options: readOptions(rawValue.mSelect),
    blockContent: readString(asRecord(rawValue.block), "content"),
    raw: rawValue,
  };
}

/**
 * Normalize `/api/av/getAttributeViewKeys` payload.
 * @param documentID fallback itemID when a key has no cell yet (bound doc id).
 */
export function normalizeAttributeViews(input: unknown, documentID = ""): DatabasePanel[] {
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
      if (!keyID) return [];

      const keyType = readString(key, "type") as DatabaseFieldType;
      if (!keyType || keyType === "lineNumber") return [];

      const options = readKeyOptions(key.options);
      const rawValues = Array.isArray(keyValue.values) ? keyValue.values : [];
      const rawValue = rawValues
        .map((item) => asRecord(item))
        .find((item) => readString(item, "blockID"));

      const value = rawValue
        ? normalizeDatabaseValue(key, rawValue)
        : emptyDatabaseValue(key, keyType, documentID);

      if (!value.itemID && documentID) {
        value.itemID = documentID;
      }

      const field: DatabaseField = {
        keyID,
        name: readString(key, "name"),
        type: keyType,
        icon: readString(key, "icon") || "view-list",
        editable: keyType !== "block" && editableTypes.has(keyType) && Boolean(value.itemID),
        value,
        options,
      };

      return [field];
    });

    return [
      {
        avID,
        avName: readString(table, "avName") || avID,
        fields,
      },
    ];
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
      if (!value.date || !value.date.isNotEmpty) {
        return { date: { isNotEmpty: false } };
      }
      return { date: value.date };
    case "select":
    case "mSelect":
      return {
        mSelect: value.options.map(({ name, color }) => ({ content: name, color })),
      };
    default:
      throw new Error(`Database field type is not writable: ${field.type}`);
  }
}

export function isDatabaseValueEmpty(field: DatabaseField): boolean {
  const { value, type } = field;
  switch (type) {
    case "text":
      return value.text.trim() === "";
    case "url":
      return value.url.trim() === "";
    case "email":
      return value.email.trim() === "";
    case "phone":
      return value.phone.trim() === "";
    case "number":
      return value.number === undefined;
    case "checkbox":
      return !value.checked;
    case "date":
      return !value.date || !value.date.isNotEmpty;
    case "select":
    case "mSelect":
      return value.options.length === 0;
    case "block":
      return value.blockContent.trim() === "";
    case "template":
      return value.template.trim() === "";
    default:
      return true;
  }
}
