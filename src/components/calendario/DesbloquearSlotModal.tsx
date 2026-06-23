import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { SlotInfo, Turno } from '../../lib/tipos';
import { labelTurno } from '../../lib/slot';
import { formatoFechaCompleto } from '../../lib/fecha';

interface DesbloquearSlotModalProps {
  slot: SlotInfo;
  onDesbloquear: (fecha: string, turno: Turno, cancha: number) => Promise<void>;
  onClose: () => void;
}

export const DesbloquearSlotModal = ({ slot, onDesbloquear, onClose }: DesbloquearSlotModalProps) => {
  const [loading, setLoading] = useState(false);

  const handleDesbloquear = async () => {
    setLoading(true);
    try {
      await onDesbloquear(slot.fecha, slot.turno, slot.cancha);
      onClose();
    } catch (err) {
      console.error('Error al desbloquear:', err);
      alert('Error al desbloquear el turno.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Desbloquear turno">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Fecha</span>
            <span className="text-sm font-medium text-gray-900">{formatoFechaCompleto(slot.fecha)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Turno</span>
            <span className="text-sm font-medium text-gray-900">{labelTurno(slot.turno)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Cancha</span>
            <span className="text-sm font-medium text-gray-900">{slot.cancha}</span>
          </div>
          {slot.bloqueo?.motivo && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Motivo</span>
              <span className="text-sm font-medium text-gray-900">{slot.bloqueo.motivo}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            className="flex-1"
            disabled={loading}
            onClick={handleDesbloquear}
          >
            {loading ? 'Desbloqueando...' : 'Desbloquear'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
