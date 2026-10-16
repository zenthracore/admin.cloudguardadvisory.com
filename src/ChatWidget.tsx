import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare,
  X,
  Plus,
  Send,
  Paperclip,
  Clock,
  Users,
  Hash,
  ChevronLeft,
  Trash2,
  Check,
  CheckCheck,
  CornerUpLeft,
  Loader2,
  Image as ImageIcon,
  FileText,
  CalendarClock,
} from 'lucide-react';
import type { Me } from './access';
import {
  chatApi,
  ChatSocket,
  avatarColor,
  initial,
  type Attachment,
  type Channel,
  type ChatEvent,
  type Member,
  type Message,
} from './chat';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Сегодня';
  if (same(d, y)) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
}
function fileSize(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
}
// Local datetime string for the <input type="datetime-local"> min bound.
const localNow = () => {
  const d = new Date(Date.now() + 60_000);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
};

function Avatar({ name, url, size = 32 }: { name: string; url?: string; size?: number }) {
  if (url) {
    return <img className="chat-av" src={url} alt={name} style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="chat-av chat-av-txt"
      style={{ background: avatarColor(name), width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial(name)}
    </span>
  );
}

export function ChatWidget({ me }: { me: Me | null }) {
  const [open, setOpen] = useState(false);
  const [conn, setConn] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [users, setUsers] = useState<Member[]>([]);
  const [online, setOnline] = useState<Record<number, boolean>>({});
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, Message[]>>({});
  const [reads, setReads] = useState<Record<number, Record<number, number>>>({});
  const [typing, setTyping] = useState<Record<number, { name: string; at: number }>>({});
  const [scheduled, setScheduled] = useState<Message[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [showScheduled, setShowScheduled] = useState(false);
  const [newChannel, setNewChannel] = useState(false);
  const [toast, setToast] = useState('');

  const socketRef = useRef<ChatSocket | null>(null);
  const activeRef = useRef<number | null>(null);
  const openRef = useRef(false);
  const msgsEndRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const myId = me?.id ?? 0;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3000);
  }, []);

  const upsertChannel = useCallback((ch: Channel) => {
    setChannels((prev) => {
      const idx = prev.findIndex((c) => c.id === ch.id);
      if (idx === -1) return [ch, ...prev];
      const next = prev.slice();
      next[idx] = { ...prev[idx], ...ch };
      return next;
    });
  }, []);

  const markReadLocal = useCallback(
    (channelId: number, lastId: number) => {
      setChannels((prev) => prev.map((c) => (c.id === channelId ? { ...c, unread: 0, lastReadId: Math.max(c.lastReadId, lastId) } : c)));
      socketRef.current?.send({ type: 'read', channelId, lastId });
    },
    [],
  );

  const handleEvent = useCallback(
    (e: ChatEvent) => {
      switch (e.type) {
        case 'message': {
          const m = e.message;
          if (e.scheduled) {
            setScheduled((prev) => (prev.some((s) => s.id === m.id) ? prev : [...prev, m]));
            setMessages((prev) => {
              const list = (prev[m.channelId] || []).filter((x) => x.clientId !== m.clientId);
              return { ...prev, [m.channelId]: list };
            });
            return;
          }
          setMessages((prev) => {
            const list = prev[m.channelId] ? prev[m.channelId].slice() : [];
            const byClient = m.clientId ? list.findIndex((x) => x.clientId === m.clientId) : -1;
            const byId = list.findIndex((x) => x.id === m.id);
            if (byClient !== -1) list[byClient] = m;
            else if (byId !== -1) list[byId] = m;
            else list.push(m);
            return { ...prev, [m.channelId]: list };
          });
          setChannels((prev) =>
            prev.map((c) =>
              c.id === m.channelId
                ? {
                    ...c,
                    lastMessage: m,
                    lastAt: m.createdAt,
                    unread:
                      m.userId === myId || (activeRef.current === m.channelId && openRef.current)
                        ? 0
                        : c.unread + 1,
                  }
                : c,
            ),
          );
          if (activeRef.current === m.channelId && openRef.current && m.userId !== myId) {
            markReadLocal(m.channelId, m.id);
          }
          break;
        }
        case 'read': {
          setReads((prev) => {
            const ch = { ...(prev[e.channelId] || {}) };
            ch[e.userId] = Math.max(ch[e.userId] || 0, e.lastId);
            return { ...prev, [e.channelId]: ch };
          });
          break;
        }
        case 'typing': {
          if (e.userId === myId) break;
          setTyping((prev) => ({ ...prev, [e.channelId]: { name: e.name || 'Кто-то', at: Date.now() } }));
          window.setTimeout(() => {
            setTyping((prev) => {
              const cur = prev[e.channelId];
              if (cur && Date.now() - cur.at >= 2900) {
                const next = { ...prev };
                delete next[e.channelId];
                return next;
              }
              return prev;
            });
          }, 3200);
          break;
        }
        case 'presence': {
          setOnline((prev) => ({ ...prev, [e.userId]: e.online }));
          break;
        }
        case 'deleted': {
          setMessages((prev) => ({
            ...prev,
            [e.channelId]: (prev[e.channelId] || []).filter((m) => m.id !== e.messageId),
          }));
          setScheduled((prev) => prev.filter((m) => m.id !== e.messageId));
          break;
        }
        case 'error': {
          flash(e.error || 'Ошибка чата');
          break;
        }
      }
    },
    [myId, markReadLocal, flash],
  );

  const handleEventRef = useRef(handleEvent);
  useEffect(() => {
    handleEventRef.current = handleEvent;
  }, [handleEvent]);

  // Establish the transport once the widget is mounted (authenticated).
  useEffect(() => {
    const socket = new ChatSocket(
      (e) => handleEventRef.current(e),
      (s) => setConn(s),
    );
    socketRef.current = socket;
    socket.connect();
    (async () => {
      try {
        const data = await chatApi.bootstrap();
        setChannels(data.channels || []);
        setUsers(data.users || []);
        setOnline(
          Object.fromEntries(Object.entries(data.online || {}).map(([k, v]) => [Number(k), v])),
        );
        setScheduled(data.scheduled || []);
        setActiveId((cur) => cur ?? data.channels?.[0]?.id ?? null);
      } catch {
        /* bootstrap failures surface via toasts on interaction */
      }
    })();
    return () => socket.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = useMemo(() => channels.find((c) => c.id === activeId) || null, [channels, activeId]);

  // Load messages when the active channel changes or the panel opens.
  useEffect(() => {
    if (!open || activeId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await chatApi.messages(activeId, 0, 50);
        if (cancelled) return;
        setMessages((prev) => ({ ...prev, [activeId]: data.messages }));
        if (data.channel) upsertChannel(data.channel);
        const last = data.messages[data.messages.length - 1];
        if (last) markReadLocal(activeId, last.id);
      } catch {
        /* ignored */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeId]);

  // Scroll to newest on message/typing changes for the active channel.
  const activeMessages = activeId != null ? messages[activeId] || [] : [];
  useEffect(() => {
    if (open) msgsEndRef.current?.scrollIntoView({ block: 'end' });
  }, [activeMessages.length, typing, open, activeId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        if (newChannel) setNewChannel(false);
        else if (showScheduled) setShowScheduled(false);
        else setShowMembers(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, newChannel, showScheduled, showMembers]);

  const unreadTotal = channels.reduce((sum, c) => sum + (c.unread || 0), 0);

  const setDraft = (v: string) => {
    if (activeId != null) setDrafts((prev) => ({ ...prev, [activeId]: v }));
  };
  const draft = activeId != null ? drafts[activeId] || '' : '';

  async function onPickFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const a = await chatApi.upload(f);
        setAttachments((prev) => [...prev, a]);
      }
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function send() {
    if (activeId == null) return;
    const body = draft.trim();
    if (!body && attachments.length === 0) return;
    const clientId = `c${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    const optimistic: Message = {
      id: -Date.now(),
      channelId: activeId,
      userId: myId,
      userName: me?.name || '',
      userEmail: me?.email || '',
      body,
      kind: 'text',
      status: 'sent',
      sendAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      attachments,
      readBy: 0,
      read: false,
      clientId,
      pending: true,
    };
    setMessages((prev) => ({ ...prev, [activeId]: [...(prev[activeId] || []), optimistic] }));
    setDraft('');
    const payload: Record<string, unknown> = {
      type: 'send',
      channelId: activeId,
      body,
      clientId,
      attachments,
    };
    if (showSchedule && scheduleAt) {
      payload.scheduledAt = new Date(scheduleAt).toISOString();
    }
    const ok = socketRef.current?.send(payload);
    if (!ok) {
      setMessages((prev) => ({
        ...prev,
        [activeId]: (prev[activeId] || []).map((m) =>
          m.clientId === clientId ? { ...m, pending: false, failed: true } : m,
        ),
      }));
      flash('Нет соединения. Сообщение не отправлено.');
    }
    setAttachments([]);
    setShowSchedule(false);
    setScheduleAt('');
  }

  function openChannel(id: number) {
    setActiveId(id);
    setShowMembers(false);
    setShowScheduled(false);
    const ch = channels.find((c) => c.id === id);
    if (ch && ch.unread > 0) markReadLocal(id, ch.lastMessage?.id || ch.lastReadId);
  }

  async function startDM(userId: number) {
    try {
      const { channel } = await chatApi.openDM(userId);
      upsertChannel(channel);
      setActiveId(channel.id);
      setNewChannel(false);
      setShowMembers(false);
    } catch (e) {
      flash((e as Error).message);
    }
  }

  const dmChannels = channels.filter((c) => c.kind === 'dm');
  const roomChannels = channels.filter((c) => c.kind === 'channel');

  return (
    <div className={`chat ${open ? 'chat-open' : ''}`}>
      {open && (
        <section className="chat-panel" aria-label="Чат команды">
          <header className="chat-head">
            <div className="chat-head-title">
              <MessageSquare size={16} />
              <strong>Чат команды</strong>
              <span className={`chat-conn chat-conn-${conn}`} title={conn === 'open' ? 'Подключено' : conn === 'connecting' ? 'Подключение…' : 'Нет соединения'} />
            </div>
            <div className="chat-head-actions">
              <button
                className={`chat-icon ${showScheduled ? 'on' : ''}`}
                title="Отложенные"
                onClick={() => setShowScheduled((v) => !v)}
              >
                <CalendarClock size={17} />
                {scheduled.length > 0 && <i className="chat-dot">{scheduled.length}</i>}
              </button>
              <button className="chat-icon" title="Закрыть" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
          </header>

          {showScheduled ? (
            <div className="chat-scheduled">
              <div className="chat-sub-head">
                <button className="chat-icon" onClick={() => setShowScheduled(false)} title="Назад">
                  <ChevronLeft size={18} />
                </button>
                <strong>Отложенные сообщения</strong>
              </div>
              {scheduled.length === 0 ? (
                <p className="chat-empty">Нет отложенных сообщений.</p>
              ) : (
                scheduled.map((m) => (
                  <div className="chat-sched-row" key={m.id}>
                    <div>
                      <div className="chat-sched-when">
                        <Clock size={13} /> {new Date(m.sendAt).toLocaleString('ru-RU')}
                      </div>
                      <div className="chat-sched-body">
                        {m.body || (m.attachments.length ? '📎 Вложение' : '')}
                      </div>
                    </div>
                    <button
                      className="chat-icon danger"
                      title="Отменить"
                      onClick={async () => {
                        try {
                          await chatApi.deleteMessage(m.id);
                          setScheduled((prev) => prev.filter((x) => x.id !== m.id));
                        } catch (e) {
                          flash((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : newChannel ? (
            <NewChannel
              users={users}
              myId={myId}
              onCancel={() => setNewChannel(false)}
              onDM={startDM}
              onCreate={async (name, topic, members) => {
                try {
                  const { channel } = await chatApi.createChannel(name, topic, members);
                  upsertChannel(channel);
                  setActiveId(channel.id);
                  setNewChannel(false);
                } catch (e) {
                  flash((e as Error).message);
                }
              }}
            />
          ) : (
            <div className="chat-body">
              <nav className="chat-nav">
                <div className="chat-nav-scroll">
                  <div className="chat-nav-caption">Каналы</div>
                  {roomChannels.map((c) => (
                    <button
                      key={c.id}
                      className={`chat-nav-item ${c.id === activeId ? 'on' : ''}`}
                      onClick={() => openChannel(c.id)}
                    >
                      <Hash size={15} />
                      <span className="chat-nav-name">{c.name}</span>
                      {c.unread > 0 && <i className="chat-badge">{c.unread}</i>}
                    </button>
                  ))}
                  <button className="chat-nav-add" onClick={() => setNewChannel(true)}>
                    <Plus size={15} /> Канал
                  </button>

                  <div className="chat-nav-caption">Личные сообщения</div>
                  {dmChannels.map((c) => {
                    const peer = c.members.find((m) => m.userId !== myId) || c.members[0];
                    const name = peer?.name || 'Диалог';
                    return (
                      <button
                        key={c.id}
                        className={`chat-nav-item ${c.id === activeId ? 'on' : ''}`}
                        onClick={() => openChannel(c.id)}
                        title={name}
                      >
                        <span className={`chat-dot-presence ${online[peer?.userId] ? 'on' : ''}`} />
                        <span className="chat-nav-name">{name}</span>
                        {c.unread > 0 && <i className="chat-badge">{c.unread}</i>}
                      </button>
                    );
                  })}
                  <button className="chat-nav-add" onClick={() => setNewChannel(true)}>
                    <Plus size={15} /> Написать
                  </button>
                </div>
              </nav>

              <div className="chat-main">
                {!active ? (
                  <div className="chat-empty">Выберите канал или начните диалог.</div>
                ) : (
                  <>
                    <div className="chat-conv-head">
                      <div className="chat-conv-title">
                        {active.kind === 'channel' ? <Hash size={15} /> : null}
                        <strong>
                          {active.kind === 'dm'
                            ? active.members.find((m) => m.userId !== myId)?.name || 'Диалог'
                            : active.name}
                        </strong>
                        {active.kind === 'dm' &&
                          (() => {
                            const peer = active.members.find((m) => m.userId !== myId);
                            return (
                              <span
                                className={`chat-dot-presence ${online[peer!.userId] ? 'on' : ''}`}
                                title={online[peer!.userId] ? 'в сети' : 'не в сети'}
                              />
                            );
                          })()}
                      </div>
                      <button className="chat-icon" title="Участники" onClick={() => setShowMembers((v) => !v)}>
                        <Users size={17} />
                      </button>
                    </div>

                    {showMembers && (
                      <MembersPanel
                        channel={active}
                        users={users}
                        myId={myId}
                        super={!!me?.super}
                        online={online}
                        onClose={() => setShowMembers(false)}
                        onUpdated={upsertChannel}
                        onFlash={flash}
                        onDM={startDM}
                      />
                    )}

                    <div className="chat-msgs">
                      {activeMessages.map((m, i) => {
                        const prev = activeMessages[i - 1];
                        const showDay =
                          !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                        const mine = m.userId === myId;
                        return (
                          <React.Fragment key={m.id}>
                            {showDay && <div className="chat-day">{dayLabel(m.createdAt)}</div>}
                            <MessageRow m={m} mine={mine} reads={reads[active!.id]} />
                          </React.Fragment>
                        );
                      })}
                      {typing[active.id] && (
                        <div className="chat-typing">
                          {typing[active.id].name} печатает…
                        </div>
                      )}
                      <div ref={msgsEndRef} />
                    </div>

                    <div className="chat-composer">
                      {attachments.length > 0 && (
                        <div className="chat-atts">
                          {attachments.map((a, i) => (
                            <span className="chat-att-chip" key={i}>
                              {a.kind === 'image' ? <ImageIcon size={13} /> : <FileText size={13} />}
                              <span className="chat-att-name">{a.name}</span>
                              <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}>
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {showSchedule && (
                        <div className="chat-schedule-bar">
                          <Clock size={14} />
                          <input
                            type="datetime-local"
                            value={scheduleAt}
                            min={localNow()}
                            onChange={(e) => setScheduleAt(e.target.value)}
                          />
                          <button className="chat-icon danger" onClick={() => { setShowSchedule(false); setScheduleAt(''); }}>
                            <X size={14} />
                          </button>
                        </div>
                      )}
                      <div className="chat-input-row">
                        <button
                          className="chat-icon"
                          title="Прикрепить файл"
                          disabled={uploading}
                          onClick={() => fileRef.current?.click()}
                        >
                          {uploading ? <Loader2 size={18} className="spin" /> : <Paperclip size={18} />}
                        </button>
                        <input
                          ref={fileRef}
                          type="file"
                          multiple
                          hidden
                          onChange={(e) => onPickFiles(e.target.files)}
                        />
                        <textarea
                          className="chat-input"
                          rows={1}
                          placeholder="Написать сообщение…"
                          value={draft}
                          onChange={(e) => {
                            setDraft(e.target.value);
                            socketRef.current?.send({ type: 'typing', channelId: active.id });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              send();
                            }
                          }}
                        />
                        <button
                          className={`chat-icon ${showSchedule || scheduleAt ? 'on' : ''}`}
                          title="Отложенная отправка"
                          onClick={() => setShowSchedule((v) => !v)}
                        >
                          <Clock size={17} />
                        </button>
                        <button className="chat-send" title="Отправить" onClick={send}>
                          <Send size={17} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {toast && <div className="chat-toast">{toast}</div>}

      <button className="chat-fab" onClick={() => setOpen((v) => !v)} title="Чат команды">
        {open ? <X size={22} /> : <MessageSquare size={22} />}
        {!open && unreadTotal > 0 && <i className="chat-fab-badge">{unreadTotal > 99 ? '99+' : unreadTotal}</i>}
      </button>
    </div>
  );
}

function MessageRow({
  m,
  mine,
  reads,
}: {
  m: Message;
  mine: boolean;
  reads?: Record<number, number>;
}) {
  const readBy = useMemo(() => {
    if (!reads) return m.readBy;
    let count = 0;
    for (const [uid, last] of Object.entries(reads)) {
      if (Number(uid) !== m.userId && last >= m.id) count++;
    }
    return Math.max(count, m.readBy);
  }, [reads, m.readBy, m.userId, m.id]);

  return (
    <div className={`chat-msg ${mine ? 'mine' : ''}`}>
      {!mine && <Avatar name={m.userName} size={30} />}
      <div className="chat-bubble">
        {!mine && <div className="chat-author">{m.userName || 'Пользователь'}</div>}
        {m.body && <div className="chat-text">{m.body}</div>}
        {m.attachments?.length > 0 && (
          <div className="chat-att-list">
            {m.attachments.map((a) =>
              a.kind === 'image' ? (
                <a key={a.id ?? a.url} href={a.url} target="_blank" rel="noreferrer" className="chat-img">
                  <img src={a.url} alt={a.name} />
                </a>
              ) : (
                <a key={a.id ?? a.url} href={a.url} target="_blank" rel="noreferrer" className="chat-file">
                  <FileText size={16} />
                  <span>{a.name}</span>
                  <em>{fileSize(a.size)}</em>
                </a>
              ),
            )}
          </div>
        )}
        <div className="chat-meta">
          <span className="chat-time">{hhmm(m.createdAt)}</span>
          {m.status === 'scheduled' && <span className="chat-tag">отложено</span>}
          {mine && m.pending && <Clock size={12} className="chat-tick" />}
          {mine && m.failed && <span className="chat-failed">не отправлено</span>}
                          {mine && !m.pending && !m.failed && m.status === 'sent' && (
                            readBy > 0 ? (
                              <span title="Прочитано"><CheckCheck size={14} className="chat-tick read" /></span>
                            ) : (
                              <span title="Отправлено"><Check size={14} className="chat-tick" /></span>
                            )
                          )}
        </div>
      </div>
    </div>
  );
}

function MembersPanel({
  channel,
  users,
  myId,
  super: isSuper,
  online,
  onClose,
  onUpdated,
  onFlash,
  onDM,
}: {
  channel: Channel;
  users: Member[];
  myId: number;
  super: boolean;
  online: Record<number, boolean>;
  onClose: () => void;
  onUpdated: (c: Channel) => void;
  onFlash: (s: string) => void;
  onDM: (id: number) => void;
}) {
  const memberIds = new Set(channel.memberIds);
  const candidates = users.filter((u) => !memberIds.has(u.userId) && u.userId !== myId);
  const [pick, setPick] = useState<number[]>([]);

  async function add() {
    if (!pick.length) return;
    try {
      const { channel: ch } = await chatApi.addMembers(channel.id, pick);
      onUpdated(ch);
      setPick([]);
      onFlash('Участники добавлены');
    } catch (e) {
      onFlash((e as Error).message);
    }
  }

  async function remove(uid: number) {
    try {
      const { channel: ch } = await chatApi.removeMember(channel.id, uid);
      onUpdated(ch);
      onClose();
    } catch (e) {
      onFlash((e as Error).message);
    }
  }

  return (
    <div className="chat-members">
      <div className="chat-sub-head">
        <strong>Участники · {channel.members.length}</strong>
        <button className="chat-icon" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="chat-member-list">
        {channel.members.map((m) => (
          <div className="chat-member" key={m.userId}>
            <Avatar name={m.name} url={m.avatar} size={28} />
            <span className="chat-member-name">
              {m.name || 'Пользователь'}
              {m.userId === myId && <em> · вы</em>}
            </span>
            <span className={`chat-dot-presence ${online[m.userId] ? 'on' : ''}`} />
            {channel.kind === 'dm' ? (
              m.userId !== myId && (
                <button className="chat-icon" title="Написать" onClick={() => onDM(m.userId)}>
                  <CornerUpLeft size={15} />
                </button>
              )
            ) : (
              (isSuper || m.userId === myId) && (
                <button className="chat-icon danger" title="Убрать" onClick={() => remove(m.userId)}>
                  <X size={15} />
                </button>
              )
            )}
          </div>
        ))}
      </div>
      {channel.kind === 'channel' && candidates.length > 0 && (
        <div className="chat-member-add">
          <select
            value={pick[0] || ''}
            onChange={(e) => setPick(e.target.value ? [Number(e.target.value)] : [])}
          >
            <option value="">Добавить участника…</option>
            {candidates.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.name || u.email}
              </option>
            ))}
          </select>
          <button className="chat-btn" onClick={add} disabled={!pick.length}>
            Добавить
          </button>
        </div>
      )}
    </div>
  );
}

function NewChannel({
  users,
  myId,
  onCancel,
  onCreate,
  onDM,
}: {
  users: Member[];
  myId: number;
  onCancel: () => void;
  onCreate: (name: string, topic: string, members: number[]) => void;
  onDM: (id: number) => void;
}) {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [q, setQ] = useState('');
  const others = users.filter((u) => u.userId !== myId);
  const filtered = others.filter((u) => (u.name + u.email).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="chat-new">
      <div className="chat-sub-head">
        <button className="chat-icon" onClick={onCancel}>
          <ChevronLeft size={18} />
        </button>
        <strong>Новый канал</strong>
      </div>
      <label className="chat-field">
        Название
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Брони" />
      </label>
      <label className="chat-field">
        Тема
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Необязательно" />
      </label>
      <div className="chat-nav-caption">Участники</div>
      <input className="chat-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск пользователей…" />
      <div className="chat-pick-list">
        {filtered.map((u) => (
          <label className="chat-pick" key={u.userId}>
            <input
              type="checkbox"
              checked={picked.includes(u.userId)}
              onChange={(e) =>
                setPicked((prev) =>
                  e.target.checked ? [...prev, u.userId] : prev.filter((x) => x !== u.userId),
                )
              }
            />
            <Avatar name={u.name || u.email} url={u.avatar} size={26} />
            <span>{u.name || u.email}</span>
            <button
              type="button"
              className="chat-icon"
              title="Личное сообщение"
              onClick={(e) => {
                e.preventDefault();
                onDM(u.userId);
              }}
            >
              <CornerUpLeft size={14} />
            </button>
          </label>
        ))}
      </div>
      <div className="chat-new-actions">
        <button className="chat-btn ghost" onClick={onCancel}>
          Отмена
        </button>
        <button className="chat-btn" disabled={!name.trim()} onClick={() => onCreate(name.trim(), topic.trim(), picked)}>
          Создать канал
        </button>
      </div>
    </div>
  );
}
