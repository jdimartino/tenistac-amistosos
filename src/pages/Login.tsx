import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username.trim().toLowerCase(), password);
      navigate('/');
    } catch {
      // El error se maneja en AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Solo permitir letras
    const value = e.target.value.replace(/[^a-zA-Z]/g, '');
    setUsername(value);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="mb-1 text-center text-2xl font-bold text-gray-900">Tenis Táchira</h1>
        <p className="text-center text-sm text-gray-500">Solicitud de canchas de tenis</p>
        <p className="mb-6 text-center text-xs text-gray-400">Version 1.3</p>
        <p className="mb-6 text-center text-xs text-gray-400">By #JDMRules</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            label="Usuario"
            placeholder="admin"
            value={username}
            onChange={handleUsernameChange}
            required
            autoComplete="username"
          />
          <Input
            type="password"
            label="Contraseña"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-400">#JDMRules</p>
      </div>
    </div>
  );
};
