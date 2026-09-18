import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '../../firebase/config';
import { functions } from '../../firebase/functions';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EditarReservaModal } from '../../components/calendario/EditarReservaModal';
import type { Reserva, Turno } from '../../lib/tipos';
import { formatoFechaCompleto, formatFechaVenezuela } from '../../lib/fecha';

const TURNOS: { value: Turno; label: string }[] = [
  { value: 'maniana', label: 'Mañana' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noche', label: 'Noche' },
];

const CANCHAS = [1, 2, 3, 4, 5];

export const SolicitudesPanel = () => {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [asignaciones, setAsignaciones] = useState<Record<string, { turno: Turno; canchas: number[]; solicitaChuruata: boolean }>>({});
  const [asignandoId, setAsignandoId] = useState<string | null>(null);
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);
  const [reservaEditando, setReservaEditando] = useState<Reserva | null>(null);
  const [reservaRechazando, setReservaRechazando] = useState<Reserva | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

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
    if (!asignacion || !asignacion.turno) {
      alert('Selecciona un turno antes de asignar');
      return;
    }
    if (asignacion.canchas.length === 0 && !asignacion.solicitaChuruata) {
      alert('Selecciona al menos una cancha o marca Churuata antes de asignar');
      return;
    }
    setAsignandoId(reserva.id);
    try {
      const aprobarFn = httpsCallable(functions, 'aprobarReserva');
      await aprobarFn({
        reservaId: reserva.id,
        turno: asignacion.turno,
        canchas: asignacion.canchas,
        solicitaChuruata: asignacion.solicitaChuruata || false,
      });
      alert('Solicitud asignada correctamente');
    } catch (err) {
      console.error('Error al asignar:', err);
      const msg = err instanceof Error ? err.message : 'Error al asignar la solicitud';
      alert(msg);
    } finally {
      setAsignandoId(null);
    }
  };

  const handleRechazar = async () => {
    if (!reservaRechazando || !motivoRechazo.trim()) return;
    setRechazandoId(reservaRechazando.id);
    try {
      const rechazarFn = httpsCallable(functions, 'rechazarReserva');
      await rechazarFn({ reservaId: reservaRechazando.id, motivo: motivoRechazo.trim() });
      setReservaRechazando(null);
      setMotivoRechazo('');
    } catch (err) {
      console.error('Error al rechazar:', err);
      alert('Error al rechazar la solicitud');
    } finally {
      setRechazandoId(null);
    }
  };

  const handleEliminar = async (r: Reserva) => {
    if (!confirm(`¿Eliminar la solicitud de ${r.capitanNombre} (${r.fecha}) sin notificar?`)) return;
    setEliminandoId(r.id);
    try {
      const eliminarFn = httpsCallable(functions, 'eliminarSolicitud');
      await eliminarFn({ reservaId: r.id });
    } catch (err) {
      console.error('Error al eliminar:', err);
      alert(err instanceof Error ? err.message : 'Error al eliminar la solicitud');
    } finally {
      setEliminandoId(null);
    }
  };

  const updateAsignacionTurno = (reservaId: string, turno: Turno) => {
    setAsignaciones(prev => ({
      ...prev,
      [reservaId]: {
        ...prev[reservaId],
        turno,
        canchas: prev[reservaId]?.canchas || [],
      },
    }));
  };

  const toggleCancha = (reservaId: string, cancha: number) => {
    setAsignaciones(prev => {
      const current = prev[reservaId]?.canchas || [];
      const newCanchas = current.includes(cancha)
        ? current.filter(c => c !== cancha)
        : [...current, cancha];
      return {
        ...prev,
        [reservaId]: {
          ...prev[reservaId],
          turno: prev[reservaId]?.turno || 'maniana',
          canchas: newCanchas,
          solicitaChuruata: prev[reservaId]?.solicitaChuruata || false,
        },
      };
    });
  };

  const toggleChuruata = (reservaId: string) => {
    setAsignaciones(prev => ({
      ...prev,
      [reservaId]: {
        ...prev[reservaId],
        turno: prev[reservaId]?.turno || 'maniana',
        canchas: prev[reservaId]?.canchas || [],
        solicitaChuruata: !prev[reservaId]?.solicitaChuruata,
      },
    }));
  };

  const getTurnoPreferenciaLabel = (turno: string | null | undefined) => {
    if (turno === 'maniana') return 'Mañana';
    if (turno === 'tarde') return 'Tarde';
    if (turno === 'noche') return 'Noche';
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
            <div className="text-right">
              <span className="block text-xs font-semibold text-gray-900">
                {formatoFechaCompleto(r.fecha)}
              </span>
              <span className="block text-[10px] text-gray-500">
                Solicitado: {formatFechaVenezuela(r.solicitadoEn)}
              </span>
            </div>
          </div>
          <p className="font-medium text-gray-900">{r.capitanNombre}</p>
          <p className="text-sm text-gray-600">
            vs {r.equipoRival} · {r.capitanEquipo}
          </p>
          <p className="text-sm text-blue-600">
            Prefiere: {getTurnoPreferenciaLabel(r.turnoPreferencia)}
          </p>
          <p className="text-sm text-gray-500">
            Motivo: {r.motivo === 'amistoso' ? 'Amistoso' : r.motivo === 'clases' ? 'Clases' : r.motivo === 'torneo' ? 'Torneo' : r.motivo}
          </p>
          {r.solicitaChuruata && (
            <p className="text-sm text-orange-600 font-medium">Solicita churuata</p>
          )}
          {r.observaciones && <p className="mt-1 text-sm text-gray-500">{r.observaciones}</p>}
          
          <div className="mt-3 space-y-2">
            <select
              value={asignaciones[r.id]?.turno || ''}
              onChange={(e) => updateAsignacionTurno(r.id, e.target.value as Turno)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">Turno...</option>
              {TURNOS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Canchas</label>
              <div className="flex flex-wrap gap-2">
                {CANCHAS.map(c => (
                  <label key={c} className={`flex items-center gap-1 rounded border px-2 py-1 text-sm cursor-pointer ${
                    asignaciones[r.id]?.canchas?.includes(c) ? 'bg-green-100 border-green-500 text-green-800' : 'border-gray-300 hover:bg-gray-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={asignaciones[r.id]?.canchas?.includes(c) || false}
                      onChange={() => toggleCancha(r.id, c)}
                      className="rounded"
                    />
                    C{c}
                  </label>
                ))}
                <label className={`flex items-center gap-1 rounded border px-2 py-1 text-sm cursor-pointer ${
                  asignaciones[r.id]?.solicitaChuruata ? 'bg-orange-100 border-orange-500 text-orange-800' : 'border-gray-300 hover:bg-gray-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={asignaciones[r.id]?.solicitaChuruata || false}
                    onChange={() => toggleChuruata(r.id)}
                    className="rounded"
                  />
                  Churuata
                </label>
              </div>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => handleAsignar(r)} disabled={asignandoId === r.id}>
              {asignandoId === r.id ? 'Asignando...' : 'Asignar'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setReservaEditando(r)}>
              Editar
            </Button>
            <Button variant="danger" size="sm" onClick={() => { setReservaRechazando(r); setMotivoRechazo(''); }}>
              Rechazar
            </Button>
            <Button variant="danger" size="sm" onClick={() => handleEliminar(r)} disabled={eliminandoId === r.id}>
              {eliminandoId === r.id ? 'Eliminando...' : 'Eliminar'}
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

      {reservaRechazando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4 text-red-600">Rechazar solicitud</h2>
            <div className="mb-4 space-y-2 rounded-lg bg-gray-50 p-3 text-sm">
              <p><strong>Capitán:</strong> {reservaRechazando.capitanNombre}</p>
              <p><strong>Equipo:</strong> {reservaRechazando.capitanEquipo}</p>
              <p><strong>Rival:</strong> {reservaRechazando.equipoRival}</p>
              <p><strong>Fecha:</strong> {formatoFechaCompleto(reservaRechazando.fecha)}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Motivo del rechazo *</label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="Indica el motivo del rechazo..."
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setReservaRechazando(null); setMotivoRechazo(''); }}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRechazar}
                disabled={!motivoRechazo.trim() || rechazandoId === reservaRechazando.id}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
              >
                {rechazandoId === reservaRechazando.id ? 'Rechazando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
