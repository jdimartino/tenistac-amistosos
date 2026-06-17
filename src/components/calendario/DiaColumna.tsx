import type { SlotInfo } from '../../lib/tipos';
import { nombreDia } from '../../lib/fecha';
import { SlotCancha } from './SlotCancha';

interface DiaColumnaProps {
  fecha: string;
  slots: SlotInfo[];
}

export const DiaColumna = ({ fecha, slots }: DiaColumnaProps) => {
  const [, mes, dia] = fecha.split('-');
  const label = `${nombreDia(fecha)} ${dia}/${mes}`;

  const turnos = ['maniana', 'tarde'] as const;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="mb-3 border-b border-gray-100 pb-2 text-center">
        <span className="text-sm font-semibold text-gray-900">{label}</span>
      </div>
      <div className="space-y-3">
        {turnos.map((turno) => (
          <div key={turno} className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {turno === 'maniana' ? 'Mañana 08:00' : 'Tarde 14:00'}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {slots
                .filter((s) => s.turno === turno)
                .map((slot) => (
                  <SlotCancha key={slot.cancha} slot={slot} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
