import { useCallback } from 'react';
import { serverTimestamp, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { reservaDoc } from '../firebase/refs';
import type { ReservaInput, Turno } from '../lib/tipos';

export const useReservas = () => {
  const enviarSolicitud = useCallback(async (
    input: ReservaInput,
    capitanUid: string,
    capitanNombre: string
  ) => {
    // Generar un ID único para la solicitud (sin turno/cancha aún)
    const id = `solicitud_${input.fecha}_${capitanUid}_${Date.now()}`;
    await setDoc(reservaDoc(id), {
      ...input,
      turno: null,
      cancha: null,
      estado: 'solicitado',
      capitanUid,
      capitanNombre,
      solicitadoEn: serverTimestamp(),
      aprobadoEn: null,
      aprobadoPor: null,
    });
  }, []);

  const aprobar = useCallback(async (
    id: string,
    adminUid: string,
    turno: Turno,
    cancha: number
  ) => {
    await updateDoc(reservaDoc(id), {
      estado: 'reservado',
      turno,
      cancha,
      aprobadoEn: serverTimestamp(),
      aprobadoPor: adminUid,
    });
  }, []);

  const cancelar = useCallback(async (id: string) => {
    await deleteDoc(reservaDoc(id));
  }, []);

  return { enviarSolicitud, aprobar, cancelar };
};
