import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useReservas } from '../../hooks/useReservas';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import type { SlotInfo, Categoria } from '../../lib/tipos';
import { labelTurno } from '../../lib/slot';

interface SolicitudModalProps {
  slot: SlotInfo;
  open: boolean;
  onClose: () => void;
}

const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'libre', label: 'Libre' },
];

export const SolicitudModal = ({ slot, open, onClose }: SolicitudModalProps) => {
  const { usuario } = useAuth();
  const { enviarSolicitud } = useReservas();
  const [categoria, setCategoria] = useState<Categoria>('libre');
  const [equipoRival, setEquipoRival] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!usuario) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await enviarSolicitud(
        {
          fecha: slot.fecha,
          turno: slot.turno,
          cancha: slot.cancha,
          categoria,
          capitanNombre: usuario.username,
          equipoRival,
          observaciones,
        },
        usuario.uid,
        usuario.displayName
      );
      onClose();
      setCategoria('libre');
      setEquipoRival('');
      setObservaciones('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Solicitar cancha ${slot.cancha} - ${labelTurno(slot.turno)}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Fecha: <span className="font-medium text-gray-900">{slot.fecha}</span>
        </p>
        <Input label="Capitán" value={usuario.username} disabled />
        <Select
          label="Categoría"
          value={categoria}
          options={CATEGORIAS}
          onChange={(e) => setCategoria(e.target.value as Categoria)}
        />
        <Input
          label="Equipo rival"
          value={equipoRival}
          onChange={(e) => setEquipoRival(e.target.value)}
          required
          placeholder="Nombre del equipo"
        />
        <Textarea
          label="Observaciones"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Opcional"
          rows={3}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={submitting}>
            {submitting ? 'Enviando...' : 'Solicitar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
