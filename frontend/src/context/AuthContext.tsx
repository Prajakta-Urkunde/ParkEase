import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getCurrentUser } from "../services/api";

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (newToken: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
  const [loading, setLoading] = useState<boolean>(
    Boolean(localStorage.getItem("token"))
  );
  const abortRef = useRef<AbortController | null>(null);

  // Load the user whenever the token changes (on mount, after login)
  useEffect(() => {
    abortRef.current?.abort();

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    getCurrentUser(controller.signal)
      .then((currentUser) => {
        if (!controller.signal.aborted) {
          setUser(currentUser);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          localStorage.removeItem("token");
          localStorage.removeItem("role");
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [token]);

  const login = useCallback((newToken: string) => {
    localStorage.setItem("token", newToken);
    setUser(null);
    setLoading(true);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    abortRef.current?.abort();

    localStorage.removeItem("token");
    localStorage.removeItem("role");

    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}
