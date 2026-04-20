import { describe, expect, it } from 'vitest';

import { TIME_RANGE_OPTIONS, isUsageTimeRange } from './UsagePage';

describe('usage time ranges', () => {
  it('includes today in the selectable time ranges', () => {
    expect(TIME_RANGE_OPTIONS.map((option) => option.value)).toContain('today');
  });

  it('accepts today as a valid usage time range', () => {
    expect(isUsageTimeRange('today')).toBe(true);
  });
});
