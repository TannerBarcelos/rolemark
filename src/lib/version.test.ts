import { describe, expect, it } from "vitest";

import { BUILD, isBuildInfo, isNewerBuild } from "#/lib/version";

describe("isBuildInfo", () => {
  it("accepts a well-formed build", () => {
    expect(isBuildInfo({ id: "abc123", seq: 7 })).toBe(true);
  });

  it.each([
    null,
    undefined,
    "abc",
    1,
    {},
    { id: "abc" },
    { seq: 1 },
    { id: 1, seq: 1 },
    { id: "a", seq: "1" },
  ])("rejects %j", (value) => {
    expect(isBuildInfo(value)).toBe(false);
  });
});

describe("isNewerBuild", () => {
  const running = { id: "old", seq: 5 };

  it("is true only when the live build has a higher seq", () => {
    expect(isNewerBuild({ id: "new", seq: 6 }, running)).toBe(true);
    expect(isNewerBuild({ id: "same", seq: 5 }, running)).toBe(false);
    expect(isNewerBuild({ id: "older", seq: 4 }, running)).toBe(false);
  });

  it("ignores id, so a rebuild of the same seq never prompts", () => {
    expect(isNewerBuild({ id: "different-sha", seq: 5 }, running)).toBe(false);
  });
});

describe("BUILD", () => {
  it("comes from the build-time defines", () => {
    expect(BUILD).toEqual({ id: "test", seq: 1 });
  });
});
