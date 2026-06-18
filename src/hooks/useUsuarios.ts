import { useCallback, useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '../firebase/config';
import { functions } from '../firebase/functions';
import type { Usuario, UsuarioInput } from '../lib/tipos';

const createUserFn = httpsCallable<(UsuarioInput & { password: string }), void>(functions, 'createUser');
const updateUserFn = httpsCallable<{ uid: string } & Partial<UsuarioInput>, void>(functions, 'updateUser');
const deleteUserFn = httpsCallable<{ uid: string }, void>(functions, 'deleteUser');
const setPasswordFn = httpsCallable<{ uid: string; newPassword: string }, { password: string }>(functions, 'setPassword');

export const useUsuarios = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'usuarios'), where('activo', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as Usuario);
      setUsuarios(list);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const create = useCallback(async (input: UsuarioInput & { password: string }) => {
    await createUserFn(input);
  }, []);

  const update = useCallback(async (uid: string, input: Partial<UsuarioInput>) => {
    await updateUserFn({ uid, ...input });
  }, []);

  const remove = useCallback(async (uid: string) => {
    await deleteUserFn({ uid });
  }, []);

  const setPassword = useCallback(async (uid: string, newPassword: string) => {
    const result = await setPasswordFn({ uid, newPassword });
    return result.data.password;
  }, []);

  return { usuarios, loading, error, create, update, remove, setPassword };
};
