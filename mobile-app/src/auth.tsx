import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { api, ApiError, setToken, type Me, type User } from './api';

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
  /** Idade e moderação da conta; null enquanto carrega */
  me: Me | null;
  refreshMe: () => Promise<void>;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, birthDate: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  const clear = async () => {
    setToken(null);
    setUser(null);
    setMe(null);
    await store.del();
  };

  // Conta banida ou sessão inválida sai na hora
  const refreshMe = async () => {
    try {
      setMe(await api.me());
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'banned' || e.status === 401)) await clear();
    }
  };

  useEffect(() => {
    store.get()
      .then((raw) => {
        if (!raw) return;
        const s: Session = JSON.parse(raw);
        setToken(s.token);
        setUser(s.user);
        return refreshMe();
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const start = async (s: Session) => {
    setToken(s.token);
    setUser(s.user);
    await store.set(JSON.stringify(s));
    await refreshMe();
  };

  const value: Ctx = {
    user,
    me,
    refreshMe,
    ready,
    login: async (email, password) => start(await api.login(email, password)),
    register: async (username, email, password, birthDate) => start(await api.register(username, email, password, birthDate)),
    logout: clear,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
