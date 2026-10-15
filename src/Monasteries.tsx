import React, { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Upload, X, ArrowLeft, LayoutGrid, Rows3 } from 'lucide-react';

type Request = (path: string, init?: RequestInit) => Promise<any>;
type Monastery = Record<string, any>;
type Stats = { monasteries: number; featured: number; waitlist: number; newWaitlist: number; bookings: number; newBookings: number };
type Booking = Record<string, any>;

const cs = (v: any) => (v === null || v === undefined ? '' : String(v));
const money = (v: any) => (v === null || v === undefined || v === '' ? '—' : `€ ${v}`);
const fmtDate = (v: string) =>
  v && !Number.isNaN(Date.parse(v))
    ? new Date(v).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
const countryLabel: Record<string, string> = { Italy: 'Италия', Austria: 'Австрия', Slovenia: 'Словения' };
const bookingStatus: Record<string, string> = { new: 'Новая', confirmed: 'Подтверждена', cancelled: 'Отменена' };

const jsonFields: [string, string][] = [
  ['facilities', 'Удобства (JSON)'],
  ['payments', 'Оплата (JSON)'],
  ['attractions', 'Достопримечательности (JSON)'],
  ['transport', 'Транспорт (JSON)'],
  ['reels', 'Reels-архив (JSON)'],
];

const scalarFields: [string, string][] = [
  ['region', 'Регион'],
  ['latitude', 'Широта'],
  ['longitude', 'Долгота'],
  ['intro', 'Краткое введение'],
  ['min_price', 'Цена от €'],
  ['room_notes', 'Номера'],
  ['opening_hours', 'Часы работы'],
  ['checkin', 'Заезд'],
  ['checkout', 'Выезд'],
  ['curfew', 'Комендантский час'],
  ['image_url', 'Фото (URL)'],
  ['audio_url', 'Аудио (URL)'],
  ['operated_by', 'Кто управляет'],
  ['seo_title', 'SEO title'],
  ['seo_description', 'SEO description'],
];

const emptyForm = (): Monastery => ({
  name: '',
  slug: '',
  country: 'Italy',
  city_name: '',
  region: '',
  latitude: '',
  longitude: '',
  intro: '',
  description: '',
  image_url: '',
  min_price: '',
  room_notes: '',
  opening_hours: '',
  checkin: '',
  checkout: '',
  curfew: '',
  has_private_bathroom: false,
  featured: false,
  facilities: '{}',
  payments: '{}',
  attractions: '',
  transport: '',
  reels: '',
  audio_url: '',
  operated_by: '',
  seo_title: '',
  seo_description: '',
});

const IMG_FALLBACK =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260"><rect width="100%" height="100%" fill="#eef2f6"/><text x="50%" y="50%" fill="#94a3b8" font-family="sans-serif" font-size="17" text-anchor="middle">Monastery Stays</text></svg>',
  );

const fallbackImage = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const el = e.currentTarget;
  if (el.src !== IMG_FALLBACK) el.src = IMG_FALLBACK;
};

function jsonOut(raw: string): any {
  const v = raw.trim();
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return undefined;
  }
}

export function Monasteries({ request, readonly = false }: { request: Request; readonly?: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<Monastery[]>([]);
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(30);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Monastery | null>(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const generation = useRef(0);

  async function loadStats() {
    try {
      setStats(await request('/stats'));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function loadMonasteries() {
    const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if (country !== 'all') params.set('country', country);
    if (featuredOnly) params.set('featured', '1');
    if (audioOnly) params.set('audio', '1');
    if (query.trim()) params.set('search', query.trim());
    const data = await request(`/monasteries?${params}`);
    setItems(data.rows || []);
    if (typeof data.total === 'number') setTotal(data.total);
  }
  async function refresh() {
    setLoading(true);
    setError('');
    const current = ++generation.current;
    try {
      await Promise.all([loadStats(), loadMonasteries()]);
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    };
  }, [country, featuredOnly, audioOnly, query, page, perPage]);
  useEffect(() => {
    setPage(1);
  }, [country, featuredOnly, audioOnly, query, perPage]);

  function openEdit(m: Monastery) {
    if (readonly) return;
    const f = emptyForm();
    scalarFields.forEach(([k]) => (f[k] = cs(m[k])));
    jsonFields.forEach(([k]) => (f[k] = JSON.stringify(m[k] === null || m[k] === undefined ? null : m[k])));
    f.name = cs(m.name);
    f.slug = cs(m.slug);
    f.country = cs(m.country) || 'Italy';
    f.city_name = cs(m.city_name);
    f.description = cs(m.description);
    f.has_private_bathroom = !!m.has_private_bathroom;
    f.featured = !!m.featured;
    f.id = m.id;
    setForm(f);
    setEditing(!!m.id);
  }
  function set(k: string, v: any) {
    setForm((prev) => (prev ? { ...prev, [k]: v } : prev));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form || readonly) return;
    setBusy(true);
    setError('');
    const payload: any = {};
    const record = { ...form };
    scalarFields.forEach(([k]) => (payload[k] = record[k] === '' ? null : record[k]));
    payload.name = cs(record.name);
    payload.slug = cs(record.slug);
    payload.country = cs(record.country);
    payload.city_name = cs(record.city_name);
    payload.description = cs(record.description) || null;
    payload.has_private_bathroom = !!record.has_private_bathroom;
    payload.featured = !!record.featured;
    for (const [k] of jsonFields) {
      const v = jsonOut(record[k]);
      if (v === undefined) {
        setError(`Поле «${k}» содержит некорректный JSON.`);
        setBusy(false);
        return;
      }
      payload[k] = v;
    }
    try {
      if (editing) {
        await request(`/monasteries/${encodeURIComponent(cs(record.id))}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await request('/monasteries', { method: 'POST', body: JSON.stringify(payload) });
      }
      setForm(null);
      setNotice(editing ? 'Монастырь обновлён.' : 'Монастырь создан.');
      await Promise.all([loadStats(), loadMonasteries()]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function del(m: Monastery) {
    if (readonly) return;
    if (!window.confirm(`Удалить «${m.name}»? Действие необратимо.`)) return;
    setBusy(true);
    setError('');
    try {
      await request(`/monasteries/${encodeURIComponent(m.id)}`, { method: 'DELETE' });
      setNotice('Монастырь удалён.');
      await Promise.all([loadStats(), loadMonasteries()]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function uploadImage() {
    if (readonly) return;
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/uploads', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Ошибка загрузки (${res.status})`);
      set('image_url', data.url);
      setNotice('Файл загружен. Сохраните монастырь, чтобы применить фото.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const countries = [...new Set(items.map((m) => m.country))].sort();
  const pages = Math.max(1, Math.ceil((total || 0) / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total || 0, page * perPage);

  if (form) {
    return (
      <section className="mon">
        <header className="mon-editor-bar">
          <div className="mon-editor-bar-left">
            <button
              className="icon"
              onClick={() => setForm(null)}
              disabled={busy}
              aria-label="Назад к списку"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <span className="eyebrow">МОНАСТЫРИ · ITALIA · AUSTRIO · SLOVENIJO</span>
              <h2>{editing ? cs(form.name) || 'Монастырь' : 'Новый монастырь'}</h2>
            </div>
            {editing && <span className="badge warm">ID {form.id}</span>}
          </div>
          <div className="actions">
            <button type="button" onClick={() => setForm(null)} disabled={busy}>
              Отмена
            </button>
            <button className="primary" form="mon-edit-form" disabled={busy || uploading}>
              {busy ? 'Сохраняем…' : editing ? 'Сохранить изменения' : 'Создать'}
            </button>
          </div>
        </header>
        <form id="mon-edit-form" className="mon-editor" onSubmit={save}>
          <div className="mon-editor-main">
            <fieldset className="mon-section">
              <legend>Основное</legend>
              <div className="field-grid">
                <label>
                  Название *
                  <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
                </label>
                <label>
                  Slug
                  <input value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="auto-генерируется" />
                </label>
                <label>
                  Страна *
                  <select value={form.country} onChange={(e) => set('country', e.target.value)}>
                    <option value="Italy">Италия</option>
                    <option value="Austria">Австрия</option>
                    <option value="Slovenia">Словения</option>
                  </select>
                </label>
                <label>
                  Город *
                  <input required value={form.city_name} onChange={(e) => set('city_name', e.target.value)} />
                </label>
                <label>
                  Регион<input value={form.region} onChange={(e) => set('region', e.target.value)} />
                </label>
                <label>
                  Цена от €<input type="number" step="0.01" min="0" value={form.min_price} onChange={(e) => set('min_price', e.target.value)} />
                </label>
                <label>
                  Широта<input value={form.latitude} onChange={(e) => set('latitude', e.target.value)} placeholder="46.00" />
                </label>
                <label>
                  Долгота<input value={form.longitude} onChange={(e) => set('longitude', e.target.value)} placeholder="13.00" />
                </label>
              </div>
            </fieldset>

            <fieldset className="mon-section">
              <legend>Тексты</legend>
              <label>
                Краткое введение
                <textarea rows={3} value={cs(form.intro)} onChange={(e) => set('intro', e.target.value)} placeholder="Пара предложений для карточки…" />
              </label>
              <label>
                Описание
                <textarea rows={10} value={cs(form.description)} onChange={(e) => set('description', e.target.value)} placeholder="Полный текст страницы монастыря…" />
              </label>
            </fieldset>

            <fieldset className="mon-section">
              <legend>Проживание и правила</legend>
              <div className="field-grid">
                <label>
                  Номера
                  <textarea rows={3} value={cs(form.room_notes)} onChange={(e) => set('room_notes', e.target.value)} placeholder="Двухместные номера, общие удобства…" />
                </label>
                <label>
                  Часы работы<input value={cs(form.opening_hours)} onChange={(e) => set('opening_hours', e.target.value)} />
                </label>
                <label>
                  Заезд<input value={cs(form.checkin)} onChange={(e) => set('checkin', e.target.value)} />
                </label>
                <label>
                  Выезд<input value={cs(form.checkout)} onChange={(e) => set('checkout', e.target.value)} />
                </label>
                <label>
                  Комендантский час<input value={cs(form.curfew)} onChange={(e) => set('curfew', e.target.value)} />
                </label>
                <label>
                  Кто управляет<input value={cs(form.operated_by)} onChange={(e) => set('operated_by', e.target.value)} />
                </label>
              </div>
            </fieldset>
          </div>

          <aside className="mon-editor-side">
            <label className="mon-photo">
              <span>Фото обложки</span>
              <div className="mon-photo-preview">
                {form.image_url ? (
                  <img src={cs(form.image_url)} alt="" onError={fallbackImage} />
                ) : (
                  <img src={IMG_FALLBACK} alt="" />
                )}
              </div>
              <div className="mon-photo-actions">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadImage} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Upload size={16} /> {uploading ? 'Загружаем…' : 'Загрузить файл'}
                </button>
                <input
                  className="mon-photo-url"
                  value={form.image_url}
                  onChange={(e) => set('image_url', e.target.value)}
                  placeholder="/images/venues/ABA103"
                />
              </div>
            </label>

            <fieldset className="mon-section">
              <legend>Настройки</legend>
              <label className="checkbox">
                <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} /> Избранное (на главной)
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={form.has_private_bathroom} onChange={(e) => set('has_private_bathroom', e.target.checked)} /> Своя ванная комната
              </label>
            </fieldset>

            <fieldset className="mon-section">
              <legend>Аудио-экскурсия</legend>
              <label>
                Аудио (URL)
                <input value={cs(form.audio_url)} onChange={(e) => set('audio_url', e.target.value)} placeholder="https://… или /media-files/…" />
              </label>
            </fieldset>

            <fieldset className="mon-section">
              <legend>SEO</legend>
              <label>
                SEO title
                <input value={cs(form.seo_title)} onChange={(e) => set('seo_title', e.target.value)} />
              </label>
              <label>
                SEO description
                <textarea rows={3} value={cs(form.seo_description)} onChange={(e) => set('seo_description', e.target.value)} />
              </label>
            </fieldset>

            <details className="mon-json">
              <summary>Технические данные (JSON)</summary>
              {jsonFields.map(([k, label]) => (
                <label key={k}>
                  {label}
                  <textarea rows={2} spellCheck={false} value={cs(form[k])} onChange={(e) => set(k, e.target.value)} placeholder="null / {} / […]" />
                </label>
              ))}
            </details>
          </aside>
        </form>
      </section>
    );
  }

  return (
    <section className="mon">
      <div className="panel mon-content">
        <div className="mon-toolbar">
          <div className="mon-view-toggle" role="group" aria-label="Вид списка">
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              aria-label="Сетка"
            >
              <LayoutGrid size={16} /> Сетка
            </button>
            <button
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
              aria-label="Таблица"
            >
              <Rows3 size={16} /> Таблица
            </button>
          </div>
          <div className="actions">
            <button onClick={() => void refresh()} disabled={loading || busy}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
              {loading ? 'Обновляем…' : 'Обновить'}
            </button>
            <button className="primary" onClick={() => openEdit({})} disabled={busy} hidden={readonly}>
              <Plus size={17} /> Добавить монастырь
            </button>
          </div>
        </div>

        <div className="filters mon-filters">
          <label className="mon-search">
            Поиск<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Название, город, ID…" />
          </label>
          <label>
            Страна
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="all">Все страны</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {countryLabel[c] || c}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={featuredOnly} onChange={(e) => setFeaturedOnly(e.target.checked)} /> Избранные
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={audioOnly} onChange={(e) => setAudioOnly(e.target.checked)} /> С аудио
          </label>
          <label>
            На странице
            <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
              <option value={18}>18</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={120}>120</option>
            </select>
          </label>
        </div>

        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="notice">
            {notice}
            <button className="icon" onClick={() => setNotice('')} aria-label="Закрыть уведомление">
              <X size={16} />
            </button>
          </p>
        )}

        <div className="mon-pager">
          <span>
            {total === 0 ? 'Ничего не найдено' : `Показано ${from}–${to} из ${total}`}
            {stats && ` · в базе: ${stats.monasteries}`}
          </span>
          <div className="actions">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Предыдущая страница">
              ← Назад
            </button>
            <span className="mon-pager-page">
              Стр. {page} из {pages}
            </span>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Следующая страница">
              Вперёд →
            </button>
          </div>
        </div>

        {viewMode === 'grid' ? (
          <div className="mon-grid">
            {items.map((m) => (
              <article className="mon-card" key={m.id}>
                <button className="mon-card-img" onClick={() => openEdit(m)} aria-label={`Открыть ${m.name}`}>
                  {m.image_url ? (
                    <img src={cs(m.image_url)} alt="" loading="lazy" onError={fallbackImage} />
                  ) : (
                    <img src={IMG_FALLBACK} alt="" />
                  )}
                  {m.min_price != null && m.min_price !== '' && <span className="mon-price">{money(m.min_price)}</span>}
                </button>
                <div className="mon-card-body">
                  <button className="text-button mon-card-name" onClick={() => openEdit(m)}>
                    {m.name}
                  </button>
                  <p className="mon-card-sub">
                    {countryLabel[m.country] || m.country}
                    {m.city_name ? ` · ${m.city_name}` : ''}
                  </p>
                  <div className="mon-tags">
                    {m.featured && <span className="badge warm">★ Избранное</span>}
                    {m.has_private_bathroom && <span className="badge">Своя ванная</span>}
                    {m.audio_url && <span className="badge">Аудио-экскурсия</span>}
                  </div>
                  <div className="mon-card-foot">
                    <small className="mon-card-id">
                      {m.id}
                      <span> · {m.slug}</span>
                    </small>
                    <div className="actions">
                      <button className="icon" onClick={() => openEdit(m)} aria-label="Редактировать" hidden={readonly}>
                        <Pencil size={16} />
                      </button>
                      <button className="icon danger" onClick={() => void del(m)} disabled={busy} aria-label="Удалить" hidden={readonly}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Монастырь</th>
                  <th>Страна / город</th>
                  <th>Цена от</th>
                  <th>Ванная</th>
                  <th>Избранное</th>
                  <th>Аудио</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="mon-cell">
                        {m.image_url && (
                          <img src={cs(m.image_url)} alt="" loading="lazy" onError={fallbackImage} />
                        )}
                        <div>
                          <button className="text-button" onClick={() => openEdit(m)}>
                            {m.name}
                          </button>
                          <small>
                            {m.id} · {m.slug}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {countryLabel[m.country] || m.country}
                      <small>{m.city_name}</small>
                    </td>
                    <td>{money(m.min_price)}</td>
                    <td>{m.has_private_bathroom ? 'Да' : '—'}</td>
                    <td>{m.featured ? '★' : '—'}</td>
                    <td>{m.audio_url ? 'есть' : '—'}</td>
                    <td className="actions" style={{ whiteSpace: 'nowrap' }}>
                      <button className="icon" onClick={() => openEdit(m)} aria-label="Редактировать" hidden={readonly}>
                        <Pencil size={16} />
                      </button>
                      <button className="icon danger" onClick={() => void del(m)} disabled={busy} aria-label="Удалить" hidden={readonly}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!items.length && <p className="empty">{loading && !items.length ? 'Загружаем список…' : 'По выбранным фильтрам монастырей нет.'}</p>}
      </div>
    </section>
  );
}

export function MonasteryBookings({ request, readonly = false }: { request: Request; readonly?: boolean }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [options, setOptions] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, any> | null>(null);
  const bDialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);

  async function loadBookings() {
    setBookings(
      await request(
        statusFilter === 'all' ? '/bookings' : `/bookings?status=${encodeURIComponent(statusFilter)}`,
      ),
    );
  }
  async function refresh() {
    setError('');
    const current = ++generation.current;
    try {
      if (!options.length) setOptions(await request('/monasteries/options'));
      await loadBookings();
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    };
  }, [statusFilter]);
  useEffect(() => {
    if (form) bDialog.current?.showModal();
    else bDialog.current?.close();
  }, [form]);

  function openBooking() {
    if (readonly) return;
    setForm({ monastery_id: '', guest_name: '', email: '', phone: '', guests: 1, check_in: '', check_out: '', room_notes: '', total_amount: '', status: 'new' });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form || readonly) return;
    setBusy(true);
    setError('');
    const payload: any = { ...form };
    ['phone', 'check_in', 'check_out', 'room_notes', 'total_amount'].forEach((k) => {
      if (payload[k] === '') payload[k] = null;
    });
    try {
      await request('/bookings', { method: 'POST', body: JSON.stringify(payload) });
      setForm(null);
      setNotice('Бронирование добавлено.');
      await loadBookings();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function setStatus(b: Booking, value: string) {
    if (readonly) return;
    setBusy(true);
    setError('');
    try {
      await request(`/bookings/${encodeURIComponent(b.id)}`, { method: 'PUT', body: JSON.stringify({ status: value }) });
      setNotice('Статус изменён.');
      await loadBookings();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function del(b: Booking) {
    if (readonly) return;
    if (!window.confirm('Удалить бронирование?')) return;
    setBusy(true);
    setError('');
    try {
      await request(`/bookings/${encodeURIComponent(b.id)}`, { method: 'DELETE' });
      setNotice('Бронирование удалено.');
      await loadBookings();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mon">
      <div className="panel mon-content">
        <div className="mon-toolbar">
          <div className="filters mon-filters">
            <label>
              Статус
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Все статусы</option>
                {Object.entries(bookingStatus).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="actions">
            <button className="primary" onClick={openBooking} disabled={busy} hidden={readonly}>
              <Plus size={17} /> Добавить бронирование
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="notice">
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
                <th>Гость</th>
                <th>Монастырь</th>
                <th>Даты</th>
                <th>Гости</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>
                    {b.guest_name}
                    <small>
                      {b.email}
                      {b.phone ? ` · ${b.phone}` : ''}
                    </small>
                  </td>
                  <td>
                    {b.monastery_name || b.monastery_id}
                    <small>{b.monastery_slug}</small>
                  </td>
                  <td>
                    {fmtDate(b.check_in)}
                    <small>{b.check_out ? `до ${fmtDate(b.check_out)}` : '—'}</small>
                  </td>
                  <td>{b.guests}</td>
                  <td>{money(b.total_amount)}</td>
                  <td>
                    <select value={b.status} onChange={(e) => void setStatus(b, e.target.value)} disabled={busy || readonly}>
                      {Object.entries(bookingStatus).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="actions" style={{ whiteSpace: 'nowrap' }}>
                    <button className="icon danger" onClick={() => void del(b)} disabled={busy} aria-label="Удалить" hidden={readonly}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!bookings.length && <p className="empty">Бронирований нет.</p>}

        <dialog ref={bDialog} onCancel={(e) => { e.preventDefault(); setForm(null); }} aria-label="Новое бронирование">
          {form && (
            <>
              <div className="dialog-heading">
                <h2>Новое бронирование</h2>
                <button className="icon" onClick={() => setForm(null)} disabled={busy} aria-label="Закрыть">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={save}>
                <div className="dialog-body">
                  <div className="field-grid">
                    <label>
                      Монастырь *
                      <select required value={form.monastery_id} onChange={(e) => setForm({ ...form, monastery_id: e.target.value })}>
                        <option value="">Выберите…</option>
                        {options.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.city_name})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Статус
                      <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        {Object.entries(bookingStatus).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Имя гостя *<input required value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} />
                    </label>
                    <label>
                      Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </label>
                    <label>
                      Телефон<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </label>
                    <label>
                      Гостей<input type="number" min="1" value={form.guests} onChange={(e) => setForm({ ...form, guests: Number(e.target.value) })} />
                    </label>
                    <label>
                      Заезд<input type="date" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} />
                    </label>
                    <label>
                      Выезд<input type="date" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} />
                    </label>
                    <label>
                      Сумма €<input value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
                    </label>
                  </div>
                  <label>
                    Заметки к номерам
                    <textarea rows={3} value={form.room_notes} onChange={(e) => setForm({ ...form, room_notes: e.target.value })} />
                  </label>
                  <div className="dialog-footer">
                    <button type="button" className="button" onClick={() => setForm(null)} disabled={busy}>
                      Отмена
                    </button>
                    <button className="primary" disabled={busy}>
                      {busy ? 'Сохраняем…' : 'Добавить'}
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}
        </dialog>
      </div>
    </section>
  );
}

export function MonasteryWaitlist({ request }: { request: Request }) {
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    request('/waitlist')
      .then((data) => {
        if (alive) setWaitlist(data || []);
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [request]);

  return (
    <section className="mon">
      <div className="panel mon-content">
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Когда подписался</th>
              </tr>
            </thead>
            <tbody>
              {waitlist.map((e) => (
                <tr key={e.id}>
                  <td>{e.email}</td>
                  <td>{fmtDate(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!waitlist.length && <p className="empty">{loading ? 'Загружаем лист ожидания…' : 'В листе ожидания пока никого нет.'}</p>}
      </div>
    </section>
  );
}