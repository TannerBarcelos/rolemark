import { describe, expect, it } from "vitest";

import { sanitizeRedirect } from "#/lib/redirect";

describe("sanitizeRedirect", () => {
  it.each(["/dashboard", "/settings?tab=profile", "/a/b#section"])(
    "keeps same-origin path %s",
    (url) => {
      expect(sanitizeRedirect(url)).toBe(url);
    },
  );

  it.each([
    ["protocol-relative URL", "//evil.example.com"],
    ["absolute URL", "https://evil.example.com"],
    ["relative path", "dashboard"],
    ["empty string", ""],
  ])("falls back to /dashboard for a %s", (_label, url) => {
    expect(sanitizeRedirect(url)).toBe("/dashboard");
  });

  it.each([undefined, null, 42, { href: "/dashboard" }])("falls back for non-string %j", (url) => {
    expect(sanitizeRedirect(url)).toBe("/dashboard");
  });
});
