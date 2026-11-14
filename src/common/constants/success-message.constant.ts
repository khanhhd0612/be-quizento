/**
 * Bảng thông báo thành công thống nhất toàn hệ thống.
 * Tránh hardcode các chuỗi thông báo kết quả thao tác trong Controllers.
 */
export const SuccessMessage = {
  // Auth
  AUTH_LOGIN_SUCCESS: 'Đăng nhập thành công',
  AUTH_REGISTER_SUCCESS: 'Đăng ký thành công',
  AUTH_REFRESH_TOKEN_SUCCESS: 'Làm mới token thành công',
  AUTH_LOGOUT_SUCCESS: 'Đăng xuất thành công',
  AUTH_GOOGLE_LOGIN_SUCCESS: 'Đăng nhập Google thành công',
  AUTH_FORGOT_PASSWORD_SENT: 'Gửi email đặt lại mật khẩu thành công',
  AUTH_FORGOT_PASSWORD_INFO: 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi link đặt lại mật khẩu',
  AUTH_RESET_PASSWORD_SUCCESS: 'Đặt lại mật khẩu thành công, vui lòng đăng nhập lại',
  AUTH_CHANGE_PASSWORD_SUCCESS: 'Đổi mật khẩu thành công',
  AUTH_GET_ME_SUCCESS: 'Lấy thông tin tài khoản thành công',
  AUTH_GET_SESSIONS_SUCCESS: 'Lấy danh sách thiết bị thành công',
  AUTH_REVOKE_ALL_SESSIONS_SUCCESS: 'Đã đăng xuất tất cả thiết bị',
  AUTH_REVOKE_SESSION_SUCCESS: 'Đã đăng xuất thiết bị',
  AUTH_REVOKE_OTHER_SESSIONS_SUCCESS: 'Đã đăng xuất tất cả thiết bị khác',

  // User
  USER_GET_PROFILE_SUCCESS: 'Lấy thông tin người dùng thành công',
  USER_UPDATE_PROFILE_SUCCESS: 'Cập nhật thông tin thành công',
  USER_UPDATE_AVATAR_SUCCESS: 'Cập nhật ảnh đại diện thành công',
  USER_DELETE_AVATAR_SUCCESS: 'Xoá ảnh đại diện thành công',

  // Exam
  EXAM_CREATE_SUCCESS: 'Tạo đề thi thành công',
  EXAM_GET_LIST_SUCCESS: 'Lấy danh sách đề thi thành công',
  EXAM_GET_MY_LIST_SUCCESS: 'Lấy danh sách đề thi của tôi thành công',
  EXAM_GET_DETAIL_SUCCESS: 'Lấy chi tiết đề thi thành công',
  EXAM_GET_QUESTIONS_SUCCESS: 'Lấy danh sách câu hỏi thành công',
  EXAM_UPDATE_SUCCESS: 'Cập nhật đề thi thành công',
  EXAM_UPDATE_PRIVACY_SUCCESS: 'Cập nhật quyền riêng tư thành công',
  EXAM_DELETE_SUCCESS: 'Xóa đề thi thành công',
  EXAM_UPLOAD_MEDIA_SUCCESS: 'Upload media câu hỏi thành công',
  EXAM_DELETE_MEDIA_SUCCESS: 'Xóa media khỏi câu hỏi thành công',

  // Practice Session
  SESSION_START_SUCCESS: 'Bắt đầu lượt làm bài mới thành công',
  SESSION_SUBMIT_ANSWER_SUCCESS: 'Lưu câu trả lời thành công',
  SESSION_SUBMIT_SUCCESS: 'Nộp bài thi thành công',
  SESSION_GET_DETAIL_SUCCESS: 'Lấy chi tiết lượt làm bài thành công',
  SESSION_RETRY_WRONG_SUCCESS: 'Tạo lượt làm lại câu sai thành công',
  SESSION_GET_LIST_SUCCESS: 'Lấy danh sách lượt làm bài thành công',

  // Daily Quota
  QUOTA_GET_MY_SUCCESS: 'Lấy thông tin quota thành công',
  QUOTA_GET_ADMIN_LIST_SUCCESS: 'Lấy danh sách quota thành công',
  QUOTA_GET_USER_HISTORY_SUCCESS: 'Lấy lịch sử quota của người dùng thành công',
  QUOTA_UPDATE_OVERRIDE_SUCCESS: 'Cập nhật quota riêng cho người dùng thành công',
  QUOTA_RESET_SUCCESS: 'Reset quota đã dùng trong ngày thành công',

  // System Config
  SYSTEM_CONFIG_GET_ADMIN_SUCCESS: 'Lấy cấu hình quản trị thành công',
  SYSTEM_CONFIG_GET_PUBLIC_SUCCESS: 'Lấy cấu hình public thành công',
  SYSTEM_CONFIG_UPDATE_SUCCESS: 'Cập nhật cấu hình hệ thống thành công',

  // Upload
  UPLOAD_IMAGE_SUCCESS: 'Tải ảnh lên Cloudflare R2 thành công',
  UPLOAD_AUDIO_SUCCESS: 'Tải file audio lên Cloudflare R2 thành công',
  UPLOAD_IMAGES_SUCCESS: 'Tải danh sách ảnh lên Cloudflare R2 thành công',
  DELETE_FILE_SUCCESS: 'Xoá file trên Cloudflare R2 thành công',
} as const;

export type SuccessMessageType = (typeof SuccessMessage)[keyof typeof SuccessMessage];
