export type PermMode = 'read' | 'write';

export type Perm = {
  workspace: string;
  page: string;
  mode: PermMode;
};

export type Me = {
  id: number;
  super: boolean;
  email: string;
  name: string;
  permissions: Perm[];
};

/** Pages granted anywhere unlock the shared admin API for that page. */
export function canPage(me: Me | null, page: string, write = false): boolean {
  if (!me) return false;
  if (me.super) return true;
  return me.permissions.some(
    (p) => p.page === page && (p.mode === 'write' || !write),
  );
}

/** A pool (workspace) is visible when at least one grant lives inside it. */
export function canPool(me: Me | null, workspace: string): boolean {
  if (!me) return false;
  if (me.super) return true;
  return me.permissions.some((p) => p.workspace === workspace);
}

export const POOL_LABELS: Record<string, string> = {
  monastery: 'Monastery Stays · Монастыри',
};

export const PAGE_LABELS: Record<string, string> = {
  dash: 'Дашборд',
  monasteries: 'Монастыри',
  bookings: 'Бронирования',
  waitlist: 'Лист ожидания',
  tasks: 'Задачи',
};

/** Mirrors workspaces/sections in App.tsx and Workspaces in server/internal/access. */
export const POOL_PAGES: Record<string, string[]> = {
  monastery: ['dash', 'monasteries', 'bookings', 'waitlist', 'tasks'],
};

export function permsToDraft(perms: Perm[]): Record<string, Record<string, PermMode | ''>> {
  const draft: Record<string, Record<string, PermMode | ''>> = {};
  for (const [pool, pages] of Object.entries(POOL_PAGES)) {
    draft[pool] = {};
    for (const page of pages) draft[pool][page] = '';
  }
  for (const perm of perms) {
    if (draft[perm.workspace]?.[perm.page] !== undefined) {
      draft[perm.workspace][perm.page] = perm.mode;
    }
  }
  return draft;
}

export function draftToPerms(
  draft: Record<string, Record<string, PermMode | ''>>,
): Perm[] {
  const perms: Perm[] = [];
  for (const [pool, pages] of Object.entries(draft)) {
    for (const [page, mode] of Object.entries(pages)) {
      if (mode === 'read' || mode === 'write') perms.push({ workspace: pool, page, mode });
    }
  }
  return perms;
}
