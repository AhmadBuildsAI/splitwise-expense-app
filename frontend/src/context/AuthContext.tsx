import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "../types";
import { meRequest, loginRequest, registerRequest, logoutRequest } from "../api/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    meRequest()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { user, token } = await loginRequest({ email, password });
    localStorage.setItem("token", token);
    setUser(user);
  }

  async function register(username: string, email: string, password: string) {
    const { user, token } = await registerRequest({ username, email, password });
    localStorage.setItem("token", token);
    setUser(user);
  }

  async function logout() {
    await logoutRequest().catch(() => undefined);
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
