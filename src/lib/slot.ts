import type { Reserva, SlotBloqueado, EstadoSlot, SlotInfo, Turno } from './tipos';

export const slotId = (fecha: string, turno: Turno, cancha: number): string =>
  `${fecha}_${turno}_${cancha}`;

export const horaTurno = (turno: Turno): string =>
  turno === 'maniana' ? '08:00' : turno === 'tarde' ? '14:00' : '20:00';

export const labelTurno = (turno: Turno): string =>
  turno === 'maniana' ? 'Mañana' : turno === 'tarde' ? 'Tarde' : 'Noche';

export const resolverEstadoSlot = (
  reserva: Reserva | undefined,
  bloqueo: SlotBloqueado | undefined
): EstadoSlot => {
  if (reserva?.estado === 'reservado') return 'reservado';
  if (reserva?.estado === 'solicitado') return 'solicitado';
  if (bloqueo) return 'bloqueado';
  return 'disponible';
};

export const construirSlotsDia = (
  fecha: string,
  canchas: number,
  reservas: Reserva[],
  bloqueos: Record<string, SlotBloqueado>
): SlotInfo[] => {
  const turnos: Turno[] = ['maniana', 'tarde', 'noche'];
  const slots: SlotInfo[] = [];

  for (const turno of turnos) {
    for (let cancha = 1; cancha <= canchas; cancha++) {
      const slotBloqueoKey = slotId(fecha, turno, cancha);
      const bloqueo = bloqueos[slotBloqueoKey];
      
      // Buscar reserva asignada a este slot especifico (turno y cancha en array canchas)
      const reserva = reservas.find(
        r => r.fecha === fecha && r.turno === turno && r.canchas?.includes(cancha)
      );

      slots.push({
        fecha,
        turno,
        cancha,
        estado: resolverEstadoSlot(reserva, bloqueo),
        reserva,
        bloqueo,
      });
    }
  }

  return slots;
};

export const getSolicitudesPendientesDia = (fecha: string, reservas: Reserva[]): Reserva[] => {
  return reservas.filter(r => r.fecha === fecha && r.estado === 'solicitado');
};

export const coloresSlot: Record<EstadoSlot, string> = {
  disponible: 'bg-white border-gray-200 hover:bg-gray-50 text-gray-900',
  solicitado: 'bg-yellow-300 border-yellow-400 text-yellow-900 hover:bg-yellow-400',
  reservado: 'bg-green-600 border-green-700 text-white hover:bg-green-700',
  bloqueado: 'bg-gray-300 border-gray-400 text-gray-800 cursor-not-allowed',
};
