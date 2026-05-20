import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  getCurrentUser,
  getAccessToken,
} from '../services/auth';
import type { CurrentUser } from '../types/api';

interface AuthContextType {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginAction: (email: string, password: string) => Promise<void>;
  registerAction: (email: string, password: string) => Promise<void>;
  logoutAction: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check for existing token and validate
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      getCurrentUser()
        .then((userData) => {
          setUser(userData);
        })
        .catch(() => {
          // Token expired or invalid
          apiLogout();
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const loginAction = async (email: string, password: string) => {
    await apiLogin(email, password);
    const userData = await getCurrentUser();
    setUser(userData);
  };

  const registerAction = async (email: string, password: string) => {
    await apiRegister(email, password);
    const userData = await getCurrentUser();
    setUser(userData);
  };

  const logoutAction = () => {
    apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginAction,
        registerAction,
        logoutAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
