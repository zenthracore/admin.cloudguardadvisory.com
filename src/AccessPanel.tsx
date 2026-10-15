import React, { useEffect, useState } from 'react';
import { Copy, RefreshCw, Trash2, UserPlus, X } from 'lucide-react';
import {
  PAGE_LABELS,
  POOL_LABELS,
  POOL_PAGES,
  draftToPerms,
  permsToDraft,
  type Perm,
  type PermMode,
} from './access';

type Request = (path: string, init?: RequestInit) => Promise<any>;
type Draft = Record<string, Record<string, PermMode | ''>>;
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

const emptyDraft = (): Draft => permsToDraft([]);
const when = (value: string | null) =>
  value ? new Date(value).toLocaleString('ru-RU') : '—';

// Generate consistent color for user avatar based on email
function getUserAvatarColor(email: string): string {
const colors = [
  '#f26a21', // orange (primary brand color)
  '#4c5bd4', // purple
  '#1b6b34', // green
  '#946200', // yellow/amber
  '#c9372c', // red
  '#0f172a', // dark blue
];
const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
return colors[hash % colors.length];
}

function PermPicker({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: (next: Draft) => void;
}) {
  const setPage = (pool: string, page: string, mode: PermMode | '') =>
    setDraft({ ...draft, [pool]: { ...draft[pool], [page]: mode } });
  const togglePool = (pool: string, on: boolean) => {
    const pages = { ...draft[pool] };
    for (const page of POOL_PAGES[pool]) pages[page] = on ? 'write' : '';
    setDraft({ ...draft, [pool]: pages });
  };
  return (
    <div className="perm-grid">
      {Object.entries(POOL_PAGES).map(([pool, pages]) => {
        const active = pages.some((page) => draft[pool][page] !== '');
        return (
          <section className={'perm-pool' + (active ? ' active' : '')} key={pool}>
            <header>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => togglePool(pool, e.target.checked)}
                />
                <strong>{POOL_LABELS[pool]}</strong>
              </label>
            </header>
            <div className="perm-pages">
              {pages.map((page) => (
                <label key={page}>
                  <span>{PAGE_LABELS[page] || page}</span>
                  <select
                    value={draft[pool][page]}
                    onChange={(e) => setPage(pool, page, e.target.value as PermMode | '')}
                  >
                    <option value="">Нет доступа</option>
                    <option value="read">Только чтение</option>
                    <option value="write">Изменение</option>
                  </select>
                </label>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function permSummary(perms: Perm[]): string {
  if (!perms.length) return 'Нет прав';
  const byPool: Record<string, string[]> = {};
  for (const perm of perms) {
    (byPool[perm.workspace] ||= []).push(
      `${PAGE_LABELS[perm.page] || perm.page}${perm.mode === 'write' ? '' : ' (чтение)'}`,
    );
  }
  return Object.entries(byPool)
    .map(([pool, pages]) => `${POOL_LABELS[pool] || pool}: ${pages.join(', ')}`)
    .join(' · ');
}

// One row: whitelist IP (or CIDR) for projects.cloudguardadvisory.com plus the
// "allowed" switch. Saved through the admin API, applied by the gateway instantly.
function ProjectsEditor({
  user,
  request,
  onSaved,
}: {
  user: AdminUser;
  request: Request;
  onSaved: () => void;
}) {
  const [ip, setIp] = useState(user.projectsIp || '');
  const [allowed, setAllowed] = useState(user.projectsAllowed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setIp(user.projectsIp || '');
    setAllowed(user.projectsAllowed);
  }, [user]);

  const dirty = ip.trim() !== (user.projectsIp || '') || allowed !== user.projectsAllowed;

  async function save() {
    setBusy(true);
    setError('');
    try {
      await request(`/users/${user.id}/projects-access`, {
        method: 'PUT',
        body: JSON.stringify({ ip: ip.trim(), allowed }),
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="projects-editor">
      <label>
        IP
        <input
          type="text"
          value={ip}
          placeholder="1.2.3.4 или CIDR"
          onChange={(e) => setIp(e.target.value)}
          disabled={busy}
          spellCheck={false}
        />
      </label>
      <span className="projects-row">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={allowed}
            onChange={(e) => setAllowed(e.target.checked)}
            disabled={busy}
          />
          в projects
        </label>
        <button
          className={dirty ? 'primary' : ''}
          disabled={busy || !dirty}
          onClick={() => void save()}
        >
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </span>
      {error && <small className="error">{error}</small>}
      {!error && allowed && !ip.trim() && (
        <small className="error">Укажите IP, чтобы разрешить доступ</small>
      )}
    </div>
  );
}

export function Access({ request }: { request: Request }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [result, setResult] = useState<{ url: string; emailSent: boolean } | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft());

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [u, i] = await Promise.all([request('/users'), request('/invites')]);
      setUsers(u.users || []);
      setInvites(i.invites || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function inviteUser(e: React.FormEvent) {
    e.preventDefault();
    const perms = draftToPerms(draft);
    if (!perms.length) {
      setError('Выберите хотя бы одну страницу и уровень доступа.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    setResult(null);
    try {
      const data = await request('/invites', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), permissions: perms }),
      });
      setResult({ url: data.inviteUrl, emailSent: !!data.emailSent });
      setEmail('');
      setDraft(emptyDraft());
      setNotice(
        data.emailSent
          ? 'Приглашение отправлено на почту.'
          : 'Письмо не отправлено — скопируйте ссылку и передайте её вручную.',
      );
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function savePerms(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const perms = draftToPerms(editDraft);
    if (!perms.length) {
      setError('Нельзя сохранить пользователя без доступа. Отзовите доступ вместо этого.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await request(`/users/${editing.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: perms }),
      });
      setNotice('Права обновлены. Пользователь войдёт заново со старыми правами.');
      setEditing(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revokeUser(user: AdminUser) {
    if (!window.confirm(`Отозвать доступ для ${user.email}? Сессии будут завершены сразу.`))
      return;
    setBusy(true);
    setError('');
    try {
      await request(`/users/${user.id}/revoke`, { method: 'POST' });
      setNotice('Доступ отозван.');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(invite: Invite) {
    if (!window.confirm(`Отозвать приглашение для ${invite.email}?`)) return;
    setBusy(true);
    setError('');
    try {
      await request(`/invites/${invite.id}`, { method: 'DELETE' });
      setNotice('Приглашение отозвано.');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice('Ссылка скопирована.');
    } catch {
      setError('Буфер обмена недоступен — скопируйте ссылку вручную.');
    }
  }

  const inviteState = (i: Invite) =>
    i.revokedAt
      ? 'Отозвано'
      : i.acceptedAt
        ? 'Принято'
        : new Date(i.expiresAt) < new Date()
          ? 'Истекло'
          : 'Ожидает';

  return (
    <section className="access content">
      <div className="card">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">РАЗГРАНИЧЕНИЕ ПРАВ</span>
            <h2>Новое приглашение</h2>
          </div>
        </div>
        <p className="muted" style={{ margin: '0' }}>
          Выберите пул админки и страницы внутри него. Для каждой страницы —
          режим: «только чтение» или «изменение». Ссылка действует 7 дней и
          используется один раз.
        </p>
        <form onSubmit={inviteUser} style={{ marginTop: '16px' }}>
          <label className="access-email" style={{ display: 'block', marginBottom: '8px' }}>
            Email приглашаемого
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              style={{ marginTop: '6px' }}
            />
          </label>
          <div className="pool">
            <PermPicker draft={draft} setDraft={setDraft} />
          </div>
          <div className="act">
            <button className="primary" disabled={busy}>
              <UserPlus size={16} /> {busy ? 'Отправляем…' : 'Отправить приглашение'}
            </button>
          </div>
        </form>
        {result && (
          <div className="access-invite-link" role="status" style={{ marginTop: '16px', padding: '12px 18px', background: '#f0f9ff', borderRadius: '8px' }}>
            <strong>Ссылка-приглашение {result.emailSent ? 'отправлена на почту' : 'создана'}:</strong>
            <div className="act" style={{ marginTop: '8px' }}>
              <input readOnly value={result.url} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, marginRight: '8px', padding: '6px 10px' }} />
              <button onClick={() => copy(result.url)}>
                <Copy size={16} /> Копировать
              </button>
            </div>
            <small style={{ display: 'block', marginTop: '8px', color: '#64748b' }}>
              Ссылка показывается один раз. Если письмо не ушло — передайте её
              вручную; повторная отправка того же приглашения невозможна.
            </small>
          </div>
        )}
      </div>

      <div className="card">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">УЧЁТНЫЕ ЗАПИСИ</span>
            <h2>Пользователи</h2>
          </div>
          <button onClick={() => void load()} disabled={loading || busy}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Обновить
          </button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {notice && (
          <p className="notice" role="status">
            {notice}
            <button className="icon" onClick={() => setNotice('')} aria-label="Закрыть уведомление">
              <X size={16} />
            </button>
          </p>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Права</th>
                <th>Проекты</th>
                <th>Вход</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.revokedAt ? 'rev' : ''}>
                  <td>
                    <div className="u">
                      <div className="av" style={{ background: getUserAvatarColor(u.email) }}>
                        {(u.name || u.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <strong>{u.name || u.email}</strong>
                        <small>{u.email}</small>
                      </div>
                    </div>
                  </td>
                  <td className="access-perms">
                    {u.permissions.map((p, i) => (
                      <React.Fragment key={i}>
                        {p.mode === 'write' && <span className="chip edit">изм.</span>}
                        {p.mode === 'read' && <span className="chip read">чт.</span>}
                        {p.mode !== 'write' && p.mode !== 'read' && <span>{PAGE_LABELS[p.page] || p.page}</span>}
                        {i < u.permissions.length - 1 && ' · '}
                      </React.Fragment>
                    ))}
                  </td>
                  <td>
                    {u.revokedAt ? (
                      '—'
                    ) : (
                      <ProjectsEditor
                        user={u}
                        request={request}
                        onSaved={() => {
                          setNotice('Доступ к projects обновлён.');
                          void load();
                        }}
                      />
                    )}
                  </td>
                  <td>
                    {u.revokedAt ? (
                      <span className="bd no">отозван</span>
                    ) : (
                      <>
                        <div>{when(u.lastLoginAt)}</div>
                        <small>создан {when(u.createdAt)}</small>
                      </>
                    )}
                  </td>
                  <td className="act" style={{ whiteSpace: 'nowrap' }}>
                    {!u.revokedAt && (
                      <button
                        onClick={() => {
                          setEditing(u);
                          setEditDraft(permsToDraft(u.permissions));
                          setError('');
                        }}
                      >
                        Права
                      </button>
                    )}
                    {!u.revokedAt && (
                      <button className="icon danger" onClick={() => void revokeUser(u)} disabled={busy} aria-label="Отозвать доступ">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!users.length && <p className="muted">{loading ? 'Загружаем…' : 'Пользователей пока нет — отправьте первое приглашение.'}</p>}

        {editing && (
          <form className="access-edit" onSubmit={savePerms}>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">ИЗМЕНИТЬ ПРАВА</span>
                <h2>{editing.name || editing.email}</h2>
              </div>
              <button type="button" onClick={() => setEditing(null)} disabled={busy}>
                Отмена
              </button>
            </div>
            <PermPicker draft={editDraft} setDraft={setEditDraft} />
            <div className="actions">
              <button className="primary" disabled={busy}>
                {busy ? 'Сохраняем…' : 'Сохранить права'}
              </button>
            </div>
            <small className="muted">
              После сохранения активные сессии пользователя завершаются —
              понадобится войти заново.
            </small>
          </form>
        )}
      </div>

      <div className="card">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">ССЫЛКИ-ПРИГЛАШЕНИЯ</span>
            <h2>Приглашения</h2>
          </div>
        </div>
        <div className="tw" style={{ marginTop: '16px' }}>
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
              {invites.map((i) => (
                <tr key={i.id}>
                  <td>{i.email}</td>
                  <td className="access-perms">
                    {i.permissions.map((p, idx) => (
                      <React.Fragment key={idx}>
                        {p.mode === 'write' && <span className="chip edit">{PAGE_LABELS[p.page] || p.page} (изм.)</span>}
                        {p.mode === 'read' && <span className="chip read">{PAGE_LABELS[p.page] || p.page} (чт.)</span>}
                        {idx < i.permissions.length - 1 && ' · '}
                      </React.Fragment>
                    ))}
                  </td>
                  <td>
                    <span className={'bd' + (inviteState(i) === 'Ожидает' ? ' wt' : inviteState(i) === 'Принято' ? ' ok' : inviteState(i) === 'Истекло' || inviteState(i) === 'Отозвано' ? ' no' : '')}>
                      {inviteState(i)}
                    </span>
                    <small style={{ display: 'block', marginTop: '4px', color: '#64748b' }}>до {when(i.expiresAt)}</small>
                  </td>
                  <td className="act">
                    {inviteState(i) === 'Ожидает' && (
                      <button className="icon danger" onClick={() => void revokeInvite(i)} disabled={busy} aria-label="Отозвать приглашение">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!invites.length && <p className="muted" style={{ marginTop: '12px' }}>Приглашений ещё не было.</p>}
      </div>
    </section>
  );
}