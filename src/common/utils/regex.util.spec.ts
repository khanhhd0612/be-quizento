import { escapeRegex } from './regex.util';

describe('RegexUtil', () => {
  describe('escapeRegex', () => {
    it('thoát tất cả các ký tự đặc biệt của regex', () => {
      const input = 'hello. (world) [test] *+? ^$|#';
      const escaped = escapeRegex(input);
      expect(new RegExp(escaped).test('hello. (world) [test] *+? ^$|#')).toBe(true);
      expect(escaped).toBe('hello\\.\\ \\(world\\)\\ \\[test\\]\\ \\*\\+\\?\\ \\^\\$\\|\\#');
    });

    it('giữ nguyên chuỗi an toàn không chứa ký tự đặc biệt', () => {
      expect(escapeRegex('cleanString123')).toBe('cleanString123');
    });
  });
});
