import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Textarea } from '../components/ui/Textarea';
import { useThread, useMensajesActions } from '../hooks/useMensajes';
import { useAuth } from '../hooks/useAuth';

const rolLabel = (rol: string) => {
  if (rol === 'admin') return 'Administrador';
  if (rol === 'capitan') return 'Capitán';
  if (rol === 'subcapitan') return 'Sub-Capitán';
  return rol;
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
  const { usuario } = useAuth();
  const { mensajes, loading } = useThread(id);
  const { responder } = useMensajesActions();
  const [respuesta, setRespuesta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const primerMensaje = mensajes[0];

  const puedeResponder = useMemo(() => {
    if (!primerMensaje || !usuario) return false;
    const ultimo = mensajes[mensajes.length - 1];
    return ultimo?.deUid !== usuario.uid;
  }, [mensajes, usuario, primerMensaje]);

  const paraResponder = useMemo(() => {
    if (!primerMensaje) return '';
    const ultimo = mensajes[mensajes.length - 1];
    if (!ultimo) return '';
    if (ultimo.deRol === 'admin') return 'admin';
    if (ultimo.deUid === usuario?.uid) {
      return ultimo.paraUid;
    }
    return ultimo.deUid;
  }, [mensajes, primerMensaje, usuario]);

  const handleResponder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primerMensaje || !respuesta.trim() || !id) return;
    setEnviando(true);
    setError(null);
    try {
      await responder(paraResponder, `Re: ${primerMensaje.asunto}`, respuesta.trim(), id);
      setRespuesta('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
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
      ) : mensajes.length === 0 ? (
        <p className="py-8 text-center text-gray-500">Conversación no encontrada.</p>
      ) : (
        <div className="space-y-3">
          {primerMensaje && (
            <h2 className="text-lg font-semibold text-gray-900">
              {primerMensaje.asunto}
            </h2>
          )}

          {mensajes.map((m) => {
            const esPropio = m.deUid === usuario?.uid;
            return (
              <div
                key={m.id}
                className={`rounded-xl border p-4 shadow-sm ${
                  esPropio
                    ? 'border-green-200 bg-green-50/30 ml-6'
                    : 'border-gray-200 bg-white mr-6'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {m.deNombre}
                    </span>
                    <Badge color={m.deRol === 'admin' ? 'green' : 'gray'}>
                      {rolLabel(m.deRol)}
                    </Badge>
                    {esPropio && (
                      <span className="text-xs text-gray-400">(tú)</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(m.createdAt)}</span>
                </div>
                <div className="whitespace-pre-wrap text-sm text-gray-800">
                  {m.cuerpo}
                </div>
              </div>
            );
          })}

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

          <div ref={bottomRef} />
        </div>
      )}
    </AppShell>
  );
};
