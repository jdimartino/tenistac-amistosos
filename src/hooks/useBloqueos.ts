import { useCallback, useEffect, useState } from 'react';
import { onSnapshot, query, orderBy, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { bloqueosRef, slotBloqueadoDoc } from '../firebase/refs';
import { functions } from '../firebase/functions';
import type { Bloqueo, BloqueoInput } from '../lib/tipos';
import { slotId } from '../lib/slot';
import type { Turno } from '../lib/tipos';

const createBloqueoFn = httpsCallable<BloqueoInput, { id: string }>(functions, 'createBloqueo');
const deleteBloqueoFn = httpsCallable<{ id: string }, void>(functions, 'deleteBloqueo');
const updateBloqueoFn = httpsCallable<{ id: string } & BloqueoInput, void>(functions, 'updateBloqueo');

export const useBloqueos = () => {
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(bloqueosRef, orderBy('creadoEn', 'desc'));
    return onSnapshot(q, (snap) => {
      setBloqueos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bloqueo));
      setLoading(false);
    });
  }, []);

  const create = useCallback(async (input: BloqueoInput) => {
    await createBloqueoFn(input);
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteBloqueoFn({ id });
  }, []);

  const update = useCallback(async (id: string, input: BloqueoInput) => {
    await updateBloqueoFn({ id, ...input });
  }, []);

  const desbloquearSlot = useCallback(async (fecha: string, turno: Turno, cancha: number) => {
    const id = slotId(fecha, turno, cancha);
    await deleteDoc(slotBloqueadoDoc(id));
  }, []);

  return { bloqueos, loading, create, remove, update, desbloquearSlot };
};
