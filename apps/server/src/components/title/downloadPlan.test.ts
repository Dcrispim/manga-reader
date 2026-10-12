import { describe, it, expect } from "vitest";
import { normalizeStats } from "./statsReport";
import { planDownload } from "./downloadPlan";

const TPL = "https://imperiodabritannia.net/manga/remonster/capitulo/{chapter}";
const stats = (chapters: string[], gaps: { start: number; end: number }[] = []) =>
  normalizeStats({ chapters: chapters.map((chapterName) => ({ chapterName, imageCount: 10 })), gaps });

describe("planDownload", () => {
  it("asks for the range after the last chapter plus the gaps", () => {
    expect(planDownload(stats(["1", "2", "93"], [{ start: 3, end: 92 }]), TPL, "106")).toEqual({
      kind: "request",
      request: { template: TPL, start: "94", end: "106", gaps: true, update: false },
    });
  });

  it("leaves --gaps out when there are none", () => {
    expect(planDownload(stats(["93"]), TPL, "95")).toEqual({ kind: "request", request: { template: TPL, start: "94", end: "95", gaps: false, update: false } });
  });

  it("only gaps when the latest chapter is missing, older or the same", () => {
    const s = stats(["1", "3"], [{ start: 2, end: 2 }]);
    const onlyGaps = { kind: "request", request: { template: TPL, gaps: true, update: false } };
    expect(planDownload(s, TPL, "")).toEqual(onlyGaps);
    expect(planDownload(s, TPL, "3")).toEqual(onlyGaps);
    expect(planDownload(s, TPL, "2")).toEqual(onlyGaps);
  });

  it("passes sobrescrever along as update", () => {
    expect(planDownload(stats(["93"], [{ start: 5, end: 5 }]), TPL, "", true)).toEqual({
      kind: "request",
      request: { template: TPL, gaps: true, update: true },
    });
  });

  it("is up to date with no gaps and nothing newer", () => {
    expect(planDownload(stats(["1", "2"]), TPL, "")).toEqual({ kind: "up-to-date" });
    expect(planDownload(stats(["1", "2"]), TPL, "2")).toEqual({ kind: "up-to-date" });
  });

  it("handles decimal chapters", () => {
    expect(planDownload(stats(["10.5"]), TPL, "12")).toMatchObject({ request: { start: "11", end: "12" } });
    expect(planDownload(stats(["10"]), TPL, "10.5")).toMatchObject({ request: { start: "10.5", end: "10.5" } });
  });

  it("rejects a bad template or chapter", () => {
    expect(planDownload(stats(["1"]), "https://x/cap", "5").kind).toBe("invalid");
    expect(planDownload(stats(["1"]), "x/{chapter}", "5").kind).toBe("invalid");
    expect(planDownload(stats(["1"]), TPL, "abc").kind).toBe("invalid");
  });
});
