import {
  formatBytesToMB,
  formatDuration,
  formatImageTooLargeMessage,
  formatAudioLimitExceededMessage,
  formatExamMediaQuotaExceededMessage,
} from './format.util';

describe('FormatUtil', () => {
  describe('formatBytesToMB', () => {
    it('định dạng số nguyên MB chính xác', () => {
      expect(formatBytesToMB(2 * 1024 * 1024)).toBe('2MB');
      expect(formatBytesToMB(50 * 1024 * 1024)).toBe('50MB');
    });

    it('định dạng số thập phân MB với 1 chữ số sau dấu phẩy', () => {
      expect(formatBytesToMB(1.5 * 1024 * 1024)).toBe('1.5MB');
      expect(formatBytesToMB(2.25 * 1024 * 1024)).toBe('2.3MB');
    });
  });

  describe('formatDuration', () => {
    it('hiển thị phút khi số giây là bội số của 60', () => {
      expect(formatDuration(60)).toBe('1 phút');
      expect(formatDuration(120)).toBe('2 phút');
      expect(formatDuration(300)).toBe('5 phút');
    });

    it('hiển thị giây nếu không phải bội số của 60 hoặc nhỏ hơn 60', () => {
      expect(formatDuration(45)).toBe('45 giây');
      expect(formatDuration(90)).toBe('90 giây');
    });
  });

  describe('format error message helpers', () => {
    it('formatImageTooLargeMessage trả về đúng câu thông báo', () => {
      expect(formatImageTooLargeMessage(2 * 1024 * 1024)).toBe(
        'Dung lượng ảnh vượt quá giới hạn cho phép (tối đa 2MB)',
      );
    });

    it('formatAudioLimitExceededMessage trả về đúng câu thông báo', () => {
      expect(formatAudioLimitExceededMessage(5 * 1024 * 1024, 120)).toBe(
        'Dung lượng audio vượt quá 5MB hoặc thời lượng vượt quá 2 phút',
      );
    });

    it('formatExamMediaQuotaExceededMessage trả về đúng câu thông báo', () => {
      expect(formatExamMediaQuotaExceededMessage(50 * 1024 * 1024)).toBe(
        'Tổng dung lượng media của đề thi vượt quá giới hạn 50MB',
      );
    });
  });
});
