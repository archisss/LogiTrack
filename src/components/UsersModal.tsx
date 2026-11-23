import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Shield,
  ClipboardList,
  Truck,
  Building2,
  KeyRound,
} from 'lucide-react';
import type { AppUser, Role, Provider, Client } from '../types.ts';
import { apiFetch } from '../utils/api.ts';

interface UsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  providers: Provider[];
  clients: Client[];
}

const ROLE_LABELS: Record<Role, { label: string; badgeClass: string }> = {
  ADMIN: {
    label: 'Administrador',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  },
  USER: {
    label: 'Usuario',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  PROVIDER: {
    label: 'Proveedor',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  CLIENT: {
    label: 'Cliente',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
};

export const UsersModal: React.FC<UsersModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  providers,
  clients,
}) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL');

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('USER');
  const [entityId, setEntityId] = useState<string>('');
  const [activo, setActivo] = useState(true);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar usuarios');
      setUsers(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        u.nombre.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.entityName && u.entityName.toLowerCase().includes(q));
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  if (!isOpen) return null;

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setNombre('');
    setEmail('');
    setPassword('');
    setRole('USER');
    setEntityId('');
    setActivo(true);
    setFeedback(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleStartEdit = (u: AppUser) => {
    setEditingId(u.id);
    setNombre(u.nombre);
    setEmail(u.email);
    setPassword('');
    setRole(u.role);
    setEntityId(u.entityId || '');
    setActivo(u.activo);
    setIsEditing(true);
    setFeedback(null);
  };

  const handleRoleChange = (nextRole: Role) => {
    setRole(nextRole);
    if (nextRole === 'PROVIDER') {
      setEntityId(providers[0]?.id || '');
    } else if (nextRole === 'CLIENT') {
      setEntityId(clients[0]?.id || '');
    } else {
      setEntityId('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    if (!nombre.trim() || !email.trim()) {
      setFeedback({ type: 'error', message: 'El nombre y el correo electrónico son obligatorios.' });
      setLoading(false);
      return;
    }

    if (!editingId && password.length < 6) {
      setFeedback({ type: 'error', message: 'La contraseña debe tener al menos 6 caracteres.' });
      setLoading(false);
      return;
    }

    if (editingId && password.length > 0 && password.length < 6) {
      setFeedback({ type: 'error', message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      setLoading(false);
      return;
    }

    if ((role === 'PROVIDER' || role === 'CLIENT') && !entityId) {
      setFeedback({ type: 'error', message: 'Debe seleccionar el transportista o cliente vinculado al usuario.' });
      setLoading(false);
      return;
    }

    const payload: Record<string, any> = {
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      role,
      entityId: role === 'PROVIDER' || role === 'CLIENT' ? entityId : null,
      activo,
    };
    if (password.trim()) {
      payload.password = password;
    }

    try {
      if (editingId) {
        const res = await apiFetch(`/api/users/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar usuario');
        setFeedback({ type: 'success', message: 'Usuario actualizado en PostgreSQL.' });
      } else {
        const res = await apiFetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al crear usuario');
        setFeedback({ type: 'success', message: 'Usuario registrado exitosamente en PostgreSQL.' });
      }
      await loadUsers();
      resetForm();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (u: AppUser) => {
    if (u.id === currentUserId) {
      setFeedback({ type: 'error', message: 'No puede desactivar su propio usuario activo.' });
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/api/users/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !u.activo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar estado');
      await loadUsers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (u: AppUser) => {
    if (u.id === currentUserId) {
      setFeedback({ type: 'error', message: 'No puede eliminar su propio usuario administrador.' });
      return;
    }
    if (!window.confirm(`¿Está seguro de eliminar al usuario "${u.nombre}" (${u.email})?`)) return;

    setLoading(true);
    setFeedback(null);
    try {
      const res = await apiFetch(`/api/users/${u.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar usuario');
      setFeedback({ type: 'success', message: 'Usuario eliminado exitosamente.' });
      await loadUsers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden my-4">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/30 rounded-lg border border-indigo-500/40 text-indigo-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Administración de Usuarios y Perfiles de Acceso
              </h2>
              <p className="text-xs text-slate-400">
                Control de cuentas para Administrador, Usuario Operativo, Transportistas y Clientes
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            ✕
          </button>
        </div>

        {/* Feedback banner */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-red-50 text-red-800 border-b border-red-200'
            }`}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)}>✕</button>
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Create / Edit Form */}
          {isEditing && (
            <form onSubmit={handleSubmit} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-indigo-600" />
                  {editingId ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                <div className="md:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Laura Hernández"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Correo Electrónico (Login) *
                  </label>
                  <input
                    type="email"
                    placeholder="usuario@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    {editingId ? 'Nueva Contraseña (opcional)' : 'Contraseña *'}
                  </label>
                  <input
                    type="password"
                    placeholder={editingId ? 'Dejar vacío para conservar' : 'Mínimo 6 caracteres'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required={!editingId}
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Perfil / Rol *
                  </label>
                  <select
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value as Role)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="ADMIN">Administrador (Control Total)</option>
                    <option value="USER">Usuario (Operación y Reportes)</option>
                    <option value="PROVIDER">Proveedor (Transportista)</option>
                    <option value="CLIENT">Cliente (Empresa)</option>
                  </select>
                </div>

                {(role === 'PROVIDER' || role === 'CLIENT') && (
                  <div className="md:col-span-8">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      {role === 'PROVIDER' ? 'Transportista Vinculado *' : 'Empresa Cliente Vinculada *'}
                    </label>
                    <select
                      value={entityId}
                      onChange={(e) => setEntityId(e.target.value)}
                      className="w-full text-xs font-semibold rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    >
                      <option value="">-- Seleccione --</option>
                      {role === 'PROVIDER'
                        ? providers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre} (RFC: {p.rfc})
                            </option>
                          ))
                        : clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre} (RFC: {c.rfc})
                            </option>
                          ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="font-semibold text-slate-800">Usuario Activo</span>
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3.5 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-600 hover:bg-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-xs disabled:opacity-50"
                  >
                    {editingId ? 'Guardar Cambios' : 'Crear Usuario'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, correo o empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 pl-8 pr-3 py-1.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="text-xs rounded-xl border border-slate-300 px-3 py-1.5 bg-white text-slate-700 font-medium focus:outline-none"
              >
                <option value="ALL">Todos los Perfiles</option>
                <option value="ADMIN">Administrador</option>
                <option value="USER">Usuario</option>
                <option value="PROVIDER">Proveedor</option>
                <option value="CLIENT">Cliente</option>
              </select>
            </div>

            {!isEditing && (
              <button
                onClick={handleStartCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <Plus className="h-4 w-4" />
                Nuevo Usuario
              </button>
            )}
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-2.5 px-4">Usuario & Correo</th>
                  <th className="py-2.5 px-4">Perfil</th>
                  <th className="py-2.5 px-4">Empresa Vinculada</th>
                  <th className="py-2.5 px-4 text-center">Estado</th>
                  <th className="py-2.5 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No se encontraron usuarios registrados.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const roleInfo = ROLE_LABELS[u.role];
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">
                            {u.nombre}
                            {u.id === currentUserId && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                                Tú
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${roleInfo.badgeClass}`}
                          >
                            {u.role === 'ADMIN' && <Shield className="h-3 w-3" />}
                            {u.role === 'USER' && <ClipboardList className="h-3 w-3" />}
                            {u.role === 'PROVIDER' && <Truck className="h-3 w-3" />}
                            {u.role === 'CLIENT' && <Building2 className="h-3 w-3" />}
                            {roleInfo.label}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-700">
                          {u.entityName ? (
                            <span className="font-medium">{u.entityName}</span>
                          ) : (
                            <span className="text-slate-400 italic">Acceso general del sistema</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition ${
                              u.activo
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleStartEdit(u)}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
                              title="Editar usuario"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            {u.id !== currentUserId && (
                              <button
                                onClick={() => handleDelete(u)}
                                className="p-1.5 text-slate-600 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                                title="Eliminar usuario"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>Total: {filteredUsers.length} usuario(s) en PostgreSQL</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
