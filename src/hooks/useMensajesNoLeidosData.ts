import { useEffect, useState } from 'react';
import { mensajesRef } from '../firebase/refs';
import { useAuth } from './useAuth';
import type { Mensaje } from '../lib/tipos';
import {
  query,
  where,
  orderBy,
  onSnapshot,
  type Timestamp,
} from 'firebase/firestore';

const toDate = (value: unknown): Date => {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate();
  }
  if (value instanceof Date) return value;
  return new Date();
};

const normalizarMensaje = (id: string, data: Record<string, unknown>): Mensaje => ({
  id,
  ...(data as unknown as Omit<Mensaje, 'id' | 'createdAt'>),
  threadId: (data.threadId as string) || id,
  createdAt: toDate(data.createdAt),
});

export const useMensajesNoLeidosData = () => {
  const { usuario } = useAuth();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);

  useEffect(() => {
    if (!usuario) {
      setMensajes([]);
      return;
    }
    const esAdmin = usuario.role === 'admin';
    const q = esAdmin
      ? query(
          mensajesRef,
          where('paraUid', 'in', ['admin', usuario.uid]),
          where('leido', '==', false),
          orderBy('createdAt', 'desc')
        )
      : query(
          mensajesRef,
          where('paraUid', '==', usuario.uid),
          where('leido', '==', false),
          orderBy('createdAt', 'desc')
        );
    const unsubscribe = onSnapshot(q, (snap) => {
      setMensajes(snap.docs.map((d) => normalizarMensaje(d.id, d.data())));
    });
    return unsubscribe;
  }, [usuario]);

  return mensajes;
};
