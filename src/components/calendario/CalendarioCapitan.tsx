import { useState } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { DiaCard } from './DiaCard';
import { SolicitudDiaModal } from './SolicitudDiaModal';
import type { Reserva, Bloqueo } from '../../lib/tipos';

interface CalendarioCapitanProps {
  fechaInicio: string;
  fechaFin: string;
}

export const CalendarioCapitan = ({ fechaInicio, fechaFin }: CalendarioCapitanProps) => {
  const { usuario } = useAuth();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);

  // Escuchar reservas
  useState(() => {
    const q = query(
      collection(db, 'reservas'),
      where('fecha', '>=', fechaInicio),
      where('fecha', '<=', fechaFin)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReservas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reserva)));
    });
    return unsubscribe;
  });

  // Escuchar bloqueos
  useState(() => {
    const q = query(
      collection(db, 'bloqueos'),
      where('fechaInicio', '<=', fechaFin),
      where('fechaFin', '>=', fechaInicio)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBloqueos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bloqueo)));
    });
    return unsubscribe;
  });

  const handleCancelar = async (reservaId: string) => {
    if (!confirm('¿Estás seguro de cancelar esta solicitud?')) return;
    try {
      await deleteDoc(doc(db, 'reservas', reservaId));
    } catch (error) {
      console.error('Error al cancelar:', error);
      alert('Error al cancelar la solicitud');
    }
  };

  // Generar array de fechas
  const fechas: string[] = [];
  const start = new Date(fechaInicio);
  const end = new Date(fechaFin);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    fechas.push(d.toISOString().split('T')[0]);
  }

  const estaBloqueado = (fecha: string) => {
    return bloqueos.some(b => fecha >= b.fechaInicio && fecha <= b.fechaFin);
  };

  const getReservasDelDia = (fecha: string) => {
    return reservas.filter(r => r.fecha === fecha);
  };

  if (!usuario) return null;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {fechas.map(fecha => (
          <DiaCard
            key={fecha}
            fecha={fecha}
            reservas={getReservasDelDia(fecha)}
            bloqueado={estaBloqueado(fecha)}
            onSolicitar={() => setDiaSeleccionado(fecha)}
            onCancelar={handleCancelar}
            usuarioUid={usuario.uid}
          />
        ))}
      </div>

      {diaSeleccionado && (
        <SolicitudDiaModal
          fecha={diaSeleccionado}
          onClose={() => setDiaSeleccionado(null)}
        />
      )}
    </div>
  );
};
