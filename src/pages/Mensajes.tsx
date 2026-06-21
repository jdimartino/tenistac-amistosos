import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { MensajeCard } from '../components/mensajes/MensajeCard';
import { NuevoMensajeModal } from '../components/mensajes/NuevoMensajeModal';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { useBandeja, useMensajesActions } from '../hooks/useMensajes';

export const Mensajes = () => {
  const { mensajes, loading } = useBandeja();
  const { marcarTodoLeido } = useMensajesActions();
  const [showNuevo, setShowNuevo] = useState(false);
  const [marcando, setMarcando] = useState(false);

  const noLeidos = mensajes.filter((m) => !m.leido);

  const handleMarcarTodo = async () => {
    setMarcando(true);
    try {
      await marcarTodoLeido(noLeidos.map((m) => m.id));
    } catch (err) {
      console.error('Error al marcar todo:', err);
    } finally {
      setMarcando(false);
    }
  };

  return (
    <AppShell>
      <div className="mb-2">
        <Link
          to="/"
          className="text-sm font-medium text-green-700 hover:text-green-800"
        >
          ← Canchas
        </Link>
      </div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Mensajes</h2>
          {noLeidos.length > 0 && (
            <p className="text-xs text-gray-500">{noLeidos.length} sin leer</p>
          )}
        </div>
        <div className="flex gap-2">
          {noLeidos.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarcarTodo}
              disabled={marcando}
            >
              {marcando ? '...' : 'Marcar todo leído'}
            </Button>
          )}
          <Button size="sm" onClick={() => setShowNuevo(true)}>
            Nuevo mensaje
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-8 w-8 text-green-600" />
        </div>
      ) : mensajes.length === 0 ? (
        <p className="py-8 text-center text-gray-500">No hay mensajes.</p>
      ) : (
        <div className="space-y-2">
          {mensajes.map((m) => (
            <MensajeCard key={m.id} mensaje={m} />
          ))}
        </div>
      )}

      {showNuevo && <NuevoMensajeModal onClose={() => setShowNuevo(false)} />}
    </AppShell>
  );
};
