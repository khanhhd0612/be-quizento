import {
  getRefreshTokenCookieOptions,
  getClearRefreshTokenCookieOptions,
} from './cookie.util';

describe('CookieUtil', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getRefreshTokenCookieOptions', () => {
    it('trả về mặc định cho môi trường development', () => {
      process.env.NODE_ENV = 'development';
      const options = getRefreshTokenCookieOptions();

      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(false);
      expect(options.sameSite).toBe('lax');
      expect(options.path).toBe('/');
      expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('bật secure khi chạy production', () => {
      process.env.NODE_ENV = 'production';
      const options = getRefreshTokenCookieOptions({ isProduction: true });

      expect(options.secure).toBe(true);
    });

    it('áp dụng các tùy chọn custom khi truyền vào', () => {
      const options = getRefreshTokenCookieOptions({
        sameSite: 'strict',
        maxAgeMs: 3600000,
        path: '/api/v1',
        secure: true,
      });

      expect(options.sameSite).toBe('strict');
      expect(options.maxAge).toBe(3600000);
      expect(options.path).toBe('/api/v1');
      expect(options.secure).toBe(true);
    });
  });

  describe('getClearRefreshTokenCookieOptions', () => {
    it('trả về cấu hình để clear cookie', () => {
      const options = getClearRefreshTokenCookieOptions();

      expect(options.httpOnly).toBe(true);
      expect(options.path).toBe('/');
      expect(options.maxAge).toBeUndefined();
    });
  });
});
