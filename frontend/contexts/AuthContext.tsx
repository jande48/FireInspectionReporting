import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { router } from 'expo-router';
import { apiService, AuthResponse } from '@/lib/api';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: number;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  address?: string | null;
  website?: string | null;
  profile_photo_key?: string | null;
  avatar_url?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string; errors?: Record<string, string[]> }>;
  register: (userData: {
    email: string;
    username: string;
    password: string;
    password2: string;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
  }) => Promise<{ success: boolean; message: string; errors?: Record<string, string[]> }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth check timeout')), 10000)
      );
      
      const response = await Promise.race([
        apiService.getProfile(),
        timeoutPromise,
      ]) as any;
      
      if (response.success && response.data?.user) {
        setUser(response.data.user);
      } else {
        setUser(null);
        await apiService.clearTokens();
      }
    } catch (error) {
      console.log('[Auth] Auth check failed:', error);
      setUser(null);
      await apiService.clearTokens();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiService.login({ email, password });
      if (response.success && response.data?.user) {
        setUser(response.data.user);
        router.replace('/(app)/home');
        return { success: true, message: response.message };
      } else {
        return {
          success: false,
          message: response.message || 'Login failed',
          errors: response.errors,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'An unexpected error occurred',
        errors: { general: ['Login failed'] },
      };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: {
    email: string;
    username: string;
    password: string;
    password2: string;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
  }) => {
    setIsLoading(true);
    try {
      const response = await apiService.register(userData);
      if (response.success && response.data?.user) {
        setUser(response.data.user);
        router.replace('/(app)/home');
        return { success: true, message: response.message };
      } else {
        return {
          success: false,
          message: response.message || 'Registration failed',
          errors: response.errors,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'An unexpected error occurred',
        errors: { general: ['Registration failed'] },
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      if (refreshToken) {
        await apiService.logout(refreshToken);
      } else {
        // If no refresh token, just clear local state
        await apiService.clearTokens();
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Clear tokens even if logout API call fails
      await apiService.clearTokens();
    } finally {
      setUser(null);
      setIsLoading(false);
      router.replace('/(auth)/login');
    }
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
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
