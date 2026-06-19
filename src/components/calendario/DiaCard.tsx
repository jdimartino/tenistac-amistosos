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

export const DiaCard = ({ fecha, reservas, slotsBloqueadosCount, totalSlots, onSolicitar, onCancelar, usuarioUid, cancelandoId }: DiaCardProps) => {
  const getEstado = (): 'disponible' | 'solicitado' | 'reservado' | 'parcial' | 'bloqueado' => {
    if (slotsBloqueadosCount >= totalSlots) return 'bloqueado';
    if (reservas.some(r => r.estado === 'reservado')) return 'reservado';
    if (reservas.some(r => r.estado === 'solicitado')) return 'solicitado';
    if (slotsBloqueadosCount > 0) return 'parcial';
    return 'disponible';
  };

  const estado = getEstado();
  const reservaReservada = reservas.find(r => r.estado === 'reservado');
  const solicitudes = reservas.filter(r => r.estado === 'solicitado');
  const misSolicitudes = solicitudes.filter(r => r.capitanUid === usuarioUid);

  const colores = {
    disponible: 'bg-green-100 border-green-500 hover:bg-green-200',
    solicitado: 'bg-yellow-100 border-yellow-500',
    reservado: 'bg-gray-300 border-gray-500',
    parcial: 'bg-orange-100 border-orange-400 hover:bg-orange-200',
    bloqueado: 'bg-red-100 border-red-500',
  };

  const getTurnoLabel = (turno: string | null) => {
    if (turno === 'maniana') return 'Mañana';
    if (turno === 'tarde') return 'Tarde';
    return 'Cualquiera';
  };

  const [, mes, dia] = fecha.split('-');
  const fechaCorta = `${dia}/${mes}`;

  // Mostrar botón de solicitar si NO está reservado ni completamente bloqueado
  const puedeSolicitar = estado !== 'reservado' && estado !== 'bloqueado';

  return (
    <div className={`rounded-lg border-2 p-4 ${colores[estado as keyof typeof colores]}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-sm font-semibold text-gray-700">{fechaCorta}</div>
          <div className="text-xs text-gray-600 capitalize">{new Date(fecha).toLocaleDateString('es-AR', { weekday: 'short' })}</div>
        </div>
        <div className="text-right">
          {puedeSolicitar && (
            <button
              onClick={onSolicitar}
              className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
            >
              Solicitar
            </button>
          )}
          {misSolicitudes.length > 0 && (
            <button
              onClick={() => onCancelar(misSolicitudes[0].id)}
              disabled={cancelandoId === misSolicitudes[0].id}
              className={`text-xs px-3 py-1 rounded mt-1 ${
                cancelandoId === misSolicitudes[0].id
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-yellow-600 text-white hover:bg-yellow-700'
              }`}
            >
              {cancelandoId === misSolicitudes[0].id ? 'Cancelando...' : 'Cancelar'}
            </button>
          )}
        </div>
      </div>

      {estado === 'reservado' && reservaReservada && (
        <div className="text-xs text-gray-700 space-y-1">
          <div className="font-semibold">Reservado</div>
          <div>Cancha {reservaReservada.cancha}</div>
          <div>{reservaReservada.turno === 'maniana' ? 'Mañana' : 'Tarde'}</div>
          <div className="text-gray-600">
            {reservaReservada.capitanNombre}
            {reservaReservada.capitanEquipo && ` (${reservaReservada.capitanEquipo})`}
          </div>
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
