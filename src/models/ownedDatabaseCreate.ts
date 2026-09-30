/** SiYuan-style block / AV id: `YYYYMMDDHHmmss` + `-` + 7 alphanumerics. */
export function newSiYuanID(now = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    + `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 7; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return `${stamp}-${suffix}`;
}

/**
 * Minimal empty attribute-view JSON: ONLY the primary block key (named after
 * the table) + one table view. The old seeded 单选 column is gone — template
 * columns are appended later via ensureOwnedDatabaseTemplateColumns.
 * Spec 8 is current PlainTextSpec in recent SiYuan builds.
 *
 * `keyName` names the primary block key independently of the AV `name`:
 * the duplicate pipeline seeds with an EMPTY AV name (the kernel appends
 * " (Duplicated …)" only to non-empty names) while the column still shows
 * the final table title.
 */
export function buildEmptyAttributeViewJson(input: {
  avID: string;
  name: string;
  keyName?: string;
  ids?: {
    blockKeyID?: string;
    viewID?: string;
    tableID?: string;
  };
}): Record<string, unknown> {
  const keyName = (input.keyName ?? input.name).trim() || "未命名";
  const blockKeyID = input.ids?.blockKeyID ?? newSiYuanID();
  const viewID = input.ids?.viewID ?? newSiYuanID();
  const tableID = input.ids?.tableID ?? newSiYuanID();

  return {
    spec: 8,
    id: input.avID,
    name: input.name,
    keyValues: [
      {
        key: {
          id: blockKeyID,
          name: keyName,
          type: "block",
          icon: "",
          desc: "",
          numberFormat: "",
          template: "",
        },
      },
    ],
    keyIDs: null,
    views: [
      {
        id: viewID,
        icon: "",
        name: "表格",
        hideAttrViewName: false,
        desc: "",
        filters: [{ column: "", operator: "", value: null, combination: "and" }],
        pageSize: 50,
        type: "table",
        table: {
          spec: 0,
          id: tableID,
          showIcon: true,
          wrapField: false,
          columns: [
            { id: blockKeyID, wrap: false, hidden: false, pin: false, width: "" },
          ],
          rowIds: null,
        },
        groupCreated: 0,
        groupItemIds: null,
        groupFolded: false,
        groupHidden: 0,
        groupSort: 0,
      },
    ],
  };
}

export function attributeViewBlockDom(avID: string, blockID: string): string {
  return (
    `<div data-node-id="${blockID}" data-type="NodeAttributeView" `
    + `data-av-id="${avID}" data-av-type="table" data-subtype="table" class="av"></div>`
  );
}

/** Extra columns of the legacy generic type template (added after the primary block key). */
export const DEFAULT_OWNED_DATABASE_COLUMNS: ReadonlyArray<{
  name: string;
  type: string;
}> = [
  { name: "文本", type: "text" },
  { name: "数字", type: "number" },
  { name: "日期", type: "date" },
  { name: "多选", type: "mSelect" },
  { name: "勾选", type: "checkbox" },
  { name: "链接", type: "url" },
];

