/** SiYuan stores document `updated`/`created` as compact local timestamps. */
const COMPACT_TIMESTAMP = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/;

export function parseAliasTags(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

export function serializeAliasTags(tags: unknown): string {
  if (!Array.isArray(tags)) return "";
  return parseAliasTags(tags.map((tag) => String(tag ?? "")).join(",")).join(",");
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function parseSiYuanTimestamp(raw: unknown): Date | undefined {
  if (typeof raw !== "string") return undefined;
  const match = COMPACT_TIMESTAMP.exec(raw.trim());
  if (!match) return undefined;
  const [, y, mo, d, h, mi, s] = match;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  );
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export function formatSiYuanTimestampDisplay(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const date = parseSiYuanTimestamp(raw);
  if (!date) return raw;
  const y = date.getFullYear();
  const mo = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  const s = pad2(date.getSeconds());
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

export function toSiYuanTimestamp(date: Date | undefined | null): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds()),
  ].join("");
}
