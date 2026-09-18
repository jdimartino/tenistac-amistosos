import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import { Calendario } from './pages/Calendario';
import { Spinner } from './components/ui/Spinner';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const UsuariosPanel = lazy(() => import('./pages/admin/UsuariosPanel').then((m) => ({ default: m.UsuariosPanel })));
const SolicitudesPanel = lazy(() => import('./pages/admin/SolicitudesPanel').then((m) => ({ default: m.SolicitudesPanel })));
const HistorialPanel = lazy(() => import('./pages/admin/HistorialPanel').then((m) => ({ default: m.HistorialPanel })));
const BloqueosPanel = lazy(() => import('./pages/admin/BloqueosPanel').then((m) => ({ default: m.BloqueosPanel })));
const UsoCorreosPanel = lazy(() => import('./pages/admin/UsoCorreosPanel').then((m) => ({ default: m.UsoCorreosPanel })));
const Mensajes = lazy(() => import('./pages/Mensajes').then((m) => ({ default: m.Mensajes })));
const MensajeDetalle = lazy(() => import('./pages/MensajeDetalle').then((m) => ({ default: m.MensajeDetalle })));

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
      <ErrorBoundary>
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
            <Route path="historial" element={<HistorialPanel />} />
            <Route path="bloqueos" element={<BloqueosPanel />} />
            <Route path="correos" element={<UsoCorreosPanel />} />
          </Route>
          <Route path="/mensajes" element={<ProtectedRoute><Mensajes /></ProtectedRoute>} />
          <Route path="/mensajes/:id" element={<ProtectedRoute><MensajeDetalle /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
