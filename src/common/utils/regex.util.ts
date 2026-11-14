/**
 * Thoát các ký tự đặc biệt trong chuỗi để sử dụng an toàn trong biểu thức chính quy (Regular Expression)
 */
export function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
