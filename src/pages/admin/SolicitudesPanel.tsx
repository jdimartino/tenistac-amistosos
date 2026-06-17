import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { useReservas } from '../../hooks/useReservas';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import type { Reserva } from '../../lib/tipos';

export const SolicitudesPanel = () => {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const { usuario } = useAuth();
  const { aprobar, cancelar } = useReservas();

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
              {r.fecha} · {r.turno === 'maniana' ? 'Mañana' : 'Tarde'} · Cancha {r.cancha}
            </span>
          </div>
          <p className="font-medium text-gray-900">{r.capitanNombre}</p>
          <p className="text-sm text-gray-600">
            vs {r.equipoRival} · Cat. {r.categoria}
          </p>
          {r.observaciones && <p className="mt-1 text-sm text-gray-500">{r.observaciones}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => usuario && aprobar(r.id, usuario.uid)}>
              Reservar
            </Button>
            <Button variant="danger" size="sm" onClick={() => cancelar(r.id)}>
              Rechazar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
