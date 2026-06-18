import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { AuthContext } from './auth';
import type { Usuario } from '../lib/tipos';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setError(null);
      if (user) {
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        if (snap.exists()) {
          setUsuario({ uid: snap.id, ...snap.data() } as Usuario);
        } else {
          setUsuario(null);
          setError('Usuario no registrado en el sistema.');
          await signOut(auth);
        }
        setFirebaseUser(user);
      } else {
        setFirebaseUser(null);
        setUsuario(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (input: string, password: string) => {
    setError(null);
    try {
      // Support both username and full email during transition
      const email = input.includes('@') 
        ? input 
        : `${input.toLowerCase()}@tenistac-amistosos.app`;
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión.');
      throw err;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, usuario, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
