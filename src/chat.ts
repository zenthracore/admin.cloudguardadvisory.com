// Team chat client: types, REST helpers and the WebSocket transport.

export type Actor = { id: number; name: string; email: string; super: boolean };

export type Member = {
  userId: number;
  name: string;
  email: string;
  avatar: string;
  online: boolean;
};

export type Attachment = {
  id?: number;
  messageId?: number;
  name: string;
  url: string;
  mime: string;
  size: number;
  kind: 'image' | 'file';
};

export type Message = {
  id: number;
  channelId: number;
  userId: number;
  userName: string;
  userEmail: string;
  body: string;
  kind: string;
  status: 'sent' | 'scheduled' | 'cancelled';
  sendAt: string;
  createdAt: string;
  editedAt?: string;
  attachments: Attachment[];
  readBy: number;
  read: boolean;
  clientId?: string;
  pending?: boolean;
  failed?: boolean;
};

export type Channel = {
  id: number;
  kind: 'channel' | 'dm';
  name: string;
  topic: string;
  isDefault: boolean;
  members: Member[];
  memberIds: number[];
  unread: number;
  lastReadId: number;
  lastMessage?: Message;
  lastAt: string;
};

export type Bootstrap = {
  me: Actor;
  channels: Channel[];
  users: Member[];
  online: Record<string, boolean>;
  unread: number;
  scheduled: Message[];
};

export type ChatEvent =
  | { type: 'message'; channelId: number; message: Message; scheduled?: boolean }
  | { type: 'read'; channelId: number; userId: number; lastId: number }
  | { type: 'typing'; channelId: number; userId: number; name: string }
  | { type: 'presence'; userId: number; online: boolean }
  | { type: 'deleted'; channelId: number; messageId: number }
  | { type: 'error'; error: string }
  | { type: 'pong' };

const base = '/api/admin/chat';

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(base + path, {
    credentials: 'same-origin',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.error === 'string' ? data.error : `Ошибка (${res.status})`);
  }
  return res.status === 204 ? (null as T) : res.json();
}

export const chatApi = {
  bootstrap: () => req<Bootstrap>('/bootstrap'),
  messages: (channelId: number, before = 0, limit = 50) =>
    req<{ messages: Message[]; channel: Channel }>(
      `/channels/${channelId}/messages?before=${before}&limit=${limit}`,
    ),
  createChannel: (name: string, topic: string, members: number[]) =>
    req<{ channel: Channel }>('/channels', {
      method: 'POST',
      body: JSON.stringify({ name, topic, members }),
    }),
  openDM: (userId: number) =>
    req<{ channel: Channel }>('/dm', { method: 'POST', body: JSON.stringify({ userId }) }),
  addMembers: (channelId: number, members: number[]) =>
    req<{ channel: Channel }>(`/channels/${channelId}/members`, {
      method: 'POST',
      body: JSON.stringify({ members }),
    }),
  removeMember: (channelId: number, userId: number) =>
    req<{ channel: Channel }>(`/channels/${channelId}/members/${userId}`, { method: 'DELETE' }),
  markRead: (channelId: number, lastId: number) =>
    req<{ status: string }>(`/channels/${channelId}/read`, {
      method: 'POST',
      body: JSON.stringify({ lastId }),
    }),
  scheduled: () => req<{ messages: Message[] }>('/scheduled'),
  deleteMessage: (id: number) =>
    req<{ status: string }>(`/messages/${id}`, { method: 'DELETE' }),
  upload: async (file: File): Promise<Attachment> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${base}/uploads`, {
      method: 'POST',
      credentials: 'same-origin',
      body: form,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data.error === 'string' ? data.error : 'Не удалось загрузить файл');
    }
    return res.json();
  },
};

// ChatSocket is a reconnecting WebSocket wrapper with a small typed surface.
export class ChatSocket {
  private ws: WebSocket | null = null;
  private closed = false;
  private retry = 0;
  private timer: number | null = null;

  constructor(
    private onEvent: (e: ChatEvent) => void,
    private onState: (state: 'connecting' | 'open' | 'closed') => void,
  ) {}

  connect() {
    this.closed = false;
    this.open();
  }

  private open() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.onState('connecting');
    const ws = new WebSocket(`${proto}://${location.host}${base}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.onState('open');
    };
    ws.onmessage = (ev) => {
      try {
        this.onEvent(JSON.parse(ev.data) as ChatEvent);
      } catch {
        /* ignore malformed frame */
      }
    };
    ws.onclose = () => {
      this.onState('closed');
      if (!this.closed) this.schedule();
    };
    ws.onerror = () => ws.close();
  }

  private schedule() {
    const delay = Math.min(1000 * 2 ** this.retry, 15000);
    this.retry += 1;
    this.timer = window.setTimeout(() => this.open(), delay);
  }

  send(payload: Record<string, unknown>): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  close() {
    this.closed = true;
    if (this.timer) window.clearTimeout(this.timer);
    this.ws?.close();
    this.ws = null;
  }
}

export const AVATAR_COLORS = [
  '#e0653a',
  '#3a7be0',
  '#2ca58d',
  '#8b5cf6',
  '#d946a6',
  '#0ea5e9',
  '#f59e0b',
  '#10b981',
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export const initial = (value: string) => (value[0] || '?').toUpperCase();
