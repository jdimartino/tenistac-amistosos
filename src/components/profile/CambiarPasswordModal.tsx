import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useChangePassword } from '../../hooks/useChangePassword';

interface CambiarPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export const CambiarPasswordModal = ({ open, onClose }: CambiarPasswordModalProps) => {
  const { cambiar, loading, error, success, reset } = useChangePassword();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleClose = () => {
    reset();
    setPassword('');
    setConfirm('');
    setLocalError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (password.length < 6) {
      setLocalError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setLocalError('Las contraseñas no coinciden.');
      return;
    }

    await cambiar(password);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Cambiar contraseña">
      {success ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
            Contraseña cambiada correctamente.
          </div>
          <Button onClick={handleClose} className="w-full">
            Cerrar
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nueva contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            required
            autoComplete="new-password"
          />
          <Input
            label="Confirmar contraseña"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repetí la contraseña"
            required
            autoComplete="new-password"
          />
          {(localError || error) && (
            <p className="text-sm text-red-600">{localError || error}</p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !password || !confirm} className="flex-1">
              {loading ? 'Cambiando...' : 'Cambiar contraseña'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
