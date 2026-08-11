import type { Reserva } from '../../lib/tipos';

interface DiaCardProps {
  fecha: string;
  reservas: Reserva[];
  slotsBloqueadosCount: number;
  totalSlots: number;
  onSolicitar: () => void;
  onCancelar: (reservaId: string) => void;
  usuarioUid: string;
  cancelandoId?: string | null;
}

type Estado = 'disponible' | 'solicitado' | 'reservado' | 'parcial_reservado' | 'parcial' | 'bloqueado';

export const DiaCard = ({ fecha, reservas, slotsBloqueadosCount, totalSlots, onSolicitar, onCancelar, usuarioUid, cancelandoId }: DiaCardProps) => {
  const getEstado = (): Estado => {
    if (slotsBloqueadosCount >= totalSlots) return 'bloqueado';

    const reservadosCount = reservas.filter(r => r.estado === 'reservado').length;
    const solicitadosCount = reservas.filter(r => r.estado === 'solicitado').length;

    if (reservadosCount >= totalSlots) return 'reservado';
    if (reservadosCount > 0) return 'parcial_reservado';
    if (solicitadosCount > 0) return 'solicitado';
    if (slotsBloqueadosCount > 0) return 'parcial';
    return 'disponible';
  };

  const estado = getEstado();
  const reservasReservadas = reservas.filter(r => r.estado === 'reservado');
  const solicitudes = reservas.filter(r => r.estado === 'solicitado');
  const misSolicitudes = solicitudes.filter(r => r.capitanUid === usuarioUid);

  const colores: Record<Estado, string> = {
    disponible: 'bg-green-100 border-green-500 hover:bg-green-200',
    solicitado: 'bg-yellow-100 border-yellow-500',
    reservado: 'bg-gray-300 border-gray-500',
    parcial_reservado: 'bg-gray-200 border-gray-400',
    parcial: 'bg-orange-100 border-orange-400 hover:bg-orange-200',
    bloqueado: 'bg-red-100 border-red-500',
  };

  const getTurnoLabel = (turno: string | null) => {
    if (turno === 'maniana') return 'Turno Mañana';
    if (turno === 'tarde') return 'Turno Tarde';
    if (turno === 'noche') return 'Turno Noche';
    return 'Cualquiera';
  };

  const [, mes, dia] = fecha.split('-');
  const fechaCorta = `${dia}/${mes}`;
  const diaCompleto = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long' });
  const diaSemana = new Date(`${fecha}T12:00:00`).getDay();
  const headerFinde = diaSemana === 0 ? 'bg-sky-100 rounded-t-md -mx-3 -mt-3 px-3 pt-3 pb-1' : diaSemana === 6 ? 'bg-sky-50 rounded-t-md -mx-3 -mt-3 px-3 pt-3 pb-1' : '';

  const puedeSolicitar = estado !== 'reservado' && estado !== 'bloqueado';

  return (
    <div className={`rounded-lg border-2 p-3 ${colores[estado]}`}>
      <div className={`mb-2 ${headerFinde}`}>
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm font-semibold text-gray-700 capitalize">{diaCompleto}</div>
            <div className="text-xs text-gray-600">{fechaCorta}</div>
          </div>
          <div className="text-right">
            {puedeSolicitar && (
              <button
                onClick={onSolicitar}
                aria-label={`Solicitar día ${fechaCorta}`}
                className="text-xs bg-green-600 text-white px-3 py-2 rounded min-h-[44px] min-w-[44px] hover:bg-green-700 active:bg-green-800"
              >
                Solicitar
              </button>
            )}
            {misSolicitudes.length > 0 && (
              <button
                onClick={() => onCancelar(misSolicitudes[0].id)}
                disabled={cancelandoId === misSolicitudes[0].id}
                aria-label={`Cancelar solicitud del ${fechaCorta}`}
                className={`text-xs px-3 py-2 rounded mt-1 min-h-[44px] min-w-[44px] ${
                  cancelandoId === misSolicitudes[0].id
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-yellow-600 text-white hover:bg-yellow-700 active:bg-yellow-800'
                }`}
              >
                {cancelandoId === misSolicitudes[0].id ? 'Cancelando...' : 'Cancelar'}
              </button>
            )}
          </div>
        </div>
      </div>

      {estado === 'reservado' && reservasReservadas.length > 0 && (
        <div className="text-xs text-gray-700 space-y-1">
          <div className="font-semibold">Reservado</div>
          {reservasReservadas.map((r) => (
            <div key={r.id}>
              <div>Canchas {r.canchas?.join(', ') || '?'} - {r.turno === 'maniana' ? 'Turno Mañana' : r.turno === 'tarde' ? 'Turno Tarde' : 'Turno Noche'}</div>
              <div className="text-gray-600 font-medium">{r.capitanNombre}</div>
              {r.capitanEquipo && <div className="text-gray-500">({r.capitanEquipo})</div>}
            </div>
          ))}
        </div>
      )}

      {estado === 'parcial_reservado' && (
        <div className="text-xs text-gray-700 space-y-1">
          <div className="font-semibold">Parcialmente reservado</div>
          {reservasReservadas.map((r) => (
            <div key={r.id}>
              <div>Canchas {r.canchas?.join(', ') || '?'} - {r.turno === 'maniana' ? 'Turno Mañana' : r.turno === 'tarde' ? 'Turno Tarde' : 'Turno Noche'} - {r.capitanNombre}</div>
              {r.capitanEquipo && <div className="text-gray-500">({r.capitanEquipo})</div>}
            </div>
          ))}
        </div>
      )}

      {estado === 'solicitado' && (
        <div className="text-xs text-gray-700 space-y-1">
          <div className="font-semibold">
            Solicitado {solicitudes.length > 1 && `(${solicitudes.length})`}
          </div>
          {solicitudes.map((solicitud) => (
            <div key={solicitud.id} className="text-gray-600">
              <div>
                {solicitud.capitanNombre}
                {solicitud.capitanEquipo && (
                  <span className="text-[10px] text-gray-500"> ({solicitud.capitanEquipo})</span>
                )}
              </div>
              <div className="text-[10px] text-gray-500">
                Pref: {getTurnoLabel(solicitud.turnoPreferencia)}
              </div>
            </div>
          ))}
        </div>
      )}

      {estado === 'parcial' && (
        <div className="text-xs text-orange-700">
          <div className="font-semibold">Parcialmente disponible</div>
        </div>
      )}

      {estado === 'bloqueado' && (
        <div className="text-xs text-red-700 font-semibold">
          No disponible
        </div>
      )}
    </div>
  );
};
