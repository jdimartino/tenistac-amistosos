import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { DiaCard } from './DiaCard';
import { SolicitudDiaModal } from './SolicitudDiaModal';
import type { Reserva, SlotBloqueado } from '../../lib/tipos';

interface CalendarioCapitanProps {
  fechaInicio: string;
  fechaFin: string;
}

const TOTAL_SLOTS_POR_DIA = 10; // 5 canchas × 2 turnos

export const CalendarioCapitan = ({ fechaInicio, fechaFin }: CalendarioCapitanProps) => {
  const { usuario } = useAuth();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [slotsBloqueados, setSlotsBloqueados] = useState<SlotBloqueado[]>([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  // Escuchar reservas
  useEffect(() => {
    const q = query(
      collection(db, 'reservas'),
      where('fecha', '>=', fechaInicio),
      where('fecha', '<=', fechaFin)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReservas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reserva)));
    });
    return unsubscribe;
  }, [fechaInicio, fechaFin]);

  // Escuchar slots bloqueados (a nivel cancha)
  useEffect(() => {
    const q = query(
      collection(db, 'slotsBloqueados'),
      where('fecha', '>=', fechaInicio),
      where('fecha', '<=', fechaFin)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSlotsBloqueados(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SlotBloqueado)));
    });
    return unsubscribe;
  }, [fechaInicio, fechaFin]);

  const handleCancelar = async (reservaId: string) => {
    if (!confirm('¿Estás seguro de cancelar esta solicitud?')) return;
    setCancelandoId(reservaId);
    try {
      await deleteDoc(doc(db, 'reservas', reservaId));
    } catch (error) {
      console.error('Error al cancelar:', error);
      alert('Error al cancelar la solicitud');
    } finally {
      setCancelandoId(null);
    }
  };

  // Generar array de fechas
  const fechas: string[] = [];
  const start = new Date(fechaInicio);
  const end = new Date(fechaFin);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    fechas.push(d.toISOString().split('T')[0]);
  }

  const getSlotsBloqueadosDia = (fecha: string): number => {
    return slotsBloqueados.filter(s => s.fecha === fecha).length;
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
            slotsBloqueadosCount={getSlotsBloqueadosDia(fecha)}
            totalSlots={TOTAL_SLOTS_POR_DIA}
            onSolicitar={() => setDiaSeleccionado(fecha)}
            onCancelar={handleCancelar}
            usuarioUid={usuario.uid}
            cancelandoId={cancelandoId}
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
