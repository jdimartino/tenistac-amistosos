import { useState } from 'react';
import type { FormEvent } from 'react';
import { useBloqueos } from '../../hooks/useBloqueos';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Spinner';
import type { Turno } from '../../lib/tipos';

const TURNOS: { value: Turno | 'ambos'; label: string }[] = [
  { value: 'ambos', label: 'Ambos turnos' },
  { value: 'maniana', label: 'Mañana' },
  { value: 'tarde', label: 'Tarde' },
];

const CANCHAS_OPCIONES = [
  { value: 'todas', label: 'Todas' },
  { value: '1', label: 'Cancha 1' },
  { value: '2', label: 'Cancha 2' },
  { value: '3', label: 'Cancha 3' },
];

export const BloqueosPanel = () => {
  const { bloqueos, loading, create, remove } = useBloqueos();
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [turno, setTurno] = useState<Turno | 'ambos'>('ambos');
  const [cancha, setCancha] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fechaInicio || !fechaFin) return;
    await create({
      tipo: fechaInicio === fechaFin ? (turno === 'ambos' ? 'dia' : 'turno') : 'rango',
      fechaInicio,
      fechaFin,
      turno,
      cancha,
      motivo,
    });
    setFechaInicio('');
    setFechaFin('');
    setTurno('ambos');
    setCancha(null);
    setMotivo('');
  };

  if (loading) return <Spinner className="h-8 w-8 text-green-600" />;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Nuevo bloqueo</h3>
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
        <Button type="submit" className="mt-4">
          Bloquear
        </Button>
      </form>

      <div className="space-y-3">
        {bloqueos.map((b) => (
          <div
            key={b.id}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
          >
            <div>
              <p className="font-medium text-gray-900">
                {b.fechaInicio} {b.fechaInicio !== b.fechaFin ? `al ${b.fechaFin}` : ''}
              </p>
              <p className="text-sm text-gray-600">
                {b.turno === 'ambos' ? 'Ambos turnos' : b.turno === 'maniana' ? 'Mañana' : 'Tarde'}
                {' · '}
                {b.cancha === null ? 'Todas las canchas' : `Cancha ${b.cancha}`}
              </p>
              <p className="text-sm text-gray-500">{b.motivo}</p>
            </div>
            <Button variant="danger" size="sm" onClick={() => remove(b.id)}>
              Eliminar
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
