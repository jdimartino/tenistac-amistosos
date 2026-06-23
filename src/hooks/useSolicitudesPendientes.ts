import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './useAuth';
import type { Reserva } from '../lib/tipos';

export const useSolicitudesPendientes = () => {
  const { usuario } = useAuth();
  const [count, setCount] = useState(0);
  const [solicitudes, setSolicitudes] = useState<Reserva[]>([]);

  useEffect(() => {
    if (!usuario || usuario.role !== 'admin') {
      setCount(0);
      setSolicitudes([]);
      return;
    }

    const q = query(
      collection(db, 'reservas'),
      where('estado', '==', 'solicitado'),
      orderBy('solicitadoEn', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Reserva);
      setCount(snap.size);
      setSolicitudes(data);
    });

    return unsubscribe;
  }, [usuario]);

  return { count, solicitudes };
};
