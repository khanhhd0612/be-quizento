import { getTodayString, getNextDayResetAt } from './date.util';

describe('DateUtil', () => {
  describe('getTodayString', () => {
    it('trả về chuỗi ngày theo định dạng YYYY-MM-DD UTC', () => {
      const date = new Date(Date.UTC(2026, 9, 10, 15, 30, 0));
      expect(getTodayString(date)).toBe('2026-10-10');
    });

    it('sử dụng ngày hiện tại nếu không truyền tham số', () => {
      const todayStr = getTodayString();
      expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getNextDayResetAt', () => {
    it('trả về thời điểm 00:00:00Z của ngày kế tiếp từ chuỗi YYYY-MM-DD', () => {
      expect(getNextDayResetAt('2026-10-10')).toBe('2026-10-11T00:00:00Z');
      expect(getNextDayResetAt('2026-12-31')).toBe('2027-01-01T00:00:00Z');
    });
  });
});
