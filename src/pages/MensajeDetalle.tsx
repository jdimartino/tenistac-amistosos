import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Textarea } from '../components/ui/Textarea';
import { useMensaje, useMensajesActions } from '../hooks/useMensajes';
import { useAuth } from '../hooks/useAuth';
import type { Mensaje } from '../lib/tipos';

const badgeColor = (categoria: Mensaje['categoria']) => {
  if (categoria === 'aprobacion') return 'green';
  if (categoria === 'rechazo') return 'red';
  return 'gray';
};

const formatDate = (fecha: Date | undefined): string => {
  if (!fecha) return '';
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const MensajeDetalle = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { mensaje, loading } = useMensaje(id);
  const { responder, borrar } = useMensajesActions();
  const [respuesta, setRespuesta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esAdmin = usuario?.role === 'admin';

  const puedeResponder =
    mensaje &&
    mensaje.tipo === 'directo' &&
    mensaje.deUid !== usuario?.uid;

  const paraResponder = mensaje && mensaje.deRol === 'admin'
    ? 'admin'
    : mensaje?.deUid ?? '';

  const handleEliminar = async () => {
    if (!mensaje || !confirm('¿Eliminar este mensaje?')) return;
    setEliminando(true);
    setError(null);
    try {
      await borrar(mensaje.id);
      navigate('/mensajes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar.');
      setEliminando(false);
    }
  };

  const handleResponder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensaje || !respuesta.trim()) return;
    setEnviando(true);
    setError(null);
    try {
      await responder(paraResponder, `Re: ${mensaje.asunto}`, respuesta.trim());
      setRespuesta('');
      navigate('/mensajes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al responder.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AppShell>
      <div className="mb-4">
        <Link
          to="/mensajes"
          className="text-sm font-medium text-green-700 hover:text-green-800"
        >
          ← Volver a mensajes
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-8 w-8 text-green-600" />
        </div>
      ) : !mensaje ? (
        <p className="py-8 text-center text-gray-500">Mensaje no encontrado.</p>
      ) : (
        <div className="relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {esAdmin && (
            <button
              type="button"
              onClick={handleEliminar}
              disabled={eliminando}
              title="Eliminar"
              className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-300 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          )}
          <div className="mb-3 flex items-center justify-between gap-2">
            <Badge color={badgeColor(mensaje.categoria)}>
              {mensaje.categoria === 'aprobacion'
                ? 'Aprobación'
                : mensaje.categoria === 'rechazo'
                  ? 'Rechazo'
                  : 'Comunicación'}
            </Badge>
            <span className="text-xs text-gray-500">
              {formatDate(mensaje.createdAt)}
            </span>
          </div>

          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            {mensaje.asunto}
          </h2>

          <p className="mb-3 text-xs text-gray-500">
            De: <span className="font-medium text-gray-700">{mensaje.deNombre}</span>
            {mensaje.deRol && ` (${mensaje.deRol})`}
          </p>

          <div className="whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-800">
            {mensaje.cuerpo}
          </div>

          {puedeResponder && (
            <form onSubmit={handleResponder} className="mt-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Responder</h3>
              <Textarea
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                placeholder="Escribe tu respuesta..."
                rows={4}
                required
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={enviando || !respuesta.trim()}>
                {enviando ? 'Enviando...' : 'Responder'}
              </Button>
            </form>
          )}
        </div>
      )}
    </AppShell>
  );
};
