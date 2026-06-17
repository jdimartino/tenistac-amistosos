import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { bloqueosRef, reservasRef, slotsBloqueadosRef } from '../firebase/refs';
import type { Reserva, Bloqueo, SlotBloqueado } from '../lib/tipos';

export const useCalendario = (fechaInicio: string, fechaFin: string) => {
  const [reservas, setReservas] = useState<Record<string, Reserva>>({});
  const [bloqueos, setBloqueos] = useState<Record<string, SlotBloqueado>>({});
  const [rawBloqueos, setRawBloqueos] = useState<Bloqueo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    const qReservas = query(
      reservasRef,
      where('fecha', '>=', fechaInicio),
      where('fecha', '<=', fechaFin),
      orderBy('fecha', 'asc')
    );

    const qSlots = query(
      slotsBloqueadosRef,
      where('fecha', '>=', fechaInicio),
      where('fecha', '<=', fechaFin)
    );

    const qBloqueos = query(bloqueosRef, orderBy('creadoEn', 'desc'));

    const unsubReservas = onSnapshot(qReservas, (snap) => {
      const map: Record<string, Reserva> = {};
      snap.docs.forEach((d) => {
        const r = { id: d.id, ...d.data() } as Reserva;
        if (r.estado !== 'cancelado') {
          map[r.id] = r;
        }
      });
      setReservas(map);
      setLoading(false);
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    const unsubSlots = onSnapshot(qSlots, (snap) => {
      const map: Record<string, SlotBloqueado> = {};
      snap.docs.forEach((d) => {
        const b = { id: d.id, ...d.data() } as SlotBloqueado;
        map[b.id] = b;
      });
      setBloqueos(map);
    });

    const unsubBloqueos = onSnapshot(qBloqueos, (snap) => {
      setRawBloqueos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bloqueo));
    });

    return () => {
      unsubReservas();
      unsubSlots();
      unsubBloqueos();
    };
  }, [fechaInicio, fechaFin]);

  return useMemo(() => ({
    reservas,
    bloqueos,
    rawBloqueos,
    loading,
    error,
  }), [reservas, bloqueos, rawBloqueos, loading, error]);
};
