import { useEffect } from 'react';
const dirtyEditors = new Set<symbol>();
export function useAdminNavigationGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const key = Symbol('editor');
    dirtyEditors.add(key);
    return () => { dirtyEditors.delete(key); };
  }, [dirty]);
}
export function confirmAdminNavigation(): boolean {
  return dirtyEditors.size === 0 || window.confirm('Có thay đổi chưa lưu. Bạn có muốn rời trang?');
}
