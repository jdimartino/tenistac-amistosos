import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { NuevoMensajeModal } from '../components/mensajes/NuevoMensajeModal';
import { useBandeja, useEnviados, useMensajesActions } from '../hooks/useMensajes';
import { useUsuarios } from '../hooks/useUsuarios';
import type { Mensaje } from '../lib/tipos';

interface ThreadSummary {
  threadId: string;
  ultimo: Mensaje;
  total: number;
  respondidoAdmin: boolean;
  noLeidos: number;
}

const agruparThreads = (mensajes: Mensaje[]): ThreadSummary[] => {
  const grupos = new Map<string, Mensaje[]>();
  for (const m of mensajes) {
    const tid = m.threadId || m.id;
    const arr = grupos.get(tid) || [];
    arr.push(m);
    grupos.set(tid, arr);
  }
  const res: ThreadSummary[] = [];
  for (const [threadId, msgs] of grupos) {
    msgs.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    res.push({
      threadId,
      ultimo: msgs[0],
      total: msgs.length,
      respondidoAdmin: msgs.some((m) => m.deRol === 'admin'),
      noLeidos: msgs.filter((m) => !m.leido).length,
    });
  }
  res.sort((a, b) => (b.ultimo.createdAt?.getTime() || 0) - (a.ultimo.createdAt?.getTime() || 0));
  return res;
};

const formatDate = (fecha: Date | undefined): string => {
  if (!fecha) return '';
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type Tab = 'recibidos' | 'enviados';

export const Mensajes = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('recibidos');
  const { mensajes: recibidos, loading: loadingRecibidos } = useBandeja();
  const { mensajes: enviados, loading: loadingEnviados } = useEnviados();
  const { usuarios } = useUsuarios();
  const { marcarTodoLeido } = useMensajesActions();
  const [showNuevo, setShowNuevo] = useState(false);
  const [marcando, setMarcando] = useState(false);

  const mensajes = tab === 'recibidos' ? recibidos : enviados;
  const loading = tab === 'recibidos' ? loadingRecibidos : loadingEnviados;

  const threads = useMemo(() => agruparThreads(mensajes), [mensajes]);

  const totalNoLeidos = threads.reduce((acc, t) => acc + t.noLeidos, 0);

  const getNombrePara = (paraUid: string): string => {
    if (paraUid === 'admin') return 'Administradores';
    const user = usuarios.find(u => u.uid === paraUid);
    return user?.displayName || user?.username || paraUid;
  };

  const handleMarcarTodo = async () => {
    setMarcando(true);
    try {
      const ids = mensajes.filter((m) => !m.leido).map((m) => m.id);
      await marcarTodoLeido(ids);
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
          {tab === 'recibidos' && totalNoLeidos > 0 && (
            <p className="text-xs text-gray-500">{totalNoLeidos} sin leer</p>
          )}
        </div>
        <div className="flex gap-2">
          {tab === 'recibidos' && totalNoLeidos > 0 && (
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

      <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'recibidos'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('recibidos')}
        >
          Recibidos
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'enviados'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setTab('enviados')}
        >
          Enviados
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-8 w-8 text-green-600" />
        </div>
      ) : threads.length === 0 ? (
        <p className="py-8 text-center text-gray-500">
          {tab === 'recibidos' ? 'No hay mensajes recibidos.' : 'No hay mensajes enviados.'}
        </p>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => (
            <button
              key={t.threadId}
              type="button"
              onClick={() => navigate(`/mensajes/${t.threadId}`)}
              className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50 ${
                tab === 'recibidos' && t.noLeidos > 0 ? 'border-green-300 bg-green-50/50' : 'border-gray-200'
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {t.ultimo.asunto}
                  </span>
                  {tab === 'recibidos' && t.noLeidos > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-green-600 px-1.5 text-[11px] font-bold text-white">
                      {t.noLeidos}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{formatDate(t.ultimo.createdAt)}</span>
              </div>
              <p className="line-clamp-2 text-sm text-gray-600">
                {t.ultimo.cuerpo}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {tab === 'enviados' ? (
                  <span className="text-xs text-gray-400">
                    Para: {getNombrePara(t.ultimo.paraUid)} &mdash; {t.total} mensaje{t.total !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">
                    {t.ultimo.deNombre} &mdash; {t.total} mensaje{t.total !== 1 ? 's' : ''}
                  </span>
                )}
                {tab === 'recibidos' && t.respondidoAdmin && (
                  <Badge color="green">Respondido</Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showNuevo && <NuevoMensajeModal onClose={() => setShowNuevo(false)} />}
    </AppShell>
  );
};
