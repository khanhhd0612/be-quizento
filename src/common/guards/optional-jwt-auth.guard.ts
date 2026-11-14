import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard xác thực JWT không bắt buộc (Optional Auth).
 * - Nếu có Bearer token hợp lệ: req.user được gán dữ liệu người dùng đã giải mã.
 * - Nếu không gửi token hoặc token không hợp lệ/hết hạn: request vẫn tiếp tục bình thường (req.user = null).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(
    err: any,
    user: any,
    _info: any,
    _context: ExecutionContext,
    _status?: any,
  ): TUser {
    if (err || !user) {
      return null as unknown as TUser;
    }
    return user;
  }
}
