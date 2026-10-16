import React, { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Upload, LayoutGrid, Rows3, X } from 'lucide-react';

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

const hueOf = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
};
const bgFor = (s: string) => {
  const h = hueOf(s || 'Monastery');
  return `linear-gradient(135deg, hsl(${h} 42% 64%), hsl(${(h + 40) % 360} 40% 46%))`;
};

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
  const [perPage, setPerPage] = useState(12);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Monastery | null>(null);
  const [editing, setEditing] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [confirmDel, setConfirmDel] = useState<Monastery | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);

  function showToast(msg: string, kind: 'ok' | 'err' = 'ok') {
    setToast({ msg, kind });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }

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
  useEffect(() => {
    return () => window.clearTimeout(toastTimer.current);
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (confirmDel) setConfirmDel(null);
      else if (form) closeForm();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [form, confirmDel]);

  function openCreate() {
    if (readonly) return;
    setFormErr('');
    setForm(emptyForm());
    setEditing(false);
  }
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
    setFormErr('');
    setForm(f);
    setEditing(!!m.id);
  }
  function closeForm() {
    setForm(null);
    setFormErr('');
  }
  function set(k: string, v: any) {
    setForm((prev) => (prev ? { ...prev, [k]: v } : prev));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form || readonly) return;
    if (!cs(form.name).trim() || !cs(form.city_name).trim() || !cs(form.country).trim()) {
      setFormErr('Заполните обязательные поля: название, город, страна.');
      return;
    }
    setBusy(true);
    setFormErr('');
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
        setFormErr(`Поле «${k}» содержит некорректный JSON.`);
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
      showToast(editing ? 'Монастырь обновлён.' : 'Монастырь создан.');
      await Promise.all([loadStats(), loadMonasteries()]);
    } catch (err) {
      setFormErr((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function doDelete() {
    if (!confirmDel || readonly) return;
    setBusy(true);
    try {
      await request(`/monasteries/${encodeURIComponent(confirmDel.id)}`, { method: 'DELETE' });
      setConfirmDel(null);
      showToast('Монастырь удалён.');
      await Promise.all([loadStats(), loadMonasteries()]);
    } catch (err) {
      showToast((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }
  async function toggleFeatured(m: Monastery) {
    if (readonly) return;
    const next = !m.featured;
    setBusy(true);
    try {
      const updated = await request(`/monasteries/${encodeURIComponent(m.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ featured: next }),
      });
      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, featured: updated?.featured ?? next } : x)));
      showToast(next ? 'Добавлено в избранное.' : 'Убрано из избранного.');
      void loadStats();
    } catch (err) {
      showToast((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }
  async function uploadImage() {
    if (readonly) return;
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setFormErr('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/uploads', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Ошибка загрузки (${res.status})`);
      set('image_url', data.url);
      showToast('Файл загружен. Сохраните монастырь, чтобы применить фото.');
    } catch (err) {
      setFormErr((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const countries = [...new Set(items.map((m) => m.country))].sort();
  const pages = Math.max(1, Math.ceil((total || 0) / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total || 0, page * perPage);

  const thumbStyle = (m: Monastery) => (m.image_url ? undefined : { background: bgFor(cs(m.name)) });

  return (
    <section className="mcat">
      <div className="card">
        <div className="bar">
          <div className="seg" role="group" aria-label="Вид списка">
            <button className={viewMode === 'grid' ? 'on' : ''} onClick={() => setViewMode('grid')}>
              <LayoutGrid size={15} /> Сетка
            </button>
            <button className={viewMode === 'table' ? 'on' : ''} onClick={() => setViewMode('table')}>
              <Rows3 size={15} /> Таблица
            </button>
          </div>
          <div className="ra">
            <button className="btn" onClick={() => void refresh()} disabled={loading || busy}>
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              {loading ? 'Обновляем…' : 'Обновить'}
            </button>
            {!readonly && (
              <button className="btn p" onClick={openCreate} disabled={busy}>
                <Plus size={16} /> Добавить монастырь
              </button>
            )}
          </div>
        </div>

        <div className="flt">
          <div className="fg g">
            <span className="lbl">Поиск</span>
            <input
              className="in"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название, город, ID…"
            />
          </div>
          <div className="fg">
            <span className="lbl">Страна</span>
            <select className="in" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="all">Все страны</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {countryLabel[c] || c}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={'tg' + (featuredOnly ? ' on' : '')}
            onClick={() => setFeaturedOnly((v) => !v)}
            aria-pressed={featuredOnly}
          >
            ★ Избранные
          </button>
          <button
            type="button"
            className={'tg' + (audioOnly ? ' on' : '')}
            onClick={() => setAudioOnly((v) => !v)}
            aria-pressed={audioOnly}
          >
            ♪ С аудио
          </button>
          <div className="fg">
            <span className="lbl">На странице</span>
            <select className="in" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}

        {viewMode === 'grid' ? (
          <div className="grid">
            {items.map((m) => (
              <article className="mc" key={m.id}>
                <div
                  className="ph"
                  style={thumbStyle(m)}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEdit(m)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') openEdit(m);
                  }}
                >
                  {m.image_url && <img src={cs(m.image_url)} alt="" loading="lazy" onError={fallbackImage} />}
                  {!readonly && (
                    <button
                      type="button"
                      className={'fv' + (m.featured ? ' on' : '')}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleFeatured(m);
                      }}
                      disabled={busy}
                      aria-label={m.featured ? 'Убрать из избранного' : 'Добавить в избранное'}
                    >
                      ★
                    </button>
                  )}
                  {m.min_price != null && m.min_price !== '' && <span className="pr">{money(m.min_price)}</span>}
                </div>
                <div className="bd2">
                  <h3 onClick={() => openEdit(m)}>{m.name}</h3>
                  <div className="sub">
                    {countryLabel[m.country] || m.country}
                    {m.city_name ? ` · ${m.city_name}` : ''}
                  </div>
                  <div className="tags">
                    {m.featured && <span className="tag fav">Избранное</span>}
                    {m.has_private_bathroom && <span className="tag">Своя ванная</span>}
                    {m.audio_url && <span className="tag">Аудио</span>}
                  </div>
                </div>
                <div className="ft">
                  <span className="code">
                    <b>{m.id}</b> · {m.slug}
                  </span>
                  <span className="ibs">
                    {!readonly && (
                      <button className="ib" onClick={() => openEdit(m)} aria-label="Редактировать">
                        <Pencil size={15} />
                      </button>
                    )}
                    {!readonly && (
                      <button className="ib d" onClick={() => setConfirmDel(m)} disabled={busy} aria-label="Удалить">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Город</th>
                  <th>Код</th>
                  <th>Цена</th>
                  <th>Теги</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="tn">
                        <span className="th" style={thumbStyle(m)}>
                          {m.image_url && <img src={cs(m.image_url)} alt="" loading="lazy" onError={fallbackImage} />}
                        </span>
                        <button className="text-button" onClick={() => openEdit(m)}>
                          {m.name}
                        </button>
                      </div>
                    </td>
                    <td>
                      {countryLabel[m.country] || m.country}
                      {m.city_name ? ` · ${m.city_name}` : ''}
                    </td>
                    <td className="code">{m.id}</td>
                    <td>{money(m.min_price)}</td>
                    <td>
                      <div className="tags">
                        {m.featured && <span className="tag fav">Избранное</span>}
                        {m.audio_url && <span className="tag">Аудио</span>}
                        {m.has_private_bathroom && <span className="tag">Ванная</span>}
                      </div>
                    </td>
                    <td className="right">
                      <span className="ibs">
                        {!readonly && (
                          <button className="ib" onClick={() => openEdit(m)} aria-label="Редактировать">
                            <Pencil size={15} />
                          </button>
                        )}
                        {!readonly && (
                          <button className="ib d" onClick={() => setConfirmDel(m)} disabled={busy} aria-label="Удалить">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!items.length && (
          <p className="empty">{loading ? 'Загружаем список…' : 'По выбранным фильтрам монастырей нет.'}</p>
        )}

        <div className="meta">
          <span>
            {total === 0 ? 'Ничего не найдено' : `Показано ${from}–${to} из ${total}`}
            {stats && ` · в базе: ${stats.monasteries}`}
          </span>
          <div className="pg">
            <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ← Назад
            </button>
            <span className="pn">
              Стр. {page} из {pages}
            </span>
            <button className="btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Вперёд →
            </button>
          </div>
        </div>
      </div>

      {confirmDel && (
        <div
          className="ov c"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmDel(null);
          }}
        >
          <div className="dlg" role="alertdialog" aria-modal="true">
            <h2>Удалить монастырь?</h2>
            <p>«{confirmDel.name}» будет удалён без возможности восстановления.</p>
            <footer>
              <button className="btn" onClick={() => setConfirmDel(null)} disabled={busy}>
                Отмена
              </button>
              <button className="btn del" onClick={() => void doDelete()} disabled={busy}>
                {busy ? 'Удаляем…' : 'Удалить'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {form && (
        <div
          className="ov"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) closeForm();
          }}
        >
          <div className="dr" role="dialog" aria-modal="true">
            <form onSubmit={save}>
              <div className="dh">
                <h2>{editing ? 'Редактирование' : 'Новый монастырь'}</h2>
                <button type="button" className="btn" onClick={closeForm} disabled={busy}>
                  Отмена
                </button>
              </div>

              <div className="db">
                {formErr && <p className="err">{formErr}</p>}

                <div className="fs">
                  <div className="lg">Основное</div>
                  <div className="f2">
                    <label className="f">
                      Название *
                      <input className="in" value={cs(form.name)} onChange={(e) => set('name', e.target.value)} />
                    </label>
                    <label className="f">
                      Город *
                      <input className="in" value={cs(form.city_name)} onChange={(e) => set('city_name', e.target.value)} />
                    </label>
                    <label className="f">
                      Страна
                      <select className="in" value={cs(form.country)} onChange={(e) => set('country', e.target.value)}>
                        <option value="Italy">Италия</option>
                        <option value="Austria">Австрия</option>
                        <option value="Slovenia">Словения</option>
                      </select>
                    </label>
                    <label className="f">
                      Цена от €
                      <input
                        className="in"
                        type="number"
                        step="0.01"
                        min="0"
                        value={cs(form.min_price)}
                        onChange={(e) => set('min_price', e.target.value)}
                      />
                    </label>
                    <label className="f">
                      Код (slug)
                      <input
                        className="in"
                        value={cs(form.slug)}
                        onChange={(e) => set('slug', e.target.value)}
                        placeholder="auto-генерируется"
                      />
                    </label>
                    <label className="f">
                      Регион
                      <input className="in" value={cs(form.region)} onChange={(e) => set('region', e.target.value)} />
                    </label>
                    <label className="f">
                      Широта
                      <input
                        className="in"
                        value={cs(form.latitude)}
                        onChange={(e) => set('latitude', e.target.value)}
                        placeholder="46.00"
                      />
                    </label>
                    <label className="f">
                      Долгота
                      <input
                        className="in"
                        value={cs(form.longitude)}
                        onChange={(e) => set('longitude', e.target.value)}
                        placeholder="13.00"
                      />
                    </label>
                  </div>
                  <div className="tgrow">
                    <button
                      type="button"
                      className={'tg' + (form.featured ? ' on' : '')}
                      onClick={() => set('featured', !form.featured)}
                      aria-pressed={!!form.featured}
                    >
                      ★ Избранное
                    </button>
                    <button
                      type="button"
                      className={'tg' + (form.has_private_bathroom ? ' on' : '')}
                      onClick={() => set('has_private_bathroom', !form.has_private_bathroom)}
                      aria-pressed={!!form.has_private_bathroom}
                    >
                      Своя ванная
                    </button>
                  </div>
                </div>

                <div className="fs">
                  <div className="lg">Медиа</div>
                  <div className="mmedia">
                    <div className="mphoto">
                      {cs(form.image_url) ? (
                        <img src={cs(form.image_url)} alt="" onError={fallbackImage} />
                      ) : (
                        <div className="ph-ph" style={{ background: bgFor(cs(form.name) || 'Monastery') }} />
                      )}
                    </div>
                    <div className="mmedia-act">
                      <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadImage} />
                      <button
                        type="button"
                        className="btn"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                      >
                        <Upload size={15} /> {uploading ? 'Загружаем…' : 'Загрузить файл'}
                      </button>
                      <label className="f">
                        Фото (URL)
                        <input
                          className="in"
                          value={cs(form.image_url)}
                          onChange={(e) => set('image_url', e.target.value)}
                          placeholder="/images/venues/ABA103"
                        />
                      </label>
                      <label className="f">
                        Аудио-экскурсия (URL)
                        <input
                          className="in"
                          value={cs(form.audio_url)}
                          onChange={(e) => set('audio_url', e.target.value)}
                          placeholder="https://… или /media-files/…"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="fs">
                  <div className="lg">Тексты</div>
                  <label className="f">
                    Краткое введение
                    <textarea
                      className="in"
                      rows={3}
                      value={cs(form.intro)}
                      onChange={(e) => set('intro', e.target.value)}
                      placeholder="Пара предложений для карточки…"
                    />
                  </label>
                  <label className="f">
                    Описание
                    <textarea
                      className="in"
                      rows={6}
                      value={cs(form.description)}
                      onChange={(e) => set('description', e.target.value)}
                      placeholder="Полный текст страницы монастыря…"
                    />
                  </label>
                </div>

                <div className="fs">
                  <div className="lg">Проживание и правила</div>
                  <div className="f2">
                    <label className="f">
                      Номера
                      <textarea
                        className="in"
                        rows={3}
                        value={cs(form.room_notes)}
                        onChange={(e) => set('room_notes', e.target.value)}
                        placeholder="Двухместные номера, общие удобства…"
                      />
                    </label>
                    <label className="f">
                      Часы работы
                      <input
                        className="in"
                        value={cs(form.opening_hours)}
                        onChange={(e) => set('opening_hours', e.target.value)}
                      />
                    </label>
                    <label className="f">
                      Заезд
                      <input className="in" value={cs(form.checkin)} onChange={(e) => set('checkin', e.target.value)} />
                    </label>
                    <label className="f">
                      Выезд
                      <input className="in" value={cs(form.checkout)} onChange={(e) => set('checkout', e.target.value)} />
                    </label>
                    <label className="f">
                      Комендантский час
                      <input className="in" value={cs(form.curfew)} onChange={(e) => set('curfew', e.target.value)} />
                    </label>
                    <label className="f">
                      Кто управляет
                      <input
                        className="in"
                        value={cs(form.operated_by)}
                        onChange={(e) => set('operated_by', e.target.value)}
                      />
                    </label>
                  </div>
                </div>

                <div className="fs">
                  <div className="lg">SEO</div>
                  <label className="f">
                    SEO title
                    <input className="in" value={cs(form.seo_title)} onChange={(e) => set('seo_title', e.target.value)} />
                  </label>
                  <label className="f">
                    SEO description
                    <textarea
                      className="in"
                      rows={3}
                      value={cs(form.seo_description)}
                      onChange={(e) => set('seo_description', e.target.value)}
                    />
                  </label>
                </div>

                <details className="mjson">
                  <summary>Технические данные (JSON)</summary>
                  {jsonFields.map(([k, label]) => (
                    <label className="f" key={k}>
                      {label}
                      <textarea
                        className="in"
                        rows={2}
                        spellCheck={false}
                        value={cs(form[k])}
                        onChange={(e) => set(k, e.target.value)}
                        placeholder="null / {} / […]"
                      />
                    </label>
                  ))}
                </details>
              </div>

              <div className="df">
                <button type="button" className="btn" onClick={closeForm} disabled={busy}>
                  Отмена
                </button>
                <button className="btn p" disabled={busy || uploading}>
                  {busy ? 'Сохраняем…' : editing ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={'toast' + (toast.kind === 'err' ? ' err' : '')} role="status">
          {toast.msg}
        </div>
      )}
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
