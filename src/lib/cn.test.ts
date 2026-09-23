import { describe, expect, it } from "vitest";

import { cn } from "#/lib/cn";

describe("cn", () => {
  it("drops falsy values and flattens conditionals", () => {
    expect(cn("px-2", false, undefined, { "font-bold": true, italic: false })).toBe(
      "px-2 font-bold",
    );
  });

  it("lets later Tailwind classes override earlier conflicting ones", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("merges custom token utilities", () => {
    expect(cn("bg-surface", "bg-accent")).toBe("bg-accent");
  });
});
