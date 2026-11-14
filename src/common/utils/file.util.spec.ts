import { sanitizeFilename, buildStorageKey } from './file.util';

describe('FileUtil', () => {
  describe('sanitizeFilename', () => {
    it('chuyển về chữ thường, thay ký tự đặc biệt bằng gạch ngang', () => {
      expect(sanitizeFilename('My Image (1)!.PNG')).toBe('my-image-1-png');
    });

    it('giới hạn tối đa 50 ký tự', () => {
      const veryLong = 'a'.repeat(100);
      expect(sanitizeFilename(veryLong).length).toBe(50);
    });

    it('fallback về image nếu tên rỗng hoặc toàn ký tự đặc biệt', () => {
      expect(sanitizeFilename('')).toBe('image');
      expect(sanitizeFilename('---')).toBe('image');
    });
  });

  describe('buildStorageKey', () => {
    it('tạo key đúng định dạng folder/YYYY-MM-DD/uuid-name.ext', () => {
      const key = buildStorageKey('avatars', 'profile.png');
      expect(key).toMatch(/^avatars\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]+-profile\.png$/);
    });

    it('dùng customFilename nếu có', () => {
      const key = buildStorageKey('images', 'raw.jpg', 'my-custom.png');
      expect(key).toMatch(/^images\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]+-my-custom\.jpg$/);
    });

    it('loại bỏ dấu gạch chéo thừa ở folder', () => {
      const key = buildStorageKey('/exams/', 'diagram.png');
      expect(key).toMatch(/^exams\/\d{4}-\d{2}-\d{2}\//);
    });
  });
});
