'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { getFirebaseClient, isDevMockMode } from '@/lib/firebase/client';

export interface ForgeUser {
  uid: string;
  email: string;
  displayName: string;
  isMockUser: boolean;
}

interface AuthContextValue {
  user: ForgeUser | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInAsDevOperator: (customEmail?: string, customName?: string) => void;
  signOut: () => Promise<void>;
}

const DEFAULT_DEV_USER: ForgeUser = {
  uid: 'dev-operator-01',
  email: 'operator@axisforge.no',
  displayName: 'Kristoffer (Forge Operator)',
  isMockUser: true,
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ForgeUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isDevMockMode()) {
      const savedRaw = window.localStorage.getItem('axisforge_dev_user');
      if (savedRaw) {
        try {
          setUser(JSON.parse(savedRaw) as ForgeUser);
        } catch {
          setUser(DEFAULT_DEV_USER);
        }
      } else {
        setUser(DEFAULT_DEV_USER);
      }
      setLoading(false);
      return;
    }

    try {
      const { auth } = getFirebaseClient();
      const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
        if (fbUser) {
          setUser({
            uid: fbUser.uid,
            email: fbUser.email || 'user@axisforge.no',
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Operatør',
            isMockUser: false,
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } catch {
      setUser(DEFAULT_DEV_USER);
      setLoading(false);
    }
  }, []);

  const openAuthModal = () => setIsAuthModalOpen(true);
  const closeAuthModal = () => setIsAuthModalOpen(false);

  const signInAsDevOperator = (customEmail?: string, customName?: string) => {
    const devUser: ForgeUser = {
      uid: 'dev-operator-01',
      email: customEmail || DEFAULT_DEV_USER.email,
      displayName: customName || DEFAULT_DEV_USER.displayName,
      isMockUser: true,
    };
    window.localStorage.setItem('axisforge_dev_user', JSON.stringify(devUser));
    setUser(devUser);
    setIsAuthModalOpen(false);
  };

  const signInWithGoogle = async () => {
    if (isDevMockMode()) {
      signInAsDevOperator('google.operator@axisforge.no', 'Google Forge Operator');
      return;
    }
    const { auth, googleProvider } = getFirebaseClient();
    await signInWithPopup(auth, googleProvider);
    setIsAuthModalOpen(false);
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (isDevMockMode()) {
      signInAsDevOperator(email, email.split('@')[0] || 'Forge Operator');
      return;
    }
    const { auth } = getFirebaseClient();
    await signInWithEmailAndPassword(auth, email, password);
    setIsAuthModalOpen(false);
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    if (isDevMockMode()) {
      signInAsDevOperator(email, displayName);
      return;
    }
    const { auth } = getFirebaseClient();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    setIsAuthModalOpen(false);
  };

  const signOut = async () => {
    if (isDevMockMode()) {
      window.localStorage.removeItem('axisforge_dev_user');
      setUser(null);
      return;
    }
    const { auth } = getFirebaseClient();
    await firebaseSignOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signInAsDevOperator,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth må brukes innenfor en AuthProvider');
  }
  return ctx;
}
