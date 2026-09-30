/** Window event: doctree classify needs a new primary DB. */
export const CLASSIFY_NEED_CREATE_EVENT = "mux-doctree-classify:need-create";

export type ClassifyNeedCreateDetail = {
  docId: string;
  typeId: string;
};

/** Window event: doctree「更多表格…」picked; host opens the table picker dialog. */
export const CLASSIFY_PICK_TABLE_EVENT = "mux-doctree-classify:pick-table";

export type ClassifyPickTableDetail = {
  docId: string;
};
