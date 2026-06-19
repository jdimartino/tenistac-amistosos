import { useState } from 'react';
import type { Reserva, Turno } from '../../lib/tipos';
import { useReservas } from '../../hooks/useReservas';
import { useUsuarios } from '../../hooks/useUsuarios';

interface EditarReservaModalProps {
  reserva: Reserva;
  onClose: () => void;
}

const TURNOS: { value: Turno; label: string }[] = [
  { value: 'maniana', label: 'Mañana' },
  { value: 'tarde', label: 'Tarde' },
];

const CANCHAS = [1, 2, 3, 4, 5];

export const EditarReservaModal = ({ reserva, onClose }: EditarReservaModalProps) => {
  const { editarReserva } = useReservas();
  const { usuarios } = useUsuarios();
  const [fecha, setFecha] = useState(reserva.fecha);
  const [turno, setTurno] = useState<Turno | ''>(reserva.turno || '');
  const [cancha, setCancha] = useState<number | ''>(reserva.cancha || '');
  const [capitanEquipo, setCapitanEquipo] = useState(reserva.capitanEquipo || '');
  const [capitanNombre, setCapitanNombre] = useState(reserva.capitanNombre);
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
        cancha: cancha || null,
        capitanEquipo,
        capitanNombre,
        equipoRival,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Editar reserva</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Turno</label>
              <select
                value={turno}
                onChange={(e) => setTurno(e.target.value as Turno)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Sin asignar</option>
                {TURNOS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cancha</label>
              <select
                value={cancha}
                onChange={(e) => setCancha(e.target.value ? Number(e.target.value) : '')}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Sin asignar</option>
                {CANCHAS.map(c => (
                  <option key={c} value={c}>Cancha {c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Equipo</label>
            <input
              type="text"
              value={capitanEquipo}
              onChange={(e) => setCapitanEquipo(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Capitán</label>
            {usuarios.length > 0 ? (
              <select
                value={capitanNombre}
                onChange={(e) => setCapitanNombre(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                {usuarios.filter(u => u.role === 'capitan' || u.role === 'subcapitan').map(u => (
                  <option key={u.uid} value={u.username}>{u.username} ({u.displayName || u.username})</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={capitanNombre}
                onChange={(e) => setCapitanNombre(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Equipo rival</label>
            <input
              type="text"
              value={equipoRival}
              onChange={(e) => setEquipoRival(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
