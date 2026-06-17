import { createContext } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import type { Usuario } from '../lib/tipos';

export interface AuthState {
  firebaseUser: FirebaseUser | null;
  usuario: Usuario | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | undefined>(undefined);
