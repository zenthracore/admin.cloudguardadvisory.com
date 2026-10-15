import React, { useState } from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { BuddhaLogo } from './components/buddha-logo';

type Request = (path: string, init?: RequestInit) => Promise<any>;

export function InviteAccept({
  request,
  token,
  onActivated,
  onSkip,
}: {
  request: Request;
  token: string;
  onActivated: (email: string, password: string) => Promise<void>;
  onSkip: () => void;
}) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [exists, setExists] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Пароли не совпадают.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await request('/invites/accept', {
        method: 'POST',
        body: JSON.stringify({ token, name: name.trim(), password }),
      });
      history.replaceState(null, '', location.pathname);
      await onActivated(data.email, password);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('уже создан')) setExists(true);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login-story">
        <BuddhaLogo className="brand-mark" />
        <span className="eyebrow">ZenthraCore / Доступ</span>
        <h1>
          Активация
          <br />
          доступа.
        </h1>
        <p>Задайте имя и пароль — это ваш единственный вход в панель.</p>
      </div>
      <form className="login-form" onSubmit={submit}>
        <span className="eyebrow">Приглашение</span>
        <h2>Создайте учётную запись.</h2>
        <p>Ссылка одноразовая и действует 7 дней.</p>
        <label>
          Имя
          <input
            required
            maxLength={120}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Как к вам обращаться"
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            required
            minLength={12}
            maxLength={72}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="От 12 символов"
          />
        </label>
        <label>
          Повторите пароль
          <input
            type="password"
            required
            minLength={12}
            maxLength={72}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {exists && (
          <button type="button" className="text-button" onClick={onSkip}>
            Перейти ко входу <ArrowUpRight size={16} />
          </button>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Создаём…' : 'Создать аккаунт и войти'} <ArrowUpRight size={18} />
        </button>
        <small>
          <ShieldCheck size={16} /> Пароль хранится только в виде хеша. После
          активации вход выполняется по почте и паролю.
        </small>
      </form>
    </main>
  );
}
