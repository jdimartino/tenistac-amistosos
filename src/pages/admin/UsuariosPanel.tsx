import { useState } from 'react';
import type { FormEvent } from 'react';
import { useUsuarios } from '../../hooks/useUsuarios';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import type { Rol, Usuario } from '../../lib/tipos';

const ROLES: { value: Rol; label: string }[] = [
  { value: 'capitan', label: 'Capitán' },
  { value: 'subcapitan', label: 'Sub-Capitán' },
  { value: 'admin', label: 'Admin' },
];

export const UsuariosPanel = () => {
  const { usuarios, loading, create, update, remove, setPassword } = useUsuarios();
  const [form, setForm] = useState({
    username: '',
    email: '',
    displayName: '',
    role: 'capitan' as Rol,
    equipo: '',
    password: '',
  });
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  const resetForm = () => {
    setForm({ username: '', email: '', displayName: '', role: 'capitan', equipo: '', password: '' });
    setEditingUid(null);
    setNewPassword(null);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Client-side validation
    const cleanUsername = form.username.trim().toLowerCase();
    if (!cleanUsername) {
      setError('El nombre de usuario es obligatorio.');
      setSubmitting(false);
      return;
    }
    if (cleanUsername.length < 2) {
      setError('El nombre de usuario debe tener al menos 2 caracteres.');
      setSubmitting(false);
      return;
    }
    if (!/^[a-z]+$/.test(cleanUsername)) {
      setError('El nombre de usuario solo puede contener letras minúsculas.');
      setSubmitting(false);
      return;
    }
    if (!editingUid && (!form.password || form.password.length < 6)) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      setSubmitting(false);
      return;
    }

    try {
      if (editingUid) {
        await update(editingUid, {
          username: cleanUsername,
          email: form.email || '',
          displayName: form.displayName || '',
          role: form.role,
          equipo: form.equipo || '',
        });
      } else {
        await create({
          username: cleanUsername,
          email: form.email || '',
          displayName: form.displayName || '',
          role: form.role,
          equipo: form.equipo || '',
          password: form.password,
        });
      }
      setSuccess(editingUid ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
      setTimeout(() => {
        resetForm();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el usuario.');
      console.error('Error creating/updating user:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (u: Usuario) => {
    setEditingUid(u.uid);
    setNewPassword(null);
    setForm({
      username: u.username,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      equipo: u.equipo,
      password: '',
    });
  };

  const handleSetPassword = async (uid: string) => {
    const newPass = prompt('Ingresá la nueva contraseña (mínimo 6 caracteres):');
    if (!newPass || newPass.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setResetLoading(uid);
    try {
      const result = await setPassword(uid, newPass);
      setNewPassword(result);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cambiar la contraseña');
    } finally {
      setResetLoading(null);
    }
  };

  const handleDelete = async (uid: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    setDeletingUid(uid);
    try {
      await remove(uid);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar el usuario');
    } finally {
      setDeletingUid(null);
    }
  };

  if (loading) return <Spinner className="h-8 w-8 text-green-600" />;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {editingUid ? 'Editar usuario' : 'Nuevo usuario'}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Usuario"
            value={form.username}
            onChange={(e) => {
              // Solo letras minúsculas
              const value = e.target.value.toLowerCase().replace(/[^a-z]/g, '');
              setForm({ ...form, username: value });
            }}
            required
          />
          <Input
            label="Correo (referencia - opcional)"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Opcional"
          />
          <Input
            label="Nombre"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
          <Select
            label="Rol"
            value={form.role}
            options={ROLES}
            onChange={(e) => setForm({ ...form, role: e.target.value as Rol })}
          />
          <Input
            label="Equipo"
            value={form.equipo}
            onChange={(e) => setForm({ ...form, equipo: e.target.value })}
          />
          {!editingUid && (
            <Input
              label="Contraseña inicial"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          )}
          {editingUid && (
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleSetPassword(editingUid)}
                className="w-full"
              >
                Asignar nueva contraseña
              </Button>
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Guardando...' : (editingUid ? 'Guardar cambios' : 'Crear usuario')}
          </Button>
          {editingUid && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
      </form>

      {newPassword && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-medium">Nueva contraseña (copiala ahora):</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="rounded bg-green-100 px-2 py-1 font-mono text-base">{newPassword}</code>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(newPassword);
                alert('Copiado al portapapeles');
              }}
            >
              Copiar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {usuarios.map((u) => (
          <div
            key={u.uid}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-gray-900">{u.username}</p>
              <p className="text-sm text-gray-500">
                {u.displayName || u.username}
                {u.email ? ` · ${u.email}` : ''}
                {u.equipo ? ` · ${u.equipo}` : ''}
              </p>
              <Badge color={u.role === 'admin' ? 'red' : 'green'}>{u.role}</Badge>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" size="sm" onClick={() => startEdit(u)}>
                Editar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleSetPassword(u.uid)}
                disabled={resetLoading === u.uid}
              >
                {resetLoading === u.uid ? 'Reseteando...' : 'Reset'}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(u.uid)}
                disabled={deletingUid === u.uid}
              >
                {deletingUid === u.uid ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
