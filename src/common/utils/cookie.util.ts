import { CookieOptions } from 'express';

export interface CookieConfigOptions {
  isProduction?: boolean;
  maxAgeMs?: number;
  sameSite?: 'lax' | 'strict' | 'none';
  path?: string;
  secure?: boolean;
}

/**
 * Trả về options cấu hình cookie cho refreshToken
 */
export const getRefreshTokenCookieOptions = (options: CookieConfigOptions = {}): CookieOptions => {
  const isProduction = options.isProduction ?? process.env.NODE_ENV === 'production';
  const sameSite =
    options.sameSite ?? (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ?? 'lax';
  const secure = options.secure ?? (isProduction || process.env.COOKIE_SECURE === 'true');
  const path = options.path ?? process.env.COOKIE_PATH ?? '/';
  const maxAge = options.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000; // 7 ngày

  return {
    httpOnly: true,
    secure,
    sameSite,
    path,
    maxAge,
  };
};

/**
 * Trả về options để xoá cookie refreshToken khi đăng xuất
 */
export const getClearRefreshTokenCookieOptions = (
  options: CookieConfigOptions = {},
): CookieOptions => {
  const isProduction = options.isProduction ?? process.env.NODE_ENV === 'production';
  const sameSite =
    options.sameSite ?? (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ?? 'lax';
  const secure = options.secure ?? (isProduction || process.env.COOKIE_SECURE === 'true');
  const path = options.path ?? process.env.COOKIE_PATH ?? '/';

  return {
    httpOnly: true,
    secure,
    sameSite,
    path,
  };
};
