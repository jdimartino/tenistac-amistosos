import { useState } from 'react';
import type { Motivo, Reserva, Turno } from '../../lib/tipos';
import { useReservas } from '../../hooks/useReservas';
import { useUsuarios } from '../../hooks/useUsuarios';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';

interface EditarReservaModalProps {
  reserva: Reserva;
  onClose: () => void;
}

const TURNOS: { value: Turno; label: string }[] = [
  { value: 'maniana', label: 'Mañana' },
  { value: 'tarde', label: 'Tarde' },
];

const MOTIVOS_OPCIONES = [
  { value: 'amistoso', label: 'Amistoso' },
  { value: 'entrenamiento', label: 'Entrenamiento' },
  { value: 'clases', label: 'Clases' },
  { value: 'torneo', label: 'Torneo' },
];

const CANCHAS = [1, 2, 3, 4, 5];

export const EditarReservaModal = ({ reserva, onClose }: EditarReservaModalProps) => {
  const { editarReserva } = useReservas();
  const { usuarios } = useUsuarios();
  const [fecha, setFecha] = useState(reserva.fecha);
  const [turno, setTurno] = useState<Turno | ''>(reserva.turno || '');
  const [canchas, setCanchas] = useState<number[]>(reserva.canchas || []);
  const [capitanEquipo, setCapitanEquipo] = useState(reserva.capitanEquipo || '');
  const [capitanNombre, setCapitanNombre] = useState(reserva.capitanNombre);
  const [motivo, setMotivo] = useState<Motivo>(reserva.motivo || 'amistoso');
  const [equipoRival, setEquipoRival] = useState(reserva.equipoRival);
  const [observaciones, setObservaciones] = useState(reserva.observaciones || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await editarReserva(reserva.id, {
        fecha,
        turno: turno || null,
        canchas,
        capitanEquipo,
        capitanNombre,
        equipoRival,
        motivo,
        observaciones,
      });
      onClose();
    } catch (err) {
      console.error('Error al editar reserva:', err);
      alert('Error al guardar los cambios');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Editar reserva">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Fecha"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Turno"
            value={turno}
            onChange={(e) => setTurno(e.target.value as Turno)}
            options={[
              { value: '', label: 'Sin asignar' },
              ...TURNOS,
            ]}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Canchas</label>
            <div className="flex flex-wrap gap-2">
              {CANCHAS.map(c => (
                <label key={c} className={`flex items-center gap-1 rounded-xl border px-3 py-2 text-sm cursor-pointer min-h-[44px] ${
                  canchas.includes(c) ? 'bg-green-100 border-green-500 text-green-800' : 'border-gray-300 hover:bg-gray-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={canchas.includes(c)}
                    onChange={() => {
                      setCanchas(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
                    }}
                    className="rounded"
                  />
                  C{c}
                </label>
              ))}
            </div>
          </div>
        </div>

        <Input
          label="Equipo"
          value={capitanEquipo}
          onChange={(e) => setCapitanEquipo(e.target.value)}
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Capitán</label>
          {usuarios.length > 0 ? (
            <Select
              value={capitanNombre}
              onChange={(e) => setCapitanNombre(e.target.value)}
              options={usuarios
                .filter(u => u.role === 'capitan' || u.role === 'subcapitan')
                .map(u => ({
                  value: u.username,
                  label: `${u.username} (${u.displayName || u.username})`,
                }))}
            />
          ) : (
            <Input
              value={capitanNombre}
              onChange={(e) => setCapitanNombre(e.target.value)}
            />
          )}
        </div>

        <Select
          label="Motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as Motivo)}
          options={MOTIVOS_OPCIONES}
        />

        <Input
          label="Equipo rival"
          value={equipoRival}
          onChange={(e) => setEquipoRival(e.target.value)}
          required
        />

        <Textarea
          label="Observaciones"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={2}
        />

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
