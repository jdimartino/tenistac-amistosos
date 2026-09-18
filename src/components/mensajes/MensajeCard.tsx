import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { useAuth } from '../../hooks/useAuth';
import { useMensajesActions } from '../../hooks/useMensajes';
import type { Mensaje } from '../../lib/tipos';

interface MensajeCardProps {
  mensaje: Mensaje;
}

const badgeColor = (categoria: Mensaje['categoria']) => {
  if (categoria === 'aprobacion') return 'green';
  if (categoria === 'rechazo') return 'red';
  return 'gray';
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

export const MensajeCard = ({ mensaje }: MensajeCardProps) => {
  const { usuario } = useAuth();
  const { borrar } = useMensajesActions();
  const [eliminando, setEliminando] = useState(false);
  const esAdmin = usuario?.role === 'admin';

  const handleEliminar = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('¿Eliminar este mensaje?')) return;
    setEliminando(true);
    try {
      await borrar(mensaje.id);
    } catch (err) {
      console.error('Error al eliminar:', err);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="relative group">
      <Link
        to={`/mensajes/${mensaje.id}`}
        className={`block rounded-xl border bg-white p-4 shadow-sm transition-colors hover:bg-gray-50 ${
          mensaje.leido ? 'border-gray-200' : 'border-green-300 bg-green-50/50'
        }`}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge color={badgeColor(mensaje.categoria)}>
              {mensaje.categoria === 'aprobacion'
                ? 'Aprobación'
                : mensaje.categoria === 'rechazo'
                  ? 'Rechazo'
                  : 'Comunicación'}
            </Badge>
            {!mensaje.leido && (
              <span className="h-2 w-2 rounded-full bg-green-600" />
            )}
          </div>
          <span className="text-xs text-gray-500">{formatDate(mensaje.createdAt)}</span>
        </div>
        <p className={`text-sm ${mensaje.leido ? 'font-normal text-gray-700' : 'font-semibold text-gray-900'}`}>
          {mensaje.asunto}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
          {mensaje.cuerpo}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          De: {mensaje.deNombre}
        </p>
      </Link>

      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {esAdmin && (
          <button
            type="button"
            onClick={handleEliminar}
            disabled={eliminando}
            title="Eliminar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-300 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        )}
        <Link
          to={`/mensajes/${mensaje.id}`}
          title="Responder"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow border border-gray-200 text-gray-600 hover:bg-green-50 hover:border-green-300 hover:text-green-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 14 4 9 9 4" />
            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
          </svg>
        </Link>
      </div>
    </div>
  );
};
