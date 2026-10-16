import { useEffect, useState } from 'react';
import { Copy, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import {
  PAGE_LABELS,
  POOL_LABELS,
  POOL_PAGES,
  draftToPerms,
  permsToDraft,
  type Perm,
  type PermDraft,
  type PermMode,
} from './access';
import { AccessPermPool } from './AccessPermPool';
import { AccessDrawer } from './AccessDrawer';

type Request = (path: string, init?: RequestInit) => Promise<any>;
type Toast = { text: string; kind: 'ok' | 'err' };
type AdminUser = {
  id: number;
  email: string;
  name: string;
  permissions: Perm[];
  projectsIp: string;
  projectsAllowed: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  revokedAt: string | null;
};
type Invite = {
  id: number;
  email: string;
  permissions: Perm[];
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

const AVATAR_COLORS = ['#2b8fa8', '#6b5bd2', '#d2623b', '#3b8f5a', '#a14fb0', '#c28a1b'];

const emptyDraft = (): PermDraft => permsToDraft([]);
const emptyPoolOn = (): Record<string, boolean> => {
  const on: Record<string, boolean> = {};
  for (const workspace of Object.keys(POOL_PAGES)) on[workspace] = false;
  return on;
};
const draftToPoolOn = (draft: PermDraft): Record<string, boolean> => {
  const on: Record<string, boolean> = {};
  for (const [workspace, pages] of Object.entries(POOL_PAGES)) {
    on[workspace] = pages.some((page) => draft[workspace]?.[page]);
  }
  return on;
};
const formToPerms = (draft: PermDraft, poolOn: Record<string, boolean>): Perm[] =>
  draftToPerms(draft).filter((perm) => poolOn[perm.workspace]);
const clearPool = (draft: PermDraft, workspace: string): PermDraft => {
  const pages: Record<string, PermMode | ''> = {};
  for (const page of POOL_PAGES[workspace]) pages[page] = '';
  return { ...draft, [workspace]: pages };
};

// Deterministic avatar color, matching the mock (hash of the display name).
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
const initial = (value: string) => (value[0] || '?').toUpperCase();

const pad = (n: number) => String(n).padStart(2, '0');
function when(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return (
    `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

const isPending = (invite: Invite) =>
  !invite.revokedAt && !invite.acceptedAt && new Date(invite.expiresAt) > new Date();

function inviteState(invite: Invite): { label: string; tone: 'ok' | 'wt' | 'no' } {
  if (invite.revokedAt) return { label: 'Отозвано', tone: 'no' };
  if (invite.acceptedAt) return { label: 'Принято', tone: 'ok' };
  if (new Date(invite.expiresAt) < new Date()) return { label: 'Истекло', tone: 'no' };
  return { label: 'Ожидает', tone: 'wt' };
}

function PermChips({ perms }: { perms: Perm[] }) {
  if (!perms.length) return <span className="mu">Нет доступа</span>;
  return (
    <>
      {Object.keys(POOL_PAGES).map((workspace) => {
        const list = perms.filter((perm) => perm.workspace === workspace);
        if (!list.length) return null;
        const order = POOL_PAGES[workspace];
        list.sort((a, b) => order.indexOf(a.page) - order.indexOf(b.page));
        return (
          <div key={workspace}>
            <div className="pl">{POOL_LABELS[workspace] || workspace}</div>
            {list.map((perm) => (
              <span
                key={perm.page}
                className={'chip ' + (perm.mode === 'write' ? 'edit' : 'read')}
              >
                {(PAGE_LABELS[perm.page] || perm.page) + (perm.mode === 'read' ? ' · чтение' : '')}
              </span>
            ))}
          </div>
        );
      })}
    </>
  );
}

// IP whitelist (or CIDR) for projects.cloudguardadvisory.com plus the "allowed"
// switch. Saved through the admin API; the gateway applies it instantly.
function ProjectsEditor({
  user,
  request,
  notify,
}: {
  user: AdminUser;
  request: Request;
  notify: (text: string, kind: 'ok' | 'err') => void;
}) {
  const [ip, setIp] = useState(user.projectsIp || '');
  const [allowed, setAllowed] = useState(user.projectsAllowed);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setIp(user.projectsIp || '');
    setAllowed(user.projectsAllowed);
  }, [user]);

  const dirty = ip.trim() !== (user.projectsIp || '') || allowed !== user.projectsAllowed;

  async function save() {
    if (allowed && !ip.trim()) {
      notify('Укажите IP, чтобы разрешить доступ в projects', 'err');
      return;
    }
    setBusy(true);
    try {
      await request(`/users/${user.id}/projects-access`, {
        method: 'PUT',
        body: JSON.stringify({ ip: ip.trim(), allowed }),
      });
      notify('IP-доступ обновлён', 'ok');
    } catch (err) {
      notify((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ipc">
      <input
        className="ip"
        type="text"
        value={ip}
        placeholder="1.2.3.4 или CIDR"
        onChange={(e) => setIp(e.target.value)}
        disabled={busy}
        spellCheck={false}
        aria-label="IP или CIDR"
      />
      <button type="button" className="btn sm" disabled={busy || !dirty} onClick={() => void save()}>
        Сохранить
      </button>
      <label className="ck">
        <input
          type="checkbox"
          checked={allowed}
          onChange={(e) => setAllowed(e.target.checked)}
          disabled={busy}
        />
        в projects
      </label>
    </div>
  );
}

export function Access({ request }: { request: Request }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);

  const [email, setEmail] = useState('');
  const [draft, setDraft] = useState<PermDraft>(emptyDraft());
  const [poolOn, setPoolOn] = useState<Record<string, boolean>>(emptyPoolOn());
  const [result, setResult] = useState<{ url: string; emailSent: boolean } | null>(null);

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editDraft, setEditDraft] = useState<PermDraft>(emptyDraft());
  const [editPoolOn, setEditPoolOn] = useState<Record<string, boolean>>(emptyPoolOn());
  const [confirmRevoke, setConfirmRevoke] = useState<AdminUser | null>(null);

  const notify = (text: string, kind: 'ok' | 'err') => setToast({ text, kind });

  async function load() {
    setLoading(true);
    try {
      const [u, i] = await Promise.all([request('/users'), request('/invites')]);
      setUsers(u.users || []);
      setInvites(i.invites || []);
    } catch (err) {
      notify((err as Error).message, 'err');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!confirmRevoke) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmRevoke(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmRevoke]);

  function setInvitePage(workspace: string, page: string, mode: PermMode | '') {
    setDraft((d) => ({ ...d, [workspace]: { ...d[workspace], [page]: mode } }));
  }
  function toggleInvitePool(workspace: string, on: boolean) {
    setPoolOn((o) => ({ ...o, [workspace]: on }));
    if (!on) setDraft((d) => clearPool(d, workspace));
  }
  function setEditPage(workspace: string, page: string, mode: PermMode | '') {
    setEditDraft((d) => ({ ...d, [workspace]: { ...d[workspace], [page]: mode } }));
  }
  function toggleEditPool(workspace: string, on: boolean) {
    setEditPoolOn((o) => ({ ...o, [workspace]: on }));
    if (!on) setEditDraft((d) => clearPool(d, workspace));
  }

  async function inviteUser() {
    const addr = email.trim();
    let validation = '';
    if (!/^\S+@\S+\.\S+$/.test(addr)) validation = 'Введите корректный email.';
    else if (!Object.values(poolOn).some(Boolean)) validation = 'Выберите пул админки.';
    else if (!Object.values(draft).some((pages) => Object.values(pages).some(Boolean)))
      validation = 'Выберите хотя бы одну страницу.';
    else {
      const taken = [...users.map((u) => u.email), ...invites.filter(isPending).map((i) => i.email)]
        .some((value) => value.toLowerCase() === addr.toLowerCase());
      if (taken) validation = 'Этот email уже приглашён или добавлен.';
    }
    if (validation) {
      setError(validation);
      return;
    }
    const perms = formToPerms(draft, poolOn);
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const data = await request('/invites', {
        method: 'POST',
        body: JSON.stringify({ email: addr, permissions: perms }),
      });
      setResult({ url: data.inviteUrl, emailSent: !!data.emailSent });
      setEmail('');
      setDraft(emptyDraft());
      setPoolOn(emptyPoolOn());
      notify(data.emailSent ? 'Приглашение отправлено' : 'Ссылка создана', 'ok');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function openEdit(user: AdminUser) {
    const nextDraft = permsToDraft(user.permissions);
    setEditing(user);
    setEditDraft(nextDraft);
    setEditPoolOn(draftToPoolOn(nextDraft));
    setError('');
  }

  async function savePerms() {
    if (!editing) return;
    const perms = formToPerms(editDraft, editPoolOn);
    if (!perms.length) {
      notify('Выберите хотя бы одну страницу.', 'err');
      return;
    }
    setBusy(true);
    try {
      await request(`/users/${editing.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: perms }),
      });
      notify('Права обновлены', 'ok');
      setEditing(null);
      await load();
    } catch (err) {
      notify((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function revokeUser(user: AdminUser) {
    setConfirmRevoke(null);
    setBusy(true);
    try {
      await request(`/users/${user.id}/revoke`, { method: 'POST' });
      notify('Доступ отозван', 'ok');
      await load();
    } catch (err) {
      notify((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(invite: Invite) {
    setBusy(true);
    try {
      await request(`/invites/${invite.id}`, { method: 'DELETE' });
      notify('Приглашение отозвано', 'ok');
      await load();
    } catch (err) {
      notify((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      notify('Ссылка скопирована', 'ok');
    } catch {
      notify('Буфер обмена недоступен — скопируйте вручную', 'err');
    }
  }

  return (
    <section className="access">
      {toast && (
        <div className={'toast' + (toast.kind === 'err' ? ' err' : '')} role="status">
          {toast.text}
        </div>
      )}

      <section className="card">
        <div className="ch">
          <div>
            <h2>Новое приглашение</h2>
            <small>Ссылка действует 7 дней и используется один раз.</small>
          </div>
        </div>
        <div className="cb">
          <p className="mu" style={{ margin: '0 0 18px' }}>
            Выберите пул админки и страницы внутри него. Для каждой страницы — режим:
            «только чтение» или «изменение».
          </p>
          <label className="f" htmlFor="invite-email">
            Email приглашаемого
          </label>
          <input
            className="in"
            id="invite-email"
            type="email"
            placeholder="name@example.com"
            value={email}
            autoComplete="off"
            onChange={(e) => setEmail(e.target.value)}
          />
          {Object.entries(POOL_PAGES).map(([workspace, pages]) => (
            <AccessPermPool
              key={workspace}
              label={POOL_LABELS[workspace] || workspace}
              pages={pages}
              pageLabels={PAGE_LABELS}
              draft={draft[workspace] || {}}
              on={!!poolOn[workspace]}
              onToggle={(on) => toggleInvitePool(workspace, on)}
              onPage={(page, mode) => setInvitePage(workspace, page, mode)}
            />
          ))}
          <button
            className="btn p"
            type="button"
            disabled={busy}
            onClick={() => void inviteUser()}
          >
            <UserPlus size={16} /> {busy ? 'Отправляем…' : 'Отправить приглашение'}
          </button>
          <div className="err" role="alert">
            {error}
          </div>
          {result && (
            <div className="invlink" role="status">
              <strong>
                {result.emailSent
                  ? 'Ссылка-приглашение отправлена на почту:'
                  : 'Ссылка-приглашение создана:'}
              </strong>
              <div className="act">
                <input
                  readOnly
                  value={result.url}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button type="button" className="btn sm" onClick={() => void copy(result.url)}>
                  <Copy size={16} /> Копировать
                </button>
              </div>
              <small>
                Ссылка показывается один раз. Если письмо не ушло — передайте её вручную.
              </small>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="ch">
          <h2>Пользователи</h2>
          <button
            className="btn"
            type="button"
            onClick={() => void load()}
            disabled={loading || busy}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Обновить
          </button>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Права</th>
                <th>IP-доступ</th>
                <th>Вход</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.revokedAt ? 'rev' : ''}>
                  <td>
                    <div className="u">
                      <span className="av" style={{ background: avatarColor(u.name || u.email) }}>
                        {initial(u.name || u.email)}
                      </span>
                      <div>
                        <b>{u.name || u.email}</b>
                        <small>{u.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <PermChips perms={u.permissions} />
                  </td>
                  <td>
                    {u.revokedAt ? (
                      <span className="mu">—</span>
                    ) : (
                      <ProjectsEditor
                        user={u}
                        request={request}
                        notify={(text, kind) => {
                          notify(text, kind);
                          if (kind === 'ok') void load();
                        }}
                      />
                    )}
                  </td>
                  <td>
                    {u.revokedAt ? (
                      <span className="bd no">Доступ отозван</span>
                    ) : (
                      when(u.lastLoginAt)
                    )}
                    <div className="mu sub">создан {when(u.createdAt)}</div>
                  </td>
                  <td>
                    <div className="act">
                      {!u.revokedAt && (
                        <button className="btn sm" type="button" onClick={() => openEdit(u)}>
                          Права
                        </button>
                      )}
                      {!u.revokedAt && (
                        <button
                          className="btn ic"
                          type="button"
                          onClick={() => setConfirmRevoke(u)}
                          disabled={busy}
                          aria-label={`Отозвать доступ ${u.name || u.email}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!users.length && (
          <p className="mu" style={{ padding: '0 24px 22px' }}>
            {loading ? 'Загружаем…' : 'Пользователей пока нет — отправьте первое приглашение.'}
          </p>
        )}
      </section>

      <section className="card">
        <div className="ch">
          <h2>Приглашения</h2>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Права</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => {
                const state = inviteState(invite);
                return (
                  <tr key={invite.id}>
                    <td>
                      <b>{invite.email}</b>
                    </td>
                    <td>
                      <PermChips perms={invite.permissions} />
                    </td>
                    <td>
                      <span className={'bd ' + state.tone}>{state.label}</span>
                      <div className="mu sub">до {when(invite.expiresAt)}</div>
                    </td>
                    <td>
                      <div className="act">
                        {state.label === 'Ожидает' && (
                          <button
                            className="btn sm"
                            type="button"
                            onClick={() => void revokeInvite(invite)}
                            disabled={busy}
                          >
                            Отозвать
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!invites.length && (
          <p className="mu" style={{ padding: '0 24px 22px' }}>
            Приглашений ещё не было.
          </p>
        )}
      </section>

      {editing && (
        <AccessDrawer
          user={{
            name: editing.name || editing.email,
            email: editing.email,
            color: avatarColor(editing.name || editing.email),
            initial: initial(editing.name || editing.email),
          }}
          draft={editDraft}
          poolOn={editPoolOn}
          busy={busy}
          onTogglePool={toggleEditPool}
          onPage={setEditPage}
          onClose={() => setEditing(null)}
          onSave={() => void savePerms()}
        />
      )}

      {confirmRevoke && (
        <div
          className="ov c"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmRevoke(null);
          }}
        >
          <div className="dlg" role="dialog" aria-modal="true">
            <h3>Отозвать доступ?</h3>
            <p className="mu">
              «{confirmRevoke.name || confirmRevoke.email}» ({confirmRevoke.email}) потеряет
              доступ, активные сессии завершатся.
            </p>
            <div className="act" style={{ marginTop: 18 }}>
              <button className="btn" type="button" onClick={() => setConfirmRevoke(null)} disabled={busy}>
                Отмена
              </button>
              <button
                className="btn p"
                type="button"
                onClick={() => void revokeUser(confirmRevoke)}
                disabled={busy}
              >
                Отозвать
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
