import { describe, expect, it } from "vitest";
import { pageMeta, pageNumbers, paginate, parsePageSize } from "./pagination";

const items = Array.from({ length: 23 }, (_, i) => i + 1);

describe("paginate", () => {
  it("shows 10 per page by default", () => {
    expect(paginate(items, undefined)).toMatchObject({
      page: 1,
      pages: 3,
      from: 1,
      to: 10,
      total: 23,
    });
    expect(paginate(items, "3")).toMatchObject({ items: [21, 22, 23], from: 21, to: 23 });
  });

  it("falls back into range for bad page numbers", () => {
    expect(paginate(items, "99").page).toBe(3);
    expect(paginate(items, "0").page).toBe(1);
    expect(paginate(items, "abc").page).toBe(1);
  });

  it("handles an empty list", () => {
    expect(paginate([], "2")).toMatchObject({ items: [], page: 1, pages: 1, from: 0, to: 0 });
  });
});

describe("pageNumbers", () => {
  it("lists every page when there are few", () => {
    expect(pageNumbers(2, 3)).toEqual([1, 2, 3]);
  });

  it("keeps first, last and neighbours with gaps when there are many", () => {
    expect(pageNumbers(1, 20)).toEqual([1, 2, 3, 4, "gap", 20]);
    expect(pageNumbers(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
    expect(pageNumbers(20, 20)).toEqual([1, "gap", 17, 18, 19, 20]);
  });
});

describe("parsePageSize", () => {
  it("accepts 5, 10, 20 or 50 and defaults to 10", () => {
    expect([5, 10, 20, 50].map((n) => parsePageSize(String(n)))).toEqual([5, 10, 20, 50]);
    expect(parsePageSize(undefined)).toBe(10);
    expect(parsePageSize("7")).toBe(10);
    expect(parsePageSize("1000")).toBe(10);
  });

  it("drives how many rows a page holds", () => {
    expect(paginate(items, "2", parsePageSize("5"))).toMatchObject({ pages: 5, from: 6, to: 10 });
  });
});

describe("pageMeta", () => {
  it("turns a total count into the page to fetch", () => {
    expect(pageMeta(23, undefined)).toEqual({ page: 1, pages: 3, from: 1, to: 10, offset: 0 });
    expect(pageMeta(23, "3")).toEqual({ page: 3, pages: 3, from: 21, to: 23, offset: 20 });
    expect(pageMeta(11, "2", 5)).toEqual({ page: 2, pages: 3, from: 6, to: 10, offset: 5 });
  });

  it("clamps bad pages and handles zero rows", () => {
    expect(pageMeta(23, "99").page).toBe(3);
    expect(pageMeta(23, "abc").page).toBe(1);
    expect(pageMeta(0, "4")).toEqual({ page: 1, pages: 1, from: 0, to: 0, offset: 0 });
  });
});
