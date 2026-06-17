import { useCallback } from 'react';
import { serverTimestamp, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { reservaDoc } from '../firebase/refs';
import { slotId } from '../lib/slot';
import type { ReservaInput } from '../lib/tipos';

export const useReservas = () => {
  const enviarSolicitud = useCallback(async (
    input: ReservaInput,
    capitanUid: string,
    capitanNombre: string
  ) => {
    const id = slotId(input.fecha, input.turno, input.cancha);
    await setDoc(reservaDoc(id), {
      ...input,
      estado: 'solicitado',
      capitanUid,
      capitanNombre,
      solicitadoEn: serverTimestamp(),
      aprobadoEn: null,
      aprobadoPor: null,
    });
  }, []);

  const aprobar = useCallback(async (id: string, adminUid: string) => {
    await updateDoc(reservaDoc(id), {
      estado: 'reservado',
      aprobadoEn: serverTimestamp(),
      aprobadoPor: adminUid,
    });
  }, []);

  const cancelar = useCallback(async (id: string) => {
    await deleteDoc(reservaDoc(id));
  }, []);

  return { enviarSolicitud, aprobar, cancelar };
};
