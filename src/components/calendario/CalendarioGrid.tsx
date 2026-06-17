import { useCalendario } from '../../hooks/useCalendario';
import { construirSlotsDia } from '../../lib/slot';
import { sumarDias } from '../../lib/fecha';
import { DiaColumna } from './DiaColumna';
import { Spinner } from '../ui/Spinner';

const CANCHAS = 3;

interface CalendarioGridProps {
  fechaInicio: string;
  fechaFin: string;
}

export const CalendarioGrid = ({ fechaInicio, fechaFin }: CalendarioGridProps) => {
  const { reservas, bloqueos, loading, error } = useCalendario(fechaInicio, fechaFin);

  const dias: string[] = [];
  for (let i = 0; i < 15; i++) {
    dias.push(sumarDias(fechaInicio, i));
  }

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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {dias.map((fecha) => {
        const slots = construirSlotsDia(fecha, CANCHAS, reservas, bloqueos);
        return <DiaColumna key={fecha} fecha={fecha} slots={slots} />;
      })}
    </div>
  );
};
