import React, { useEffect, useState } from 'react';
import { Landmark, CalendarCheck, Mail, RefreshCw } from 'lucide-react';

type Request = (path: string, init?: RequestInit) => Promise<any>;
type Stats = {
  monasteries: number;
  featured: number;
  waitlist: number;
  newWaitlist: number;
  bookings: number;
  newBookings: number;
  byCountry?: { country: string; count: number }[];
  byStatus?: { status: string; count: number }[];
};
const countryLabel: Record<string, string> = { Italy: 'Италия', Austria: 'Австрия', Slovenia: 'Словения' };
const bookingStatus: Record<string, string> = { new: 'Новая', confirmed: 'Подтверждена', cancelled: 'Отменена' };

export function MonDash({
  request,
  go,
}: {
  request: Request;
  go: (view: string) => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setStats(await request('/stats'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const featuredPct =
    stats && stats.monasteries
      ? Math.round((stats.featured / stats.monasteries) * 100)
      : 0;
  const maxCountry = stats?.byCountry?.length
    ? Math.max(...stats.byCountry.map((c) => c.count))
    : 1;
  const maxStatus = stats?.byStatus?.length
    ? Math.max(...stats.byStatus.map((s) => s.count))
    : 1;

  const tabs = [
    { view: 'monasteries', label: 'Монастыри', icon: Landmark, count: stats?.monasteries },
    { view: 'bookings', label: 'Бронирования', icon: CalendarCheck, count: stats?.bookings },
    { view: 'waitlist', label: 'Лист ожидания', icon: Mail, count: stats?.waitlist },
  ] as const;

  return (
    <section className="mon">
      <nav className="mon-tabs" aria-label="Разделы Monastery Stays">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.view} onClick={() => go(t.view)}>
              <Icon size={17} />
              {t.label}
              {t.count !== undefined && <span>{t.count}</span>}
            </button>
          );
        })}
      </nav>
      <nav className="mon-tabs-sub" aria-label="Быстрые действия">
        <button onClick={() => go('monasteries')}>
          Открыть список и редактор <Landmark size={16} />
        </button>
        <button onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          {loading ? 'Обновляем…' : 'Обновить статистику'}
        </button>
      </nav>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {loading && !stats && (
        <p className="empty">Загружаем аналитику…</p>
      )}

      {stats && (
        <>
          <div className="dash-metrics">
            <div className="dash-metric">
              <span>Монастырей в базе</span>
              <strong>{stats.monasteries}</strong>
            </div>
            <div className="dash-metric">
              <span>В избранном</span>
              <strong>{stats.featured}</strong>
            </div>
            <div className="dash-metric">
              <span>Новых в листе ожидания</span>
              <strong>{stats.newWaitlist}</strong>
            </div>
            <div className="dash-metric">
              <span>Всего в листе ожидания</span>
              <strong>{stats.waitlist}</strong>
            </div>
            <div className="dash-metric">
              <span>Бронирований</span>
              <strong>{stats.bookings}</strong>
            </div>
            <div className="dash-metric">
              <span>Новых бронирований</span>
              <strong>{stats.newBookings}</strong>
            </div>
          </div>

          <div className="dash-grid">
            <section className="panel dash-card">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">ГЕОГРАФИЯ</span>
                  <h2>Монастыри по странам</h2>
                </div>
              </div>
              <div className="chart-bars">
                {stats.byCountry?.length ? (
                  stats.byCountry.map((c) => (
                    <div className="chart-bar" key={c.country}>
                      <span>{countryLabel[c.country] || c.country}</span>
                      <div className="chart-bar-track">
                        <div style={{ width: `${Math.round((c.count / maxCountry) * 100)}%` }} />
                      </div>
                      <strong>{c.count}</strong>
                    </div>
                  ))
                ) : (
                  <p className="muted">Нет данных</p>
                )}
              </div>
            </section>

            <section className="panel dash-card">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">КАТАЛОГ</span>
                  <h2>Избранные монастыри</h2>
                </div>
              </div>
              <div className="donut-wrap">
                <div
                  className="donut"
                  style={{
                    background: `conic-gradient(#f97316 0 ${featuredPct}%, #eef2f6 ${featuredPct}% 100%)`,
                  }}
                >
                  <div className="donut-hole">
                    <strong>{featuredPct}%</strong>
                    <small>избранных</small>
                  </div>
                </div>
                <ul className="donut-legend">
                  <li>
                    <span className="swatch hot" /> Избранные
                    <strong>{stats.featured}</strong>
                  </li>
                  <li>
                    <span className="swatch" /> Остальные
                    <strong>{stats.monasteries - stats.featured}</strong>
                  </li>
                </ul>
              </div>
            </section>

            <section className="panel dash-card">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">БРОНИРОВАНИЯ</span>
                  <h2>По статусам</h2>
                </div>
              </div>
              <div className="chart-bars">
                {stats.byStatus?.length ? (
                  stats.byStatus.map((s) => (
                    <div className="chart-bar" key={s.status}>
                      <span>{bookingStatus[s.status] || s.status}</span>
                      <div className="chart-bar-track">
                        <div style={{ width: `${Math.round((s.count / maxStatus) * 100)}%` }} />
                      </div>
                      <strong>{s.count}</strong>
                    </div>
                  ))
                ) : (
                  <p className="muted">Бронирований пока нет</p>
                )}
              </div>
            </section>

            <section className="panel dash-card">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">ЛИСТ ОЖИДАНИЯ</span>
                  <h2>Подписки за 3 дня</h2>
                </div>
              </div>
              <div className="waitlist-card">
                <div className="waitlist-num">
                  <strong>{stats.newWaitlist}</strong>
                  <span>новых</span>
                </div>
                <div className="waitlist-sub">
                  <span>из {stats.waitlist} всего</span>
                  <div className="chart-bar-track">
                    <div
                      style={{
                        width: `${stats.waitlist ? Math.round((stats.newWaitlist / stats.waitlist) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </section>
  );
}