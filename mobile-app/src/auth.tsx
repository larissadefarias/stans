import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { api, setToken, type User } from './api';

const KEY = 'stans.session';

// SecureStore não existe no navegador; lá usamos localStorage (só para testes).
const store = {
  get: () => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.getItem(KEY) ?? null) : SecureStore.getItemAsync(KEY)),
  set: (v: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.setItem(KEY, v)) : SecureStore.setItemAsync(KEY, v)),
  del: () => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.removeItem(KEY)) : SecureStore.deleteItemAsync(KEY)),
};

type Session = { token: string; user: User };
type Ctx = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    store.get()
      .then((raw) => {
        if (!raw) return;
        const s: Session = JSON.parse(raw);
        setToken(s.token);
        setUser(s.user);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const start = async (s: Session) => {
    setToken(s.token);
    setUser(s.user);
    await store.set(JSON.stringify(s));
  };

  const value: Ctx = {
    user,
    ready,
    login: async (email, password) => start(await api.login(email, password)),
    register: async (username, email, password) => start(await api.register(username, email, password)),
    logout: async () => {
      setToken(null);
      setUser(null);
      await store.del();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
