import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';

interface AppShellProps {
  children: ReactNode;
}

const MobileBottomNav = () => {
  const { usuario } = useAuth();
  const location = useLocation();
  const isAdmin = usuario?.role === 'admin';

  const items = [
    { to: '/', label: 'Calendario' },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <nav
      className="safe-bottom sticky bottom-0 z-30 border-t border-gray-200 bg-white pt-1 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] sm:hidden"
      role="navigation"
      aria-label="Navegación principal"
    >
      <div className="mx-auto flex max-w-5xl justify-around">
        {items.map((item) => {
          const isActive = item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center py-3 text-xs font-medium ${
                isActive ? 'text-green-700' : 'text-gray-500'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export const AppShell = ({ children }: AppShellProps) => {
  const { usuario, logout } = useAuth();
  const location = useLocation();
  const isAdmin = usuario?.role === 'admin';

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="safe-top sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <h1 className="text-base sm:text-lg font-bold text-green-700 leading-tight">
              Club Táchira<br />
              <span className="text-sm sm:text-base font-normal">Solicitud de Canchas</span><br />
              <span className="text-[10px] sm:text-xs font-normal text-black">Beta 1.0</span>
            </h1>
            {isAdmin && (
              <Link
                to="/admin"
                aria-label="Panel de administración"
                className={`hidden sm:inline rounded-lg px-3 py-1.5 text-sm font-medium ${
                  location.pathname.startsWith('/admin')
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Admin
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-gray-600 sm:inline">
              {usuario?.displayName || usuario?.username}
            </span>
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Cerrar sesión">
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      <MobileBottomNav />
    </div>
  );
};
