import { useMemo, useState } from 'react';
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

interface FormState {
  username: string;
  email: string;
  displayName: string;
  role: Rol;
  equipo: string;
  password: string;
}

const INITIAL_FORM: FormState = { username: '', email: '', displayName: '', role: 'capitan', equipo: '', password: '' };

interface UsuarioFormProps {
  form: FormState;
  editingUid: string | null;
  submitting: boolean;
  error: string | null;
  success: string | null;
  onFormChange: (form: FormState) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  onSetPassword: (uid: string) => void;
}

const UsuarioForm = ({ form, editingUid, submitting, error, success, onFormChange, onSubmit, onCancel, onSetPassword }: UsuarioFormProps) => (
  <form onSubmit={onSubmit} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <h3 className="mb-4 text-lg font-semibold text-gray-900">
      {editingUid ? 'Editar usuario' : 'Nuevo usuario'}
    </h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <Input
        label="Usuario"
        value={form.username}
        onChange={(e) => {
          const value = e.target.value.toLowerCase().replace(/[^a-z]/g, '');
          onFormChange({ ...form, username: value });
        }}
        required
      />
      <Input
        label="Correo (referencia - opcional)"
        type="email"
        value={form.email}
        onChange={(e) => onFormChange({ ...form, email: e.target.value })}
        placeholder="Opcional"
      />
      <Input
        label="Nombre"
        value={form.displayName}
        onChange={(e) => onFormChange({ ...form, displayName: e.target.value })}
      />
      <Select
        label="Rol"
        value={form.role}
        options={ROLES}
        onChange={(e) => onFormChange({ ...form, role: e.target.value as Rol })}
      />
      <Input
        label="Equipo"
        value={form.equipo}
        onChange={(e) => onFormChange({ ...form, equipo: e.target.value })}
      />
      {!editingUid && (
        <Input
          label="Contraseña inicial"
          type="password"
          value={form.password}
          onChange={(e) => onFormChange({ ...form, password: e.target.value })}
          required
        />
      )}
      {editingUid && (
        <div className="sm:col-span-2">
          <Button type="button" variant="secondary" onClick={() => onSetPassword(editingUid)} className="w-full">
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
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      )}
    </div>
    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
  </form>
);

interface UsuarioCardProps {
  usuario: Usuario;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}

const UsuarioCard = ({ usuario: u, onEdit, onDelete, deleting }: UsuarioCardProps) => (
  <div className="flex flex-row items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-semibold text-gray-900">{u.displayName || u.username}</span>
        <Badge color={u.role === 'admin' ? 'red' : 'green'}>{u.role}</Badge>
      </div>
      <p className="truncate text-xs text-gray-500">
        <span className="text-gray-400">@{u.username}</span>
        {u.equipo ? ` · ${u.equipo}` : ''}
        {u.email ? ` · ${u.email}` : ''}
      </p>
    </div>
    <div className="flex shrink-0 gap-1">
      <Button variant="secondary" size="xs" onClick={onEdit}>
        Editar
      </Button>
      <Button variant="danger" size="xs" onClick={onDelete} disabled={deleting}>
        {deleting ? '...' : 'Eliminar'}
      </Button>
    </div>
  </div>
);

export const UsuariosPanel = () => {
  const { usuarios, loading, create, update, remove, setPassword } = useUsuarios();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const usuariosFiltrados = useMemo(() => {
    const termino = busqueda.toLowerCase().trim();
    let lista = [...usuarios];
    lista.sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username, 'es'));
    if (!termino) return lista;
    return lista.filter(
      (u) =>
        u.username.toLowerCase().includes(termino) ||
        (u.displayName && u.displayName.toLowerCase().includes(termino))
    );
  }, [usuarios, busqueda]);

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingUid(null);
    setNewPassword(null);
    setShowForm(false);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const cleanUsername = form.username.trim().toLowerCase();
    if (!cleanUsername) { setError('El nombre de usuario es obligatorio.'); setSubmitting(false); return; }
    if (cleanUsername.length < 2) { setError('El nombre de usuario debe tener al menos 2 caracteres.'); setSubmitting(false); return; }
    if (!/^[a-z]+$/.test(cleanUsername)) { setError('El nombre de usuario solo puede contener letras minúsculas.'); setSubmitting(false); return; }
    if (!editingUid && (!form.password || form.password.length < 6)) { setError('La contraseña debe tener al menos 6 caracteres.'); setSubmitting(false); return; }

    try {
      if (editingUid) {
        await update(editingUid, { username: cleanUsername, email: form.email || '', displayName: form.displayName || '', role: form.role, equipo: form.equipo || '' });
      } else {
        await create({ username: cleanUsername, email: form.email || '', displayName: form.displayName || '', role: form.role, equipo: form.equipo || '', password: form.password });
      }
      setSuccess(editingUid ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
      setTimeout(() => resetForm(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el usuario.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (u: Usuario) => {
    setEditingUid(u.uid);
    setNewPassword(null);
    setForm({ username: u.username, email: u.email, displayName: u.displayName, role: u.role, equipo: u.equipo, password: '' });
  };

  const handleSetPassword = async (uid: string) => {
    const newPass = prompt('Ingresá la nueva contraseña (mínimo 6 caracteres):');
    if (!newPass || newPass.length < 6) { alert('La contraseña debe tener al menos 6 caracteres'); return; }
    try {
      const result = await setPassword(uid, newPass);
      setNewPassword(result);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cambiar la contraseña');
    }
  };

  const handleDelete = async (uid: string) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    setDeletingUid(uid);
    try { await remove(uid); } catch (err) { alert(err instanceof Error ? err.message : 'Error al eliminar el usuario'); } finally { setDeletingUid(null); }
  };

  if (loading) return <Spinner className="h-8 w-8 text-green-600" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Usuarios</h3>
        {!showForm && !editingUid && (
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
            + Agregar usuario
          </Button>
        )}
      </div>

      {showForm && (
        <UsuarioForm
          form={form}
          editingUid={null}
          submitting={submitting}
          error={error}
          success={success}
          onFormChange={setForm}
          onSubmit={handleSubmit}
          onCancel={resetForm}
          onSetPassword={handleSetPassword}
        />
      )}

      {newPassword && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          <p className="font-medium">Nueva contraseña (copiala ahora):</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="rounded bg-green-100 px-2 py-1 font-mono text-base">{newPassword}</code>
            <Button type="button" size="xs" onClick={() => { navigator.clipboard.writeText(newPassword); alert('Copiado al portapapeles'); }}>
              Copiar
            </Button>
          </div>
        </div>
      )}

      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar usuario..."
          className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
        />
      </div>

      <div className="space-y-2">
        {usuariosFiltrados.map((u) => (
          <div key={u.uid}>
            <UsuarioCard
              usuario={u}
              onEdit={() => startEdit(u)}
              onDelete={() => handleDelete(u.uid)}
              deleting={deletingUid === u.uid}
            />
            {editingUid === u.uid && (
              <div className="mt-2">
                <UsuarioForm
                  form={form}
                  editingUid={editingUid}
                  submitting={submitting}
                  error={error}
                  success={success}
                  onFormChange={setForm}
                  onSubmit={handleSubmit}
                  onCancel={resetForm}
                  onSetPassword={handleSetPassword}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
