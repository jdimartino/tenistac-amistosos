import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useReservas } from '../../hooks/useReservas';
import type { Reserva } from '../../lib/tipos';
import { formatoFechaCompleto } from '../../lib/fecha';

interface ReservaInfoModalProps {
  reserva: Reserva;
  onEditar: () => void;
  onClose: () => void;
}

export const ReservaInfoModal = ({ reserva, onEditar, onClose }: ReservaInfoModalProps) => {
  const { usuario } = useAuth();
  const { cancelar } = useReservas();
  const [eliminando, setEliminando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const estadoLabel = reserva.estado === 'reservado' ? 'Reservado' : 'Solicitado';

  const handleEliminar = async () => {
    setEliminando(true);
    try {
      await cancelar(reserva.id);
      onClose();
    } catch (err) {
      console.error('Error al eliminar reserva:', err);
      alert('Error al eliminar la reserva');
    } finally {
      setEliminando(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={`Canchas ${reserva.canchas?.join(', ') || '?'}`}>
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 p-3 text-center">
          <span className="text-sm font-semibold text-gray-900">{formatoFechaCompleto(reserva.fecha)}</span>
          <span className="mx-2 text-gray-400">·</span>
          <span className="text-sm font-medium text-gray-700">
            {reserva.turno === 'maniana' ? 'Turno Mañana' : reserva.turno === 'tarde' ? 'Turno Tarde' : reserva.turno === 'noche' ? 'Turno Noche' : 'Sin turno'}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Estado</span>
            <span className={`text-sm font-medium ${reserva.estado === 'reservado' ? 'text-green-700' : 'text-yellow-700'}`}>
              {estadoLabel}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Canchas</span>
            <span className="text-sm font-medium text-gray-900">{reserva.canchas?.join(', ') || 'Sin asignar'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Capitán</span>
            <span className="text-sm font-medium text-gray-900">{reserva.capitanNombre}</span>
          </div>
          {reserva.capitanEquipo && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Equipo</span>
              <span className="text-sm font-medium text-gray-900">{reserva.capitanEquipo}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Equipo rival</span>
            <span className="text-sm font-medium text-gray-900">{reserva.equipoRival}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Motivo</span>
            <span className="text-sm font-medium text-gray-900">
              {reserva.motivo === 'amistoso' ? 'Amistoso' : reserva.motivo === 'entrenamiento' ? 'Entrenamiento' : reserva.motivo === 'clases' ? 'Clases' : reserva.motivo === 'torneo' ? 'Torneo' : reserva.motivo === 'churuata' ? 'Churuata' : reserva.motivo}
            </span>
          </div>
          {reserva.observaciones && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Observaciones</span>
              <span className="text-sm font-medium text-gray-900">{reserva.observaciones}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="button" className="flex-1" onClick={onEditar}>
            ✏️ Editar reserva
          </Button>
          {usuario?.role === 'admin' && (
            <>
              {confirmar ? (
                <Button
                  type="button"
                  variant="danger"
                  className="flex-1"
                  onClick={handleEliminar}
                  disabled={eliminando}
                >
                  {eliminando ? 'Eliminando...' : 'Confirmar'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  className="flex-1"
                  onClick={() => setConfirmar(true)}
                >
                  🗑️ Eliminar
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
