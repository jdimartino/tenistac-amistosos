import { useCallback, useEffect, useState } from 'react';
import {
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { mensajesRef, mensajeDoc } from '../firebase/refs';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';
import type { Mensaje, MensajeInput } from '../lib/tipos';

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
  createdAt: toDate(data.createdAt),
});

export const useBandeja = () => {
  const { usuario } = useAuth();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuario) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMensajes([]);
      setLoading(false);
      return;
    }
    const esAdmin = usuario.role === 'admin';
    const q = esAdmin
      ? query(
          mensajesRef,
          where('paraUid', 'in', ['admin', usuario.uid]),
          orderBy('createdAt', 'desc')
        )
      : query(
          mensajesRef,
          where('paraUid', '==', usuario.uid),
          orderBy('createdAt', 'desc')
        );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setMensajes(
          snap.docs.map((d) => normalizarMensaje(d.id, d.data()))
        );
        setLoading(false);
      },
      (err) => {
        console.error('Error cargando bandeja:', err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [usuario]);

  return { mensajes, loading };
};

export const useNoLeidos = () => {
  const { usuario } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!usuario) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCount(0);
      return;
    }
    const esAdmin = usuario.role === 'admin';
    const q = esAdmin
      ? query(
          mensajesRef,
          where('paraUid', 'in', ['admin', usuario.uid]),
          where('leido', '==', false)
        )
      : query(
          mensajesRef,
          where('paraUid', '==', usuario.uid),
          where('leido', '==', false)
        );
    const unsubscribe = onSnapshot(
      q,
      (snap) => setCount(snap.size),
      (err) => {
        console.error('Error cargando no leidos:', err);
      }
    );
    return unsubscribe;
  }, [usuario]);

  return count;
};

export const useMensaje = (id: string | undefined) => {
  const { usuario } = useAuth();
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      mensajeDoc(id),
      (snap) => {
        if (snap.exists()) {
          setMensaje(normalizarMensaje(snap.id, snap.data()));
        } else {
          setMensaje(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error cargando mensaje:', err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [id]);

  useEffect(() => {
    if (mensaje && !mensaje.leido && usuario) {
      const esAdmin = usuario.role === 'admin';
      const propio = mensaje.paraUid === usuario.uid;
      const esBandejaAdmin = esAdmin && mensaje.paraUid === 'admin';
      if (propio || esBandejaAdmin) {
        updateDoc(mensajeDoc(mensaje.id), { leido: true }).catch(() => {});
      }
    }
  }, [mensaje, usuario]);

  return { mensaje, loading };
};

export const useMensajesActions = () => {
  const { usuario } = useAuth();

  const enviar = useCallback(
    async (input: MensajeInput) => {
      if (!usuario) throw new Error('No autenticado');
      await addDoc(mensajesRef, {
        paraUid: input.paraUid,
        deUid: usuario.uid,
        deNombre: usuario.displayName || usuario.username,
        deRol: usuario.role,
        tipo: 'directo',
        categoria: 'comunicacion',
        asunto: input.asunto,
        cuerpo: input.cuerpo,
        leido: false,
        createdAt: serverTimestamp(),
      });
    },
    [usuario]
  );

  const responder = useCallback(
    async (paraUid: string, asunto: string, cuerpo: string) => {
      if (!usuario) throw new Error('No autenticado');
      await addDoc(mensajesRef, {
        paraUid,
        deUid: usuario.uid,
        deNombre: usuario.displayName || usuario.username,
        deRol: usuario.role,
        tipo: 'directo',
        categoria: 'comunicacion',
        asunto,
        cuerpo,
        leido: false,
        createdAt: serverTimestamp(),
      });
    },
    [usuario]
  );

  const marcarLeido = useCallback(async (id: string) => {
    await updateDoc(mensajeDoc(id), { leido: true });
  }, []);

  const marcarTodoLeido = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const batch = writeBatch(db);
      for (const id of ids) {
        batch.update(mensajeDoc(id), { leido: true });
      }
      await batch.commit();
    },
    []
  );

  const borrar = useCallback(async (id: string) => {
    await deleteDoc(mensajeDoc(id));
  }, []);

  return { enviar, responder, marcarLeido, marcarTodoLeido, borrar };
};
