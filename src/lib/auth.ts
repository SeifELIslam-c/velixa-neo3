import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';

import { apiFetch } from './api';
import { firebaseAuth } from './firebase';

const googleProvider = new GoogleAuthProvider();

export interface AppUserProfile {
  uid: string;
  email: string | null;
  name: string | null;
  isAdmin: boolean;
  fullName?: string | null;
  phone?: string | null;
}

export const authApi = {
  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(firebaseAuth, callback);
  },

  async signInWithGoogle() {
    return signInWithPopup(firebaseAuth, googleProvider);
  },

  async signInWithEmail(email: string, password: string) {
    return signInWithEmailAndPassword(firebaseAuth, email, password);
  },

  async signUpWithEmail(email: string, password: string) {
    return createUserWithEmailAndPassword(firebaseAuth, email, password);
  },

  async signOut() {
    return signOut(firebaseAuth);
  },

  async getProfile() {
    const response = await apiFetch<{ user: AppUserProfile }>('/auth/me');
    return response.user;
  },
};
