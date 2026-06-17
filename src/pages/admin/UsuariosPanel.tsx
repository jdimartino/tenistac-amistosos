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
  const { usuarios, loading, create, update, remove, resetPassword } = useUsuarios();
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    role: 'capitan' as Rol,
    equipo: '',
    password: '',
  });
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);

  const resetForm = () => {
    setForm({ email: '', displayName: '', role: 'capitan', equipo: '', password: '' });
    setEditingUid(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (editingUid) {
      await update(editingUid, {
        displayName: form.displayName,
        role: form.role,
        equipo: form.equipo,
      });
    } else {
      await create({
        email: form.email,
        displayName: form.displayName,
        role: form.role,
        equipo: form.equipo,
        password: form.password,
      });
    }
    resetForm();
  };

  const startEdit = (u: Usuario) => {
    setEditingUid(u.uid);
    setResetLink(null);
    setForm({
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      equipo: u.equipo,
      password: '',
    });
  };

  const handleReset = async (uid: string) => {
    const link = await resetPassword(uid);
    setResetLink(link);
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
            label="Correo"
            type="email"
            value={form.email}
            disabled={!!editingUid}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label="Nombre"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            required
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
        </div>
        <div className="mt-4 flex gap-3">
          <Button type="submit">{editingUid ? 'Guardar cambios' : 'Crear usuario'}</Button>
          {editingUid && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          )}
        </div>
      </form>

      {resetLink && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-medium">Link para restablecer contraseña:</p>
          <a
            href={resetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all underline"
          >
            {resetLink}
          </a>
        </div>
      )}

      <div className="space-y-3">
        {usuarios.map((u) => (
          <div
            key={u.uid}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-gray-900">{u.displayName}</p>
              <p className="text-sm text-gray-500">
                {u.email} · {u.equipo}
              </p>
              <Badge color={u.role === 'admin' ? 'red' : 'green'}>{u.role}</Badge>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" size="sm" onClick={() => startEdit(u)}>
                Editar
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleReset(u.uid)}>
                Reset
              </Button>
              <Button variant="danger" size="sm" onClick={() => remove(u.uid)}>
                Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
