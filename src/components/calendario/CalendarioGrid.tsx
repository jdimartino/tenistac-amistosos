import { useState } from 'react';
import { useCalendario } from '../../hooks/useCalendario';
import { useBloqueos } from '../../hooks/useBloqueos';
import { construirSlotsDia, getSolicitudesPendientesDia } from '../../lib/slot';
import { sumarDias } from '../../lib/fecha';
import { DiaColumna } from './DiaColumna';
import { EditarReservaModal } from './EditarReservaModal';
import { ReservaInfoModal } from './ReservaInfoModal';
import { DesbloquearSlotModal } from './DesbloquearSlotModal';
import { Spinner } from '../ui/Spinner';
import type { Reserva, SlotInfo } from '../../lib/tipos';

const CANCHAS = 5;

interface CalendarioGridProps {
  fechaInicio: string;
  fechaFin: string;
}

export const CalendarioGrid = ({ fechaInicio, fechaFin }: CalendarioGridProps) => {
  const { reservas, bloqueos, loading, error } = useCalendario(fechaInicio, fechaFin);
  const { desbloquearSlot } = useBloqueos();
  const [reservaViendo, setReservaViendo] = useState<Reserva | null>(null);
  const [reservaEditando, setReservaEditando] = useState<Reserva | null>(null);
  const [slotDesbloqueando, setSlotDesbloqueando] = useState<SlotInfo | null>(null);

  const dias: string[] = [];
  for (let i = 0; i < 15; i++) {
    dias.push(sumarDias(fechaInicio, i));
  }

  const handleEditarDesdeInfo = () => {
    if (reservaViendo) {
      setReservaEditando(reservaViendo);
      setReservaViendo(null);
    }
  };

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Spinner className="h-8 w-8 text-green-600" />
      </div>
    );
  }

  if (error) {
    return <p className="py-10 text-center text-red-600">{error}</p>;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {dias.map((fecha) => {
          const slots = construirSlotsDia(fecha, CANCHAS, reservas, bloqueos);
          const pendientes = getSolicitudesPendientesDia(fecha, reservas);
          return (
            <DiaColumna
              key={fecha}
              fecha={fecha}
              slots={slots}
              pendientes={pendientes}
              onEditarReserva={setReservaViendo}
              onBloqueoClick={setSlotDesbloqueando}
            />
          );
        })}
      </div>

      {reservaViendo && (
        <ReservaInfoModal
          reserva={reservaViendo}
          onEditar={handleEditarDesdeInfo}
          onClose={() => setReservaViendo(null)}
        />
      )}

      {reservaEditando && (
        <EditarReservaModal
          reserva={reservaEditando}
          onClose={() => setReservaEditando(null)}
        />
      )}

      {slotDesbloqueando && (
        <DesbloquearSlotModal
          slot={slotDesbloqueando}
          onDesbloquear={desbloquearSlot}
          onClose={() => setSlotDesbloqueando(null)}
        />
      )}
    </>
  );
};
