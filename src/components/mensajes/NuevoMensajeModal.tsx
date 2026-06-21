import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { useMensajesActions } from '../../hooks/useMensajes';
import { useAuth } from '../../hooks/useAuth';
import { useUsuarios } from '../../hooks/useUsuarios';
import type { Usuario } from '../../lib/tipos';

interface NuevoMensajeModalProps {
  onClose: () => void;
}

export const NuevoMensajeModal = ({ onClose }: NuevoMensajeModalProps) => {
  const { usuario } = useAuth();
  const { enviar } = useMensajesActions();
  const { usuarios } = useUsuarios();
  const [paraUid, setParaUid] = useState('admin');
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esAdmin = usuario?.role === 'admin';

  const destinatarios: Usuario[] = esAdmin
    ? usuarios.filter((u) => u.role === 'capitan' || u.role === 'subcapitan')
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asunto.trim() || !cuerpo.trim()) {
      setError('Asunto y cuerpo son obligatorios.');
      return;
    }
    if (!paraUid) {
      setError('Selecciona un destinatario.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await enviar({ paraUid, asunto: asunto.trim(), cuerpo: cuerpo.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el mensaje.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Nuevo mensaje">
      <form onSubmit={handleSubmit} className="space-y-4">
        {esAdmin ? (
          <Select
            label="Para"
            value={paraUid}
            onChange={(e) => setParaUid(e.target.value)}
            options={[
              { value: 'admin', label: 'Administradores (bandeja compartida)' },
              ...destinatarios.map((u) => ({
                value: u.uid,
                label: `${u.displayName || u.username} (${u.role})`,
              })),
            ]}
          />
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Para</label>
            <div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-600">
              Administradores
            </div>
          </div>
        )}

        <Input
          label="Asunto"
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          placeholder="Asunto del mensaje"
          required
        />

        <Textarea
          label="Mensaje"
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          placeholder="Escribe tu mensaje..."
          rows={5}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
