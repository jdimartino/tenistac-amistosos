import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell = ({ children }: AppShellProps) => {
  const { usuario, logout } = useAuth();
  const location = useLocation();
  const isAdmin = usuario?.role === 'admin';

  const navItems = [
    { to: '/', label: 'Calendario' },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="safe-top sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-lg font-bold text-green-700 leading-tight">
  Club Táchira<br />
  <span className="text-base font-normal">Solicitud de Canchas</span><br />
  <span className="text-xs font-normal text-black">Beta 1.0</span>
</h1>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                to="/admin"
                className={`hidden text-sm font-medium sm:inline ${
                  location.pathname.startsWith('/admin') ? 'text-green-700' : 'text-gray-600'
                }`}
              >
                Admin
              </Link>
            )}
            <span className="hidden text-sm text-gray-600 sm:inline">{usuario?.displayName || usuario?.username}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 sm:py-6">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      <nav className="safe-bottom sticky bottom-0 z-30 border-t border-gray-200 bg-white px-4 pt-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] sm:hidden">
        <div className="mx-auto flex max-w-5xl justify-around">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-1 flex-col items-center py-2 text-xs font-medium ${
                location.pathname === item.to ? 'text-green-700' : 'text-gray-500'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
};
