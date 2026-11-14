/**
 * Trả về chuỗi ngày hôm nay theo định dạng chuẩn YYYY-MM-DD (UTC)
 */
export function getTodayString(d: Date = new Date()): string {
  return d.toISOString().split('T')[0];
}

/**
 * Tính toán thời điểm bắt đầu của ngày kế tiếp (00:00:00 UTC) từ chuỗi YYYY-MM-DD
 */
export function getNextDayResetAt(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
  return nextDay.toISOString().replace('.000Z', 'Z');
}
