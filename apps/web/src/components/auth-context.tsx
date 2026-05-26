'use client';

import { createContext, useContext } from 'react';

export interface CurrentUser {
  id: string;
  email: string;
}

export const AuthContext = createContext<CurrentUser | null>(null);

export function useCurrentUser(): CurrentUser {
  const user = useContext(AuthContext);
  if (!user) {
    throw new Error('useCurrentUser must be used inside an <AuthGuard>');
  }
  return user;
}
