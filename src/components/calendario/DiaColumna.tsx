import type { SlotInfo, Reserva, Turno } from '../../lib/tipos';
import { nombreDiaCompleto } from '../../lib/fecha';
import { SlotCancha } from './SlotCancha';

interface DiaColumnaProps {
  fecha: string;
  slots: SlotInfo[];
  pendientes: Reserva[];
  onEditarReserva?: (reserva: Reserva) => void;
  onBloqueoClick?: (slot: SlotInfo) => void;
}

export const DiaColumna = ({ fecha, slots, pendientes, onEditarReserva, onBloqueoClick }: DiaColumnaProps) => {
  const [, mes, dia] = fecha.split('-');
  const label = `${nombreDiaCompleto(fecha)} ${dia}/${mes}`;
  const diaSemana = new Date(`${fecha}T12:00:00`).getDay();
  const headerFinde = diaSemana === 0 ? 'bg-sky-100 rounded-t-2xl -mx-3 -mt-3 px-3 pt-3 pb-2' : diaSemana === 6 ? 'bg-sky-50 rounded-t-2xl -mx-3 -mt-3 px-3 pt-3 pb-2' : '';

  const turnos: Turno[] = ['maniana', 'tarde', 'noche'];

  const getTurnoLabel = (t: string | null) => {
    if (t === 'maniana') return 'Turno Mañana';
    if (t === 'tarde') return 'Turno Tarde';
    if (t === 'noche') return 'Turno Noche';
    return 'Cualquiera';
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className={`mb-3 border-b border-gray-100 pb-2 text-center ${headerFinde}`}>
        <span className="text-sm font-semibold text-gray-900">{label}</span>
      </div>

      {pendientes.length > 0 && (
        <div className="mb-3 rounded-lg bg-yellow-50 border border-yellow-200 p-2">
          <div className="text-xs font-semibold text-yellow-800 mb-1">
            Solicitudes pendientes ({pendientes.length})
          </div>
          {pendientes.map((p) => (
            <div key={p.id} className="text-[10px] text-yellow-700 flex justify-between">
              <span>
                {p.capitanNombre}
                {p.capitanEquipo && ` (${p.capitanEquipo})`}
              </span>
              <span>Pref: {getTurnoLabel(p.turnoPreferencia)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {turnos.map((turno) => (
          <div key={turno} className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {turno === 'maniana' ? 'Turno Mañana 08:00' : turno === 'tarde' ? 'Turno Tarde 14:00' : 'Turno Noche 20:00'}
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {slots
                .filter((s) => s.turno === turno)
                .map((slot) => (
                  <SlotCancha
                    key={slot.cancha}
                    slot={slot}
                    onEditar={slot.reserva && onEditarReserva ? () => onEditarReserva(slot.reserva!) : undefined}
                    onBloqueoClick={slot.estado === 'bloqueado' && onBloqueoClick ? () => onBloqueoClick(slot) : undefined}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
