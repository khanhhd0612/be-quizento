/**
 * Chuyển đổi dung lượng bytes sang chuỗi hiển thị MB thân thiện (ví dụ: 2MB, 50MB, 1.5MB)
 */
export function formatBytesToMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb}MB` : `${mb.toFixed(1)}MB`;
}

/**
 * Chuyển đổi số giây sang chuỗi hiển thị thời lượng dễ đọc (ví dụ: 2 phút, 30 giây)
 */
export function formatDuration(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) {
    return `${seconds / 60} phút`;
  }
  return `${seconds} giây`;
}

/**
 * Chuỗi thông báo lỗi khi dung lượng ảnh vượt quá giới hạn
 */
export function formatImageTooLargeMessage(maxBytes: number): string {
  return `Dung lượng ảnh vượt quá giới hạn cho phép (tối đa ${formatBytesToMB(maxBytes)})`;
}

/**
 * Chuỗi thông báo lỗi khi dung lượng/thời lượng audio vượt quá giới hạn
 */
export function formatAudioLimitExceededMessage(maxBytes: number, maxDurationSec: number): string {
  return `Dung lượng audio vượt quá ${formatBytesToMB(maxBytes)} hoặc thời lượng vượt quá ${formatDuration(maxDurationSec)}`;
}

/**
 * Chuỗi thông báo lỗi khi tổng dung lượng media đề thi vượt quá giới hạn
 */
export function formatExamMediaQuotaExceededMessage(maxBytes: number): string {
  return `Tổng dung lượng media của đề thi vượt quá giới hạn ${formatBytesToMB(maxBytes)}`;
}

