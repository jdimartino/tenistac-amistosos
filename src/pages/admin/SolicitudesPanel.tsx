import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { useReservas } from '../../hooks/useReservas';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EditarReservaModal } from '../../components/calendario/EditarReservaModal';
import type { Reserva, Turno } from '../../lib/tipos';
import { formatoFechaCompleto } from '../../lib/fecha';

const TURNOS: { value: Turno; label: string }[] = [
  { value: 'maniana', label: 'Mañana' },
  { value: 'tarde', label: 'Tarde' },
];

const CANCHAS = [1, 2, 3, 4, 5];

export const SolicitudesPanel = () => {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const { usuario } = useAuth();
  const { aprobar, cancelar } = useReservas();
  const [asignaciones, setAsignaciones] = useState<Record<string, { turno: Turno; cancha: number }>>({});
  const [asignandoId, setAsignandoId] = useState<string | null>(null);
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);
  const [reservaEditando, setReservaEditando] = useState<Reserva | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'reservas'),
      where('estado', '==', 'solicitado'),
      orderBy('solicitadoEn', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setReservas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Reserva));
      setLoading(false);
    });
  }, []);

  const handleAsignar = async (reserva: Reserva) => {
    const asignacion = asignaciones[reserva.id];
    if (!asignacion) {
      alert('Selecciona turno y cancha antes de asignar');
      return;
    }
    if (!usuario) return;
    setAsignandoId(reserva.id);
    try {
      await aprobar(reserva.id, usuario.uid, asignacion.turno, asignacion.cancha);
    } catch (err) {
      console.error('Error al asignar:', err);
    } finally {
      setAsignandoId(null);
    }
  };

  const handleRechazar = async (id: string) => {
    setRechazandoId(id);
    try {
      await cancelar(id);
    } catch (err) {
      console.error('Error al rechazar:', err);
    } finally {
      setRechazandoId(null);
    }
  };

  const updateAsignacion = (reservaId: string, field: 'turno' | 'cancha', value: Turno | number) => {
    setAsignaciones(prev => ({
      ...prev,
      [reservaId]: {
        ...prev[reservaId],
        [field]: value,
      },
    }));
  };

  const getTurnoPreferenciaLabel = (turno: string | null | undefined) => {
    if (turno === 'maniana') return 'Mañana';
    if (turno === 'tarde') return 'Tarde';
    return 'Cualquiera';
  };

  if (loading) return <Spinner className="h-8 w-8 text-green-600" />;

  return (
    <div className="space-y-3">
      {reservas.length === 0 && (
        <p className="py-8 text-center text-gray-500">No hay solicitudes pendientes.</p>
      )}
      {reservas.map((r) => (
        <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <Badge color="yellow">Solicitado</Badge>
            <span className="text-xs text-gray-500">
              {formatoFechaCompleto(r.fecha)}
            </span>
          </div>
          <p className="font-medium text-gray-900">{r.capitanNombre}</p>
          <p className="text-sm text-gray-600">
            vs {r.equipoRival} · {r.capitanEquipo}
          </p>
          <p className="text-sm text-blue-600">
            Prefiere: {getTurnoPreferenciaLabel(r.turnoPreferencia)}
          </p>
          {r.observaciones && <p className="mt-1 text-sm text-gray-500">{r.observaciones}</p>}
          
          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              value={asignaciones[r.id]?.turno || ''}
              onChange={(e) => updateAsignacion(r.id, 'turno', e.target.value as Turno)}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">Turno...</option>
              {TURNOS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={asignaciones[r.id]?.cancha || ''}
              onChange={(e) => updateAsignacion(r.id, 'cancha', Number(e.target.value))}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">Cancha...</option>
              {CANCHAS.map(c => (
                <option key={c} value={c}>Cancha {c}</option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => handleAsignar(r)} disabled={asignandoId === r.id}>
              {asignandoId === r.id ? 'Asignando...' : 'Asignar'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setReservaEditando(r)}>
              Editar
            </Button>
            <Button variant="danger" size="sm" onClick={() => handleRechazar(r.id)} disabled={rechazandoId === r.id}>
              {rechazandoId === r.id ? 'Rechazando...' : 'Rechazar'}
            </Button>
          </div>
        </div>
      ))}

      {reservaEditando && (
        <EditarReservaModal
          reserva={reservaEditando}
          onClose={() => setReservaEditando(null)}
        />
      )}
    </div>
  );
};
