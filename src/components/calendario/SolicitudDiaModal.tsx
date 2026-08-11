import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import type { PreferenciaTurno, Motivo } from '../../lib/tipos';

interface SolicitudDiaModalProps {
  fecha: string;
  onClose: () => void;
}

const TURNOS_OPCIONES = [
  { value: 'cualquiera', label: 'Cualquiera Disponible' },
  { value: 'maniana', label: 'Mañana' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noche', label: 'Noche' },
];

const MOTIVOS_OPCIONES = [
  { value: 'amistoso', label: 'Amistoso' },
  { value: 'entrenamiento', label: 'Entrenamiento' },
  { value: 'clases', label: 'Clases' },
  { value: 'torneo', label: 'Torneo' },
  { value: 'churuata', label: 'Churuata' },
];

export const SolicitudDiaModal = ({ fecha, onClose }: SolicitudDiaModalProps) => {
  const { usuario } = useAuth();
  const [turnoPreferencia, setTurnoPreferencia] = useState<PreferenciaTurno>('cualquiera');
  const [motivo, setMotivo] = useState<Motivo>('amistoso');
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
        canchas: [],
        estado: 'solicitado',
        capitanEquipo,
        capitanUid: usuario.uid,
        capitanNombre,
        equipoRival,
        motivo,
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
    <Modal open={true} onClose={onClose} title="Solicitar día">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Fecha</label>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-700">
            {new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR')}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Capitán</label>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-700">
            {capitanNombre}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Equipo</label>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-700">
            {capitanEquipo || 'Sin equipo asignado'}
          </div>
        </div>

        <Select
          label="Turno"
          value={turnoPreferencia}
          onChange={(e) => setTurnoPreferencia(e.target.value as PreferenciaTurno)}
          options={TURNOS_OPCIONES}
        />

        <Select
          label="Motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value as Motivo)}
          options={MOTIVOS_OPCIONES}
        />

        <Input
          label="Equipo rival"
          value={equipoRival}
          onChange={(e) => setEquipoRival(e.target.value)}
          required
          placeholder="Nombre del equipo rival"
          autoComplete="off"
        />

        <Textarea
          label="Observaciones"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={3}
          placeholder="Detalles adicionales (opcional)"
        />

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Enviando...' : 'Solicitar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
