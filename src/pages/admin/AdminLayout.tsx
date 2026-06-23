import { Link, Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';

const tabs = [
  { to: '/', label: '← Canchas' },
  { to: '/admin/usuarios', label: 'Usuarios' },
  { to: '/admin/solicitudes', label: 'Solicitudes' },
  { to: '/admin/bloqueos', label: 'Bloqueos' },
];

export const AdminLayout = () => {
  const location = useLocation();

  return (
    <AppShell>
      <div className="mb-4 border-b border-gray-200">
        <nav className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Panel de administración">
          {tabs.map((tab) => {
            const isActive = tab.to === '/'
              ? location.pathname === '/'
              : location.pathname === tab.to;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                role="tab"
                aria-selected={isActive}
                className={`whitespace-nowrap rounded-t-lg px-4 py-3 text-sm font-medium ${
                  isActive
                    ? 'border-b-2 border-green-600 text-green-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </AppShell>
  );
};
