import { describe, expect, it } from "vitest";
import { SNAP_PARTS, crossedSnap, snapOffset, snapStorageKey } from "./snaps";

describe("snapOffset", () => {
  it("places snap k at k·H/10", () => {
    expect(SNAP_PARTS).toBe(10);
    expect(snapOffset(0, 1000)).toBe(0);
    expect(snapOffset(3, 1000)).toBe(300);
    expect(snapOffset(10, 1000)).toBe(1000);
  });
});

describe("crossedSnap", () => {
  it("returns the single snap crossed going down", () => {
    expect(crossedSnap(250, 350, 1000)).toBe(3);
  });

  it("returns the largest of several crossed snaps", () => {
    expect(crossedSnap(50, 780, 1000)).toBe(7);
    expect(crossedSnap(950, 2000, 1000)).toBe(10);
  });

  it("scrolling up crosses nothing", () => {
    expect(crossedSnap(350, 250, 1000)).toBeNull();
  });

  it("returns null when no snap is crossed", () => {
    expect(crossedSnap(310, 390, 1000)).toBeNull();
    expect(crossedSnap(300, 300, 1000)).toBeNull();
  });

  it("returns null when H is not positive", () => {
    expect(crossedSnap(0, 500, 0)).toBeNull();
    expect(crossedSnap(0, 500, -10)).toBeNull();
  });

  it("exact boundary: landing on a snap crosses it, starting on it does not", () => {
    expect(crossedSnap(299, 300, 1000)).toBe(3);
    expect(crossedSnap(300, 399, 1000)).toBeNull();
  });

  it("snap 0 never counts", () => {
    expect(crossedSnap(-10, 50, 1000)).toBeNull();
  });
});

describe("snapStorageKey", () => {
  it("is stable per title and chapter", () => {
    expect(snapStorageKey("One Piece", "1001")).toBe("reader.snap.One Piece.1001");
    expect(snapStorageKey("A", "1")).not.toBe(snapStorageKey("A", "2"));
  });
});
