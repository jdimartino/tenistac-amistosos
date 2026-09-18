import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNoLeidos } from '../../hooks/useMensajes';
import { useSolicitudesPendientes } from '../../hooks/useSolicitudesPendientes';
import { useMensajesNoLeidosData } from '../../hooks/useMensajesNoLeidosData';
import { Button } from '../ui/Button';
import { CambiarPasswordModal } from '../profile/CambiarPasswordModal';
import { formatoFechaCompleto } from '../../lib/fecha';

interface AppShellProps {
  children: ReactNode;
}

const NavTabs = () => {
  const { usuario } = useAuth();
  const location = useLocation();
  const isAdmin = usuario?.role === 'admin';
  const noLeidos = useNoLeidos();
  const { count: solicitudesPendientes } = useSolicitudesPendientes();

  const items = [
    { to: '/', label: 'Canchas' },
    { to: '/mensajes', label: 'Mensajes' },
    ...(isAdmin ? [{ to: '/admin', label: 'Administración' }] : []),
  ];

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <nav
      className="sticky top-14 z-20 border-b border-gray-200 bg-white px-2 sm:px-4"
      role="navigation"
      aria-label="Navegación principal"
    >
      <div className="mx-auto flex max-w-6xl justify-start gap-1 sm:gap-2 overflow-x-auto">
        {items.map((item) => {
          const active = isActive(item.to);
          const showMensajesBadge = item.to === '/mensajes' && noLeidos > 0;
          const showAdminBadge = item.to === '/admin' && solicitudesPendientes > 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={`relative flex-shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-b-2 border-green-600 text-green-700 bg-green-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {item.label}
              {showMensajesBadge && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                  {noLeidos > 9 ? '9+' : noLeidos}
                </span>
              )}
              {showAdminBadge && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white leading-none">
                  {solicitudesPendientes > 9 ? '9+' : solicitudesPendientes}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

const NotificationBell = () => {
  const { usuario } = useAuth();
  const { count: solicitudesCount, solicitudes } = useSolicitudesPendientes();
  const mensajesNoLeidos = useMensajesNoLeidosData();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!usuario) return null;

  const isAdmin = usuario.role === 'admin';
  const totalCount = (isAdmin ? solicitudesCount : 0) + mensajesNoLeidos.length;

  if (totalCount === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`Notificaciones: ${totalCount}`}
        className="relative inline-flex items-center rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white leading-none">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-gray-900">Notificaciones</h3>
          </div>

          {/* Solicitudes pendientes - solo admin */}
          {isAdmin && solicitudesCount > 0 && (
            <>
              <div className="bg-gray-50 px-4 py-1.5">
                <span className="text-xs font-semibold text-gray-600">📋 Solicitudes ({solicitudesCount})</span>
              </div>
              <div className="divide-y divide-gray-100">
                {solicitudes.map((s) => (
                  <Link
                    key={s.id}
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{s.capitanNombre}</span>
                      <span className="text-[10px] text-gray-400">{formatoFechaCompleto(s.fecha)}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      vs {s.equipoRival} · {s.capitanEquipo}
                    </div>
                    <div className="text-xs text-blue-600">
                      {s.motivo === 'amistoso' ? 'Amistoso' : s.motivo === 'clases' ? 'Clases' : s.motivo === 'torneo' ? 'Torneo' : s.motivo}
                      {s.solicitaChuruata && ' · Churuata'}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Mensajes no leídos */}
          {mensajesNoLeidos.length > 0 && (
            <>
              <div className="bg-gray-50 px-4 py-1.5">
                <span className="text-xs font-semibold text-gray-600">💬 Mensajes nuevos ({mensajesNoLeidos.length})</span>
              </div>
              <div className="divide-y divide-gray-100">
                {mensajesNoLeidos.slice(0, 5).map((m) => (
                  <Link
                    key={m.id}
                    to="/mensajes"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{m.deNombre}</span>
                      <span className="text-[10px] text-gray-400">
                        {m.createdAt.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-gray-700 truncate">{m.asunto}</div>
                    <div className="text-xs text-gray-500 truncate">{m.cuerpo}</div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2 text-center">
            <Link
              to={isAdmin ? '/admin' : '/mensajes'}
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-green-600 hover:text-green-700"
            >
              Ver todo →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export const AppShell = ({ children }: AppShellProps) => {
  const { usuario, logout } = useAuth();
  const [showCambiar, setShowCambiar] = useState(false);
  const [bannerPrimerLoginCerrado, setBannerPrimerLoginCerrado] = useState(false);

  const mostrarBannerPrimerLogin = usuario?.primerLogin === true && !bannerPrimerLoginCerrado;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <CambiarPasswordModal open={showCambiar} onClose={() => setShowCambiar(false)} />
      <header className="safe-top sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-base sm:text-lg font-bold text-green-700 leading-tight">
            Club Táchira<br />
            <span className="text-sm sm:text-base font-normal">Solicitud de Canchas</span><br />
            <span className="text-[10px] sm:text-xs font-normal text-black">1.3</span><br />
            <span className="text-[10px] sm:text-xs font-normal text-black">By #JDMRules</span>
          </h1>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="truncate max-w-24 sm:max-w-40 text-sm text-gray-600">
              {usuario?.displayName || usuario?.username}
            </span>
            <NotificationBell />
            <button
              type="button"
              onClick={() => setShowCambiar(true)}
              title="Cambiar contraseña"
              aria-label="Cambiar contraseña"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs sm:text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                <circle cx="12" cy="16" r="1" />
              </svg>
              <span>Clave</span>
            </button>
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Cerrar sesión">
              Salir
            </Button>
          </div>
        </div>
      </header>

      {mostrarBannerPrimerLogin && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">Recordatorio:</span> te recomendamos cambiar tu contraseña la primera vez que ingresás.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="xs"
                onClick={() => {
                  setBannerPrimerLoginCerrado(true);
                  setShowCambiar(true);
                }}
              >
                Cambiar ahora
              </Button>
              <button
                type="button"
                onClick={() => setBannerPrimerLoginCerrado(true)}
                className="text-xs text-yellow-600 hover:text-yellow-800 underline"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}

      <NavTabs />

      <main className="flex-1 px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
};
