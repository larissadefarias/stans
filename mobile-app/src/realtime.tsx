import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { Socket } from 'socket.io-client';
import { api, connectSocket, type Message } from './api';
import { useAuth } from './auth';

type Ctx = {
  socket: Socket | null;
  unreadNotifications: number;
  unreadMessages: number;
  refreshCounts: () => void;
  clearNotifications: () => void;
  /** A tela de chat avisa qual sala está aberta, para não contar como "não lida" */
  setActiveRoom: (roomId: string | null) => void;
};

const RealtimeContext = createContext<Ctx | null>(null);

/** Uma conexão Socket.IO para o app todo (chat + notificações) e os contadores dos selos. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const activeRoom = useRef<string | null>(null);

  const refreshCounts = useCallback(() => {
    if (!user) return;
    api.unreadCount().then((r) => setUnreadNotifications(r.count)).catch(() => {});
    api.rooms().then((rooms) => setUnreadMessages(rooms.reduce((n, r) => n + (r.id === activeRoom.current ? 0 : r.unread), 0))).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) { setSocket(null); setUnreadNotifications(0); setUnreadMessages(0); return; }
    const s = connectSocket();
    s.on('notification:new', () => setUnreadNotifications((n) => n + 1));
    s.on('message:new', (m: Message) => {
      if (m.senderUsername !== user.username && m.roomId !== activeRoom.current) setUnreadMessages((n) => n + 1);
    });
    s.on('connect', refreshCounts); // também cobre reconexões
    setSocket(s);
    // Ao voltar para o app, confere os números de novo
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refreshCounts(); });
    return () => { sub.remove(); s.disconnect(); };
  }, [user, refreshCounts]);

  // Funções estáveis (useCallback) para não disparar recargas nas telas que dependem delas
  const clearNotifications = useCallback(() => setUnreadNotifications(0), []);
  const setActiveRoom = useCallback((id: string | null) => { activeRoom.current = id; }, []);

  const value: Ctx = { socket, unreadNotifications, unreadMessages, refreshCounts, clearNotifications, setActiveRoom };
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const c = useContext(RealtimeContext);
  if (!c) throw new Error('useRealtime fora do RealtimeProvider');
  return c;
}
