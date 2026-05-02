'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  nickname: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string | null;
}

// 辅助函数：获取用户显示名称
export function getUserDisplayName(user: User): string {
  // 如果是飞书用户（格式 feishu_{open_id}），显示友好名称
  if (user.nickname.startsWith('feishu_')) {
    return '飞书用户';
  }
  return user.nickname;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (nickname: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const response = await fetch('/api/auth');
      const data = await response.json();
      setUser(data.user);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, []);

  const login = async (nickname: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || '登录失败' };
      }

      setUser(data.user);
      return { success: true };
    } catch {
      return { success: false, error: '登录失败' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
