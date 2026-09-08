/**
 * 應用程式帳號角色
 *
 * - admin：完整管理權限
 * - user：一般操作帳號（現況等同完整操作）
 * - shareholder_guest：訪客股東，僅可檢視股東報表（參數唯讀、不可匯出 Excel／進入設定）
 */
export type AppRole = 'admin' | 'user' | 'shareholder_guest';

export function normalizeAppRole(role: string | null | undefined): AppRole {
  if (role === 'admin' || role === 'shareholder_guest') return role;
  return 'user';
}

export function isShareholderGuestRole(role: AppRole): boolean {
  return role === 'shareholder_guest';
}
