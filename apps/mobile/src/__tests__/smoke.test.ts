import * as contract from "@manga/api-contract";
import { CORE_VERSION } from "@manga/core";

describe("workspace packages", () => {
  it("resolves @manga/core", () => {
    expect(typeof CORE_VERSION).toBe("number");
  });

  it("resolves @manga/api-contract", () => {
    expect(Object.keys(contract).length).toBeGreaterThan(0);
  });
});
