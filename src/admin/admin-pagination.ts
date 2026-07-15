import { BadRequestException } from '@nestjs/common';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function normalizeLimit(raw: string | number | undefined): number {
  if (raw === undefined || raw === '') {
    return DEFAULT_PAGE_SIZE;
  }

  const parsed = typeof raw === 'number' ? raw : Number.parseInt(raw, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestException('limit must be a positive integer.');
  }

  return Math.min(parsed, MAX_PAGE_SIZE);
}

// Given `limit + 1` rows fetched in descending id order, split off the extra row
// to decide whether another page exists and expose the last id as the cursor.
export function toCursorPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  return { items, nextCursor };
}
