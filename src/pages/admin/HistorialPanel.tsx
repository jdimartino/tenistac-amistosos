import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useUsuarios } from '../../hooks/useUsuarios';
import { Spinner } from '../../components/ui/Spinner';
import { formatFechaVenezuela } from '../../lib/fecha';
import type { LogReserva, LogReservaTipo } from '../../lib/tipos';

const TIPOS_EVENTO: Record<LogReservaTipo, { label: string; color: string }> = {
  reserva_aprobada: { label: 'Solicitud aprobada', color: 'text-green-700 bg-green-100' },
  reserva_rechazada: { label: 'Solicitud rechazada', color: 'text-red-700 bg-red-100' },
  reserva_eliminada: { label: 'Solicitud eliminada', color: 'text-gray-700 bg-gray-100' },
};

export const HistorialPanel = () => {
  const { usuarios, loading: loadingUsuarios } = useUsuarios();
  const [logs, setLogs] = useState<LogReserva[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'logs'),
      where('tipo', 'in', ['reserva_aprobada', 'reserva_rechazada', 'reserva_eliminada']),
      orderBy('realizadoEn', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LogReserva);
      setLogs(list);
      setLoading(false);
    }, (err) => {
      console.error('Error cargando historial:', err);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const adminNombre = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of usuarios) map[u.uid] = u.displayName || u.username;
    return map;
  }, [usuarios]);

  if (loading || loadingUsuarios) return <Spinner className="h-8 w-8 text-green-600" />;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">Historial de solicitudes</h3>

      {logs.length === 0 ? (
        <p className="py-8 text-center text-gray-500">No hay actividad registrada todavía.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const evento = TIPOS_EVENTO[log.tipo];
            const detalle =
              log.tipo === 'reserva_aprobada'
                ? `Turno ${log.turno === 'maniana' ? 'Mañana' : 'Tarde'} · Canchas ${log.canchas?.join(', ') || '?'}` :
              log.tipo === 'reserva_rechazada'
                ? `Motivo: ${log.motivo || '-'}`
                : 'Eliminada sin notificación';

            return (
              <div key={log.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${evento.color}`}>
                    {evento.label}
                  </span>
                  <span className="text-xs text-gray-500">
                    {log.realizadoEn ? formatFechaVenezuela(log.realizadoEn) : ''}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <p>
                    <span className="font-medium text-gray-900">{log.capitanNombre || 'Capitán desconocido'}</span>
                    {log.fecha && <span className="text-gray-600"> · Fecha cancha: {log.fecha}</span>}
                  </p>
                  <p className="text-gray-600">{detalle}</p>
                  <p className="text-xs text-gray-400">
                    Realizado por: {adminNombre[log.realizadoPor] || log.realizadoPor}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
