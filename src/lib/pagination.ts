// Page-based slicing for lists (the Call Log shows 10 calls per page).

export const PAGE_SIZE = 10;
export const PAGE_SIZES = [5, 10, 20, 50] as const;

/** The rows-per-page choice from the URL; anything else falls back to the default (10). */
export function parsePageSize(value: string | undefined): number {
  const n = Number(value);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : PAGE_SIZE;
}

export interface Page<T> {
  items: T[];
  page: number;
  pages: number;
  /** 1-based positions of the first and last item shown (0 when empty). */
  from: number;
  to: number;
  total: number;
}

/** Slices `items` to one page. Bad or out-of-range page numbers fall back into range. */
export function paginate<T>(items: T[], pageParam: string | undefined, size = PAGE_SIZE): Page<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const requested = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), pages) : 1;
  const start = (page - 1) * size;
  const slice = items.slice(start, start + size);
  return {
    items: slice,
    page,
    pages,
    from: slice.length ? start + 1 : 0,
    to: start + slice.length,
    total,
  };
}

export interface PageMeta {
  page: number;
  pages: number;
  from: number;
  to: number;
  /** Rows to skip in the database query. */
  offset: number;
}

/**
 * Page numbers for a list the database pages for us: from the total row count, the
 * requested page (clamped into range) and the page size.
 */
export function pageMeta(total: number, pageParam: string | undefined, size = PAGE_SIZE): PageMeta {
  const pages = Math.max(1, Math.ceil(total / size));
  const requested = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), pages) : 1;
  const offset = (page - 1) * size;
  const to = Math.min(total, offset + size);
  return { page, pages, from: total ? offset + 1 : 0, to, offset };
}

/** Page buttons to show: all of them when few, otherwise first, last and neighbours with gaps. */
export function pageNumbers(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((n) => keep.add(n));
  const sorted = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}
