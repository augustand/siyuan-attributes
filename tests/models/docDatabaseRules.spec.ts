import { describe, expect, it } from "vitest";
import {
  matchDocDatabaseRules,
  normalizeDocDatabaseRule,
  normalizeDocDatabaseRules,
  type DocDatabaseRule,
} from "@/models/docDatabaseRules";

const base: DocDatabaseRule = {
  id: "r1",
  name: "Tasks",
  avID: "av-1",
  avBlockID: "block-1",
  enabled: true,
  notebookId: "nb-1",
};

describe("normalizeDocDatabaseRule", () => {
  it("requires avID, avBlockID, and notebook or path", () => {
    expect(normalizeDocDatabaseRule({ avID: "a", avBlockID: "b" })).toBeUndefined();
    expect(
      normalizeDocDatabaseRule({
        avID: "a",
        avBlockID: "b",
        notebookId: "nb",
        name: "N",
      }),
    ).toMatchObject({ avID: "a", notebookId: "nb", enabled: true });
  });
});

describe("matchDocDatabaseRules", () => {
  it("matches notebook and prefers longer path prefix", () => {
    const rules = normalizeDocDatabaseRules([
      { ...base, id: "nb", pathPrefix: undefined },
      {
        ...base,
        id: "short",
        pathPrefix: "/foo",
        notebookId: "nb-1",
      },
      {
        ...base,
        id: "long",
        pathPrefix: "/foo/bar",
        notebookId: "nb-1",
      },
      { ...base, id: "off", enabled: false, pathPrefix: "/foo/bar/baz" },
    ]);

    const matched = matchDocDatabaseRules(
      { notebookId: "nb-1", path: "/foo/bar/x.md" },
      rules,
    );
    expect(matched.map((r) => r.id)).toEqual(["long", "short", "nb"]);
  });

  it("returns empty when nothing matches", () => {
    expect(
      matchDocDatabaseRules({ notebookId: "other", path: "/z" }, [base]),
    ).toEqual([]);
  });
});
