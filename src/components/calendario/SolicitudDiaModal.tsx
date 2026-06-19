import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { PreferenciaTurno } from '../../lib/tipos';

interface SolicitudDiaModalProps {
  fecha: string;
  onClose: () => void;
}

export const SolicitudDiaModal = ({ fecha, onClose }: SolicitudDiaModalProps) => {
  const { usuario } = useAuth();
  const [turnoPreferencia, setTurnoPreferencia] = useState<PreferenciaTurno>('cualquiera');
  const [equipoRival, setEquipoRival] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  const capitanNombre = usuario?.displayName || usuario?.username || '';
  const capitanEquipo = usuario?.equipo || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'reservas'), {
        fecha,
        turno: null,
        turnoPreferencia,
        cancha: null,
        estado: 'solicitado',
        capitanEquipo,
        capitanUid: usuario.uid,
        capitanNombre,
        equipoRival,
        observaciones,
        solicitadoEn: serverTimestamp(),
        aprobadoEn: null,
        aprobadoPor: null,
      });
      onClose();
    } catch (error) {
      console.error('Error al crear solicitud:', error);
      alert('Error al crear la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Solicitar día</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Fecha</label>
            <div className="text-gray-700">{new Date(fecha).toLocaleDateString('es-AR')}</div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Capitán</label>
            <div className="text-gray-700">{capitanNombre}</div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Equipo</label>
            <div className="text-gray-700">{capitanEquipo || 'Sin equipo asignado'}</div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Turno</label>
            <select
              value={turnoPreferencia}
              onChange={(e) => setTurnoPreferencia(e.target.value as PreferenciaTurno)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="cualquiera">Cualquiera Disponible</option>
              <option value="maniana">Mañana</option>
              <option value="tarde">Tarde</option>
            </select>
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
              rows={3}
            />
          </div>

          <div className="flex gap-2">
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
              {loading ? 'Enviando...' : 'Solicitar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
