import { useState } from 'react';
import type { FormEvent } from 'react';
import { useBloqueos } from '../../hooks/useBloqueos';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import type { Turno, Bloqueo } from '../../lib/tipos';
import { formatoFechaCompleto } from '../../lib/fecha';

const TURNOS: { value: Turno | 'ambos'; label: string }[] = [
  { value: 'ambos', label: 'Todos los turnos' },
  { value: 'maniana', label: 'Mañana' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noche', label: 'Noche' },
];

const CANCHAS_OPCIONES = [
  { value: 'todas', label: 'Todas' },
  { value: '1', label: 'Cancha 1' },
  { value: '2', label: 'Cancha 2' },
  { value: '3', label: 'Cancha 3' },
  { value: '4', label: 'Cancha 4' },
  { value: '5', label: 'Cancha 5' },
];

export const BloqueosPanel = () => {
  const { bloqueos, loading, create, remove, update } = useBloqueos();
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [turno, setTurno] = useState<Turno | 'ambos'>('ambos');
  const [cancha, setCancha] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setFechaInicio('');
    setFechaFin('');
    setTurno('ambos');
    setCancha(null);
    setMotivo('');
    setEditingId(null);
  };

  const startEdit = (b: Bloqueo) => {
    setEditingId(b.id);
    setFechaInicio(b.fechaInicio);
    setFechaFin(b.fechaFin);
    setTurno(b.turno);
    setCancha(b.cancha);
    setMotivo(b.motivo);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fechaInicio || !fechaFin) return;
    setSubmitting(true);
    try {
      const data = {
        tipo: (fechaInicio === fechaFin ? (turno === 'ambos' ? 'dia' : 'turno') : 'rango') as 'dia' | 'turno' | 'rango',
        fechaInicio,
        fechaFin,
        turno,
        cancha,
        motivo,
      };
      if (editingId) {
        await update(editingId, data);
      } else {
        await create(data);
      }
      resetForm();
    } catch (err) {
      console.error('Error al guardar bloqueo:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este bloqueo?')) return;
    setDeletingId(id);
    try {
      await remove(id);
    } catch (err) {
      console.error('Error al eliminar bloqueo:', err);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <Spinner className="h-8 w-8 text-green-600" />;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {editingId ? 'Editar bloqueo' : 'Nuevo bloqueo'}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Desde"
            type="date"
            value={fechaInicio}
            onChange={(e) => {
              const value = e.target.value;
              setFechaInicio(value);
              if (!fechaFin || value > fechaFin) setFechaFin(value);
            }}
            required
          />
          <Input
            label="Hasta"
            type="date"
            value={fechaFin}
            min={fechaInicio}
            onChange={(e) => setFechaFin(e.target.value)}
            required
          />
          <Select
            label="Turno"
            value={turno}
            options={TURNOS}
            onChange={(e) => setTurno(e.target.value as Turno | 'ambos')}
          />
          <Select
            label="Cancha"
            value={cancha === null ? 'todas' : String(cancha)}
            options={CANCHAS_OPCIONES}
            onChange={(e) =>
              setCancha(e.target.value === 'todas' ? null : Number(e.target.value))
            }
          />
          <div className="sm:col-span-2">
            <Input
              label="Motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Mantenimiento, torneo, etc."
              required
            />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Guardando...' : (editingId ? 'Guardar cambios' : 'Bloquear')}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      <div className="space-y-3">
        {bloqueos.map((b) => (
          <div
            key={b.id}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
          >
            <div>
              <p className="font-medium text-gray-900">
                {formatoFechaCompleto(b.fechaInicio)} {b.fechaInicio !== b.fechaFin ? `al ${formatoFechaCompleto(b.fechaFin)}` : ''}
              </p>
              <p className="text-sm text-gray-600">
                {b.turno === 'ambos' ? 'Todos los turnos' : b.turno === 'maniana' ? 'Mañana' : b.turno === 'tarde' ? 'Tarde' : 'Noche'}
                {' · '}
                {b.cancha === null ? 'Todas las canchas' : `Cancha ${b.cancha}`}
              </p>
              <p className="text-sm text-gray-500">{b.motivo}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => startEdit(b)}>
                Editar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(b.id)}
                disabled={deletingId === b.id}
              >
                {deletingId === b.id ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
