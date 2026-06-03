import { describe, expect, it } from "vitest";

import { getAuthenticatedAuthRedirectDestination } from "@/proxy";

describe("getAuthenticatedAuthRedirectDestination", () => {
  it("falls back to studio when redirect is an absolute URL", () => {
    expect(
      getAuthenticatedAuthRedirectDestination("https://evil.example/phish")
    ).toBe("/studio");
  });

  it("falls back to studio when redirect is protocol-relative", () => {
    expect(getAuthenticatedAuthRedirectDestination("//evil.example/phish")).toBe(
      "/studio"
    );
  });

  it("keeps allowed relative redirects", () => {
    expect(getAuthenticatedAuthRedirectDestination("/studio?view=admin")).toBe(
      "/studio?view=admin"
    );
  });
});
