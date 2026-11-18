/** Chat tổng văn phòng — mọi thành viên (không khóa) đều vào được. */
export const LOBBY_CHAT_SCOPE = 'lobby' as const;

/** Bàn và vòng quay còn lịch sử trong DB, không nhận tin mới. */
export function isRetiredChatScope(scope: string): boolean {
  const s = scope.toLowerCase();
  return s.startsWith('table:') || s.startsWith('wheel:');
}
