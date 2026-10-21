import { describe, it, expect } from 'vitest';
import { getBangkokCalendarDate, isBeforeStartsOn, isAfterEndsOn } from '../src/utils/date.js';

describe('Bangkok Date Timezone Utility', () => {
  it('formats deterministic timestamps to Asia/Bangkok calendar dates', () => {
    // 2026-11-02T10:00:00+07:00 is 2026-11-02 in Bangkok
    expect(getBangkokCalendarDate('2026-11-02T10:00:00+07:00')).toBe('2026-11-02');
  });

  it('correctly handles timezone crossing boundary', () => {
    // 2026-10-31T20:00:00Z is 2026-11-01 03:00:00 in Bangkok (+7 hours)
    expect(getBangkokCalendarDate('2026-10-31T20:00:00Z')).toBe('2026-11-01');

    // 2026-10-31T16:00:00Z is 2026-10-31 23:00:00 in Bangkok
    expect(getBangkokCalendarDate('2026-10-31T16:00:00Z')).toBe('2026-10-31');
  });

  it('evaluates startsOn and endsOn comparisons correctly', () => {
    expect(isBeforeStartsOn('2026-11-02', '2027-01-01')).toBe(true);
    expect(isBeforeStartsOn('2026-11-02', '2026-01-01')).toBe(false);
    expect(isBeforeStartsOn('2026-01-01', '2026-01-01')).toBe(false);

    expect(isAfterEndsOn('2026-11-02', '2026-10-07')).toBe(true);
    expect(isAfterEndsOn('2026-10-07', '2026-10-07')).toBe(false); // inclusive!
    expect(isAfterEndsOn('2026-10-06', '2026-10-07')).toBe(false);
  });

  it('throws descriptive error on invalid date string', () => {
    expect(() => getBangkokCalendarDate('invalid-date')).toThrow();
  });
});
