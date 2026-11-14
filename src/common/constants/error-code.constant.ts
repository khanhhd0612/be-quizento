/**
 * Bảng mã lỗi thống nhất toàn hệ thống, dùng chung giữa Backend Frontend.
 * Quy ước:
 *  - Không được đổi giá trị code đã public cho FE, chỉ được thêm mới
 */
export enum ErrorCode {
  // Common
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  UNAUTHORIZED = 'UNAUTHORIZED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Auth
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_REFRESH_TOKEN_INVALID = 'AUTH_REFRESH_TOKEN_INVALID',
  AUTH_ACCOUNT_LOCKED = 'AUTH_ACCOUNT_LOCKED',
  AUTH_ACCOUNT_NOT_VERIFIED = 'AUTH_ACCOUNT_NOT_VERIFIED',
  INVALID_OLD_PASSWORD = 'INVALID_OLD_PASSWORD',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  AUTH_REFRESH_TOKEN_REQUIRED = 'AUTH_REFRESH_TOKEN_REQUIRED',
  PASSWORD_RESET_RATE_LIMITED = 'PASSWORD_RESET_RATE_LIMITED',
  PASSWORD_RESET_TOKEN_INVALID = 'PASSWORD_RESET_TOKEN_INVALID',
  AUTH_CANNOT_PROCESS_USER = 'AUTH_CANNOT_PROCESS_USER',
  AUTH_PASSWORD_NOT_SET = 'AUTH_PASSWORD_NOT_SET',
  AUTH_GOOGLE_MISSING_EMAIL = 'AUTH_GOOGLE_MISSING_EMAIL',
  AUTH_GOOGLE_TOKEN_INVALID = 'AUTH_GOOGLE_TOKEN_INVALID',
  AUTH_GOOGLE_NOT_CONFIGURED = 'AUTH_GOOGLE_NOT_CONFIGURED',

  // User
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  USER_EMAIL_ALREADY_EXISTS = 'USER_EMAIL_ALREADY_EXISTS',
  USER_USERNAME_ALREADY_EXISTS = 'USER_USERNAME_ALREADY_EXISTS',

  // Upload & Storage (Cloudflare R2)
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_INVALID_TYPE = 'FILE_INVALID_TYPE',
  R2_UPLOAD_FAILED = 'R2_UPLOAD_FAILED',
  R2_NOT_CONFIGURED = 'R2_NOT_CONFIGURED',
  R2_DELETE_FAILED = 'R2_DELETE_FAILED',

  // Exam
  EXAM_NOT_FOUND = 'EXAM_NOT_FOUND',
  EXAM_FORBIDDEN = 'EXAM_FORBIDDEN',
  AT_LEAST_ONE_MODE_REQUIRED = 'AT_LEAST_ONE_MODE_REQUIRED',
  INVALID_CORRECT_ANSWER = 'INVALID_CORRECT_ANSWER',
  DAILY_QUOTA_EXCEEDED = 'DAILY_QUOTA_EXCEEDED',
  INVALID_TITLE = 'INVALID_TITLE',
  QUESTION_NOT_FOUND = 'QUESTION_NOT_FOUND',
  IMAGE_TOO_LARGE = 'IMAGE_TOO_LARGE',
  AUDIO_LIMIT_EXCEEDED = 'AUDIO_LIMIT_EXCEEDED',
  EXAM_MEDIA_QUOTA_EXCEEDED = 'EXAM_MEDIA_QUOTA_EXCEEDED',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',

  // Practice Session
  MODE_NOT_ALLOWED = 'MODE_NOT_ALLOWED',
  PRACTICE_SESSION_NOT_FOUND = 'PRACTICE_SESSION_NOT_FOUND',
  SESSION_ALREADY_COMPLETED = 'SESSION_ALREADY_COMPLETED',
  CANNOT_RETRY_SESSION = 'CANNOT_RETRY_SESSION',
  QUESTION_NOT_IN_RETRY = 'QUESTION_NOT_IN_RETRY',

  // Daily Quota
  INVALID_QUOTA_OVERRIDE = 'INVALID_QUOTA_OVERRIDE',
  QUOTA_RECORD_NOT_FOUND = 'QUOTA_RECORD_NOT_FOUND',
  FORBIDDEN_NOT_ADMIN = 'FORBIDDEN_NOT_ADMIN',

  // System Config
  INVALID_QUOTA_VALUE = 'INVALID_QUOTA_VALUE',
  INVALID_IMAGE_LIMIT = 'INVALID_IMAGE_LIMIT',
  INVALID_AUDIO_LIMIT = 'INVALID_AUDIO_LIMIT',
  TOTAL_LIMIT_TOO_LOW = 'TOTAL_LIMIT_TOO_LOW',
  INVALID_PREVIEW_PERCENT = 'INVALID_PREVIEW_PERCENT',
  INVALID_PREVIEW_COUNT = 'INVALID_PREVIEW_COUNT',
}

/**
 * Map mã lỗi trả về cho FE khi không truyền message riêng.
 */
export const ErrorMessage: Record<ErrorCode, string> = {
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau',
  [ErrorCode.BAD_REQUEST]: 'Yêu cầu không hợp lệ',
  [ErrorCode.NOT_FOUND]: 'Không tìm thấy dữ liệu',
  [ErrorCode.FORBIDDEN]: 'Bạn không có quyền thực hiện hành động này',
  [ErrorCode.UNAUTHORIZED]: 'Bạn cần đăng nhập để thực hiện hành động này',
  [ErrorCode.TOO_MANY_REQUESTS]: 'Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Dịch vụ tạm thời không khả dụng',
  [ErrorCode.VALIDATION_ERROR]: 'Dữ liệu đầu vào không hợp lệ',
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Tài khoản hoặc mật khẩu không đúng',
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Phiên đăng nhập đã hết hạn',
  [ErrorCode.AUTH_TOKEN_INVALID]: 'Token không hợp lệ',
  [ErrorCode.AUTH_REFRESH_TOKEN_INVALID]: 'Refresh token không hợp lệ hoặc đã hết hạn',
  [ErrorCode.AUTH_ACCOUNT_LOCKED]: 'Tài khoản đã bị khoá',
  [ErrorCode.AUTH_ACCOUNT_NOT_VERIFIED]: 'Tài khoản chưa được xác thực',
  [ErrorCode.USER_NOT_FOUND]: 'Không tìm thấy người dùng',
  [ErrorCode.USER_ALREADY_EXISTS]: 'Người dùng đã tồn tại',
  [ErrorCode.USER_EMAIL_ALREADY_EXISTS]: 'Email đã được sử dụng',
  [ErrorCode.USER_USERNAME_ALREADY_EXISTS]: 'Username đã được sử dụng',
  [ErrorCode.INVALID_OLD_PASSWORD]: 'Mật khẩu cũ không hợp lệ',
  [ErrorCode.SESSION_NOT_FOUND]: 'Không tìm thấy phiên đăng nhập',
  [ErrorCode.AUTH_REFRESH_TOKEN_REQUIRED]: 'Refresh token là bắt buộc',
  [ErrorCode.PASSWORD_RESET_RATE_LIMITED]: 'Bạn đã yêu cầu quá nhiều lần, vui lòng thử lại sau',
  [ErrorCode.PASSWORD_RESET_TOKEN_INVALID]: 'Token không hợp lệ hoặc đã hết hạn',
  [ErrorCode.AUTH_CANNOT_PROCESS_USER]: 'Không thể xử lý tài khoản người dùng',
  [ErrorCode.AUTH_PASSWORD_NOT_SET]:
    'Tài khoản chưa thiết lập mật khẩu, vui lòng đăng nhập bằng Google',
  [ErrorCode.AUTH_GOOGLE_MISSING_EMAIL]: 'Không lấy được email từ tài khoản Google',
  [ErrorCode.AUTH_GOOGLE_TOKEN_INVALID]: 'Google ID Token không hợp lệ hoặc thiếu email',
  [ErrorCode.AUTH_GOOGLE_NOT_CONFIGURED]:
    'Google OAuth chưa được cấu hình GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET trên máy chủ',

  // Upload & Storage (Cloudflare R2)
  [ErrorCode.FILE_NOT_FOUND]: 'Vui lòng chọn file để tải lên',
  [ErrorCode.FILE_TOO_LARGE]: 'Kích thước file vượt quá giới hạn cho phép (tối đa 5MB)',
  [ErrorCode.FILE_INVALID_TYPE]:
    'Định dạng file không được hỗ trợ. Chỉ chấp nhận các file ảnh (jpg, jpeg, png, webp, gif, svg)',
  [ErrorCode.R2_UPLOAD_FAILED]: 'Tải file lên Cloudflare R2 thất bại',
  [ErrorCode.R2_NOT_CONFIGURED]: 'Dịch vụ lưu trữ Cloudflare R2 chưa được cấu hình',
  [ErrorCode.R2_DELETE_FAILED]: 'Xoá file trên Cloudflare R2 thất bại',

  // Exam
  [ErrorCode.EXAM_NOT_FOUND]: 'Không tìm thấy đề thi',
  [ErrorCode.EXAM_FORBIDDEN]: 'Bạn không có quyền truy cập đề thi này',
  [ErrorCode.AT_LEAST_ONE_MODE_REQUIRED]:
    'Đề thi phải bật ít nhất 1 chế độ: Thi thử hoặc Làm bài thật',
  [ErrorCode.INVALID_CORRECT_ANSWER]: 'Đáp án đúng phải khớp với một trong các lựa chọn đáp án',
  [ErrorCode.DAILY_QUOTA_EXCEEDED]: 'Bạn đã vượt quá giới hạn số lượng tạo đề thi trong ngày',
  [ErrorCode.INVALID_TITLE]: 'Tiêu đề đề thi không được để trống và tối đa 150 ký tự',
  [ErrorCode.QUESTION_NOT_FOUND]: 'Không tìm thấy câu hỏi trong đề thi',
  [ErrorCode.IMAGE_TOO_LARGE]: 'Dung lượng ảnh vượt quá giới hạn cho phép (tối đa 2MB)',
  [ErrorCode.AUDIO_LIMIT_EXCEEDED]: 'Dung lượng audio vượt quá 5MB hoặc thời lượng vượt quá 2 phút',
  [ErrorCode.EXAM_MEDIA_QUOTA_EXCEEDED]: 'Tổng dung lượng media của đề thi vượt quá giới hạn 50MB',
  [ErrorCode.INVALID_FILE_TYPE]:
    'Định dạng file không hợp lệ (chỉ chấp nhận jpg, png, webp hoặc mp3)',

  // Practice Session
  [ErrorCode.MODE_NOT_ALLOWED]: 'Chế độ làm bài không được hỗ trợ bởi đề thi',
  [ErrorCode.PRACTICE_SESSION_NOT_FOUND]: 'Không tìm thấy lượt làm bài',
  [ErrorCode.SESSION_ALREADY_COMPLETED]: 'Lượt làm bài đã kết thúc',
  [ErrorCode.CANNOT_RETRY_SESSION]: 'Chỉ có thể làm lại câu sai từ lượt thi thử đã hoàn thành',
  [ErrorCode.QUESTION_NOT_IN_RETRY]:
    'Câu hỏi không nằm trong danh sách câu làm lại của lượt này',

  // Daily Quota
  [ErrorCode.INVALID_QUOTA_OVERRIDE]:
    'Giá trị examQuotaOverride không hợp lệ (phải là số nguyên không âm hoặc null)',
  [ErrorCode.QUOTA_RECORD_NOT_FOUND]: 'Không tìm thấy bản ghi quota của ngày này',
  [ErrorCode.FORBIDDEN_NOT_ADMIN]: 'Chỉ quản trị viên mới có quyền truy cập tính năng này',

  // System Config
  [ErrorCode.INVALID_QUOTA_VALUE]: 'Số đề/ngày mặc định phải là số nguyên dương (tối thiểu 1)',
  [ErrorCode.INVALID_IMAGE_LIMIT]:
    'Giới hạn dung lượng ảnh không hợp lệ (phải là số dương, tối đa 20MB)',
  [ErrorCode.INVALID_AUDIO_LIMIT]:
    'Giới hạn audio không hợp lệ (dung lượng và thời lượng phải là số dương)',
  [ErrorCode.TOTAL_LIMIT_TOO_LOW]:
    'Tổng dung lượng media tối đa trên mỗi đề thi phải lớn hơn hoặc bằng dung lượng tối đa của ảnh và audio đơn lẻ',
  [ErrorCode.INVALID_PREVIEW_PERCENT]: 'Tỷ lệ preview của khách phải nằm trong khoảng (0, 1]',
  [ErrorCode.INVALID_PREVIEW_COUNT]: 'Số câu xem preview tối đa của khách phải là số nguyên dương',
};
