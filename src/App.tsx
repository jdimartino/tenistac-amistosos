import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import { Calendario } from './pages/Calendario';
import { Spinner } from './components/ui/Spinner';

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const UsuariosPanel = lazy(() => import('./pages/admin/UsuariosPanel').then((m) => ({ default: m.UsuariosPanel })));
const SolicitudesPanel = lazy(() => import('./pages/admin/SolicitudesPanel').then((m) => ({ default: m.SolicitudesPanel })));
const BloqueosPanel = lazy(() => import('./pages/admin/BloqueosPanel').then((m) => ({ default: m.BloqueosPanel })));

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { firebaseUser, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-10 w-10 text-green-600" />
      </div>
    );
  }
  if (!firebaseUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { usuario, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-10 w-10 text-green-600" />
      </div>
    );
  }
  if (usuario?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <Spinner className="h-10 w-10 text-green-600" />
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Calendario />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<Navigate to="/admin/solicitudes" replace />} />
            <Route path="usuarios" element={<UsuariosPanel />} />
            <Route path="solicitudes" element={<SolicitudesPanel />} />
            <Route path="bloqueos" element={<BloqueosPanel />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
