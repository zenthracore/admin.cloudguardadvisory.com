import { useEffect } from 'react';
import {
  PAGE_LABELS,
  POOL_LABELS,
  POOL_PAGES,
  type PermDraft,
  type PermMode,
} from './access';
import { AccessPermPool } from './AccessPermPool';

export type DrawerUser = {
  name: string;
  email: string;
  color: string;
  initial: string;
};

// Sliding panel (.dr) that edits a single user's permissions. Rendered over a
// full-screen overlay (.ov); stays open until saved or cancelled.
export function AccessDrawer({
  user,
  draft,
  poolOn,
  busy,
  onTogglePool,
  onPage,
  onClose,
  onSave,
}: {
  user: DrawerUser;
  draft: PermDraft;
  poolOn: Record<string, boolean>;
  busy: boolean;
  onTogglePool: (workspace: string, on: boolean) => void;
  onPage: (workspace: string, page: string, mode: PermMode | '') => void;
  onClose: () => void;
  onSave: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="ov"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="dr" role="dialog" aria-modal="true" aria-label="Права пользователя">
        <div className="ch">
          <div className="u">
            <span className="av" style={{ background: user.color }}>
              {user.initial}
            </span>
            <div>
              <h2>{user.name}</h2>
              <small>{user.email}</small>
            </div>
          </div>
          <button className="btn sm" type="button" onClick={onClose} disabled={busy}>
            Отмена
          </button>
        </div>
        <div className="cb">
          {Object.entries(POOL_PAGES).map(([workspace, pages]) => (
            <AccessPermPool
              key={workspace}
              label={POOL_LABELS[workspace] || workspace}
              pages={pages}
              pageLabels={PAGE_LABELS}
              draft={draft[workspace] || {}}
              on={!!poolOn[workspace]}
              onToggle={(on) => onTogglePool(workspace, on)}
              onPage={(page, mode) => onPage(workspace, page, mode)}
            />
          ))}
          <p className="note">
            После сохранения активные сессии пользователя завершаются — понадобится
            войти заново.
          </p>
        </div>
        <div className="ft">
          <button className="btn p" type="button" disabled={busy} onClick={onSave}>
            {busy ? 'Сохраняем…' : 'Сохранить права'}
          </button>
        </div>
      </aside>
    </div>
  );
}
