import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  CalendarCheck,
  KeyRound,
  Landmark,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  ArrowUpRight,
  X,
} from 'lucide-react';
import { BuddhaLogo } from './components/buddha-logo';
import { Monasteries, MonasteryBookings, MonasteryWaitlist } from './Monasteries';
import { MonDash } from './MonDash';
import { Access } from './AccessPanel';
import { ChatWidget } from './ChatWidget';
import { InviteAccept } from './InviteAccept';
import { canPage, type Me } from './access';

const sections = {
  dash: 'Дашборд',
  monasteries: 'Монастыри',
  bookings: 'Бронирования',
  waitlist: 'Лист ожидания',
  access: 'Доступы',
};
type View = keyof typeof sections;
const icons = {
  dash: BarChart3,
  monasteries: Landmark,
  bookings: CalendarCheck,
  waitlist: Mail,
  access: KeyRound,
};
const workspaceSections: View[] = ['dash', 'monasteries', 'bookings', 'waitlist'];

export default function App() {
  const [token, setToken] = useState('');
  const [me, setMe] = useState<Me | null>(null);
  const [loginMode, setLoginMode] = useState<'token' | 'email'>('token');
  const [input, setInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [inviteToken, setInviteToken] = useState<string | null>(() => {
    const match = location.hash.match(/^#\/invite\/([a-f0-9]{64})$/);
    return match ? match[1] : null;
  });
  const [view, setView] = useState<View>('dash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const session = useRef(0);
  const meRef = useRef<Me | null>(null);

  useEffect(() => {
    meRef.current = me;
  }, [me]);
  useEffect(() => {
    localStorage.removeItem('zc_admin_token');
    void verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function request(path: string, init: RequestInit = {}) {
    const res = await fetch('/api/admin' + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      logout(true);
      throw new Error(
        typeof data.error === 'string' && /[а-яё]/i.test(data.error)
          ? data.error
          : path === '/auth/login'
            ? 'Неверные учётные данные.'
            : 'Сессия завершена. Войдите снова.',
      );
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        typeof data.error === 'string' && /[а-яё]/i.test(data.error)
          ? data.error
          : res.status === 403
            ? 'Доступ запрещён. Проверьте сессию и настройки доступа.'
            : res.status === 400
              ? 'Проверьте заполнение полей запроса.'
              : `Ошибка запроса (${res.status}). Повторите попытку.`,
      );
    }
    return res.status === 204 ? null : res.json();
  }
  async function verify() {
    try {
      const data = await request('/auth/verify');
      if (!data?.user) return;
      setMe(data.user);
      setToken('authenticated');
      postAuth(data.user);
    } catch {
      // Not authenticated yet — the login screen stays.
    }
  }
  function postAuth(user: Me) {
    const first = workspaceSections.find((s) => canPage(user, s));
    setView(first || 'access');
  }
  function logout(keepInputs = false) {
    session.current++;
    setToken('');
    setMe(null);
    if (!keepInputs) {
      setInput('');
      setEmailInput('');
      setPasswordInput('');
    }
    setNotice('');
    setError('');
  }
  async function authLogin(body: { token?: string; email?: string; password?: string }) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setToken('authenticated');
    setMe(data.user);
    setInput('');
    setEmailInput('');
    setPasswordInput('');
    setInviteToken(null);
    postAuth(data.user);
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (loginMode === 'token') await authLogin({ token: input.trim() });
      else await authLogin({ email: emailInput.trim(), password: passwordInput });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const can = (page: string, write = false) => canPage(me, page, write);

  if (inviteToken && !token)
    return (
      <InviteAccept
        request={request}
        token={inviteToken}
        onActivated={(email, password) => authLogin({ email, password })}
        onSkip={() => {
          setInviteToken(null);
          history.replaceState(null, '', location.pathname);
        }}
      />
    );
  if (!token)
    return (
      <main className="login">
        <div className="login-story">
          <BuddhaLogo className="brand-mark" />
          <span className="eyebrow">Monastery Stays / Управление</span>
          <h1>
            Monastery Stays
            <br />
            Панель управления.
          </h1>
          <p>Каталог гостевых домов, бронирования и лист ожидания в одном месте.</p>
        </div>
        <form className="login-form" onSubmit={login}>
          <span className="eyebrow">Закрытая панель</span>
          <h2>Добро пожаловать.</h2>
          <div className="login-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={loginMode === 'token'}
              className={loginMode === 'token' ? 'active' : ''}
              onClick={() => {
                setLoginMode('token');
                setError('');
              }}
            >
              Токен
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={loginMode === 'email'}
              className={loginMode === 'email' ? 'active' : ''}
              onClick={() => {
                setLoginMode('email');
                setError('');
              }}
            >
              Почта и пароль
            </button>
          </div>
          {loginMode === 'token' ? (
            <label>
              Токен доступа
              <input
                type="password"
                autoComplete="off"
                required
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Введите токен администратора"
              />
            </label>
          ) : (
            <>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@example.com"
                />
              </label>
              <label>
                Пароль
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Входим…' : 'Войти в панель'} <ArrowUpRight size={18} />
          </button>
          <small>
            <ShieldCheck size={16} />{' '}
            {loginMode === 'email'
              ? 'Аккаунт создаётся только по приглашению суперадминистратора.'
              : 'Токен подтверждает полный доступ. Сессия завершится через 15 минут бездействия или через час.'}
          </small>
        </form>
      </main>
    );

  return (
    <div className="workspace">
      <aside className="sidebar">
        <a
          className="brand"
          href="#dash"
          onClick={(e) => {
            e.preventDefault();
            setView('dash');
          }}
        >
          <Landmark className="brand-mark" />
          <span>
            Monastery Stays
            <small>ГОСТЕВЫЕ ДОМА</small>
          </span>
        </a>
        <div className="sidebar-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav aria-label="Основная навигация">
          {workspaceSections
            .filter((key) => can(key))
            .map((key) => {
              const Icon = icons[key];
              return (
                <button
                  key={key}
                  aria-current={view === key ? 'page' : undefined}
                  className={view === key ? 'active' : ''}
                  onClick={() => setView(key)}
                >
                  <Icon size={18} />
                  {sections[key]}
                </button>
              );
            })}
          {can('access') && (
            <button
              aria-current={view === 'access' ? 'page' : undefined}
              className={view === 'access' ? 'active' : ''}
              onClick={() => setView('access')}
            >
              <KeyRound size={18} />
              Доступы
            </button>
          )}
        </nav>
        <div className="sidebar-user">
          <strong>{me?.name || me?.email || 'Суперадминистратор'}</strong>
          <small>
            {me?.email || 'Общий токен'}
            {me?.super && ' · полный доступ'}
          </small>
        </div>
        <div className="sidebar-bottom">
          <button
            onClick={async () => {
              setBusy(true);
              try {
                await request('/auth/logout', { method: 'POST' });
                logout();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          >
            <LogOut size={17} /> Выйти
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>
            Панель <span className="slash">/</span>{' '}
            <strong>{sections[view]}</strong>
          </span>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">{view === 'access' ? 'УПРАВЛЕНИЕ ДОСТУПОМ' : 'MONASTERY STAYS'}</span>
              <h1>{sections[view]}</h1>
              <p>
                {view === 'dash'
                  ? 'Аналитика каталога, бронирований и листа ожидания.'
                  : view === 'monasteries'
                    ? 'Каталог гостевых домов при монастырях: поиск, цены и редактирование.'
                    : view === 'bookings'
                      ? 'Бронирования гостевых домов и их статусы.'
                      : view === 'waitlist'
                        ? 'Подписки на лист ожидания.'
                        : 'Приглашения, пользователи и права доступа к разделам панели.'}
              </p>
            </div>
            <div className="actions">
              <button
                hidden={view !== 'access' && view !== 'dash'}
                onClick={() => setLoading((v) => !v)}
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? 'spin' : ''} />
                {loading ? 'Обновляем…' : 'Обновить'}
              </button>
              {view !== 'access' && !can(view, true) && (
                <span className="badge">Только чтение</span>
              )}
            </div>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button className="icon" onClick={() => setNotice('')} aria-label="Закрыть уведомление">
                <X size={16} />
              </button>
            </div>
          )}
          {view === 'access' && me?.super && <Access request={request} />}
          {view === 'dash' && <MonDash request={request} go={(v: string) => setView(v as View)} />}
          {view === 'monasteries' && (
            <Monasteries request={request} readonly={!can('monasteries', true)} />
          )}
          {view === 'bookings' && (
            <MonasteryBookings request={request} readonly={!can('bookings', true)} />
          )}
          {view === 'waitlist' && <MonasteryWaitlist request={request} />}
        </main>
      </div>
      <ChatWidget me={me} />
    </div>
  );
}
