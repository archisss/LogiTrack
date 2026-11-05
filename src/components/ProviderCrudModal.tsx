import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  MapPin,
  FileCheck,
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  AlertCircle,
  Phone,
  Mail,
  ShieldAlert,
} from 'lucide-react';
import type { Provider, ProviderAddress, ProviderAuthorizationDoc } from '../types.ts';

interface ProviderCrudModalProps {
  isOpen: boolean;
  onClose: () => void;
  providers: Provider[];
  onProvidersChanged: () => void;
}

export const ProviderCrudModal: React.FC<ProviderCrudModalProps> = ({
  isOpen,
  onClose,
  providers,
  onProvidersChanged,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [estadoFilter, setEstadoFilter] = useState<string>('ALL');
  const [ciudadFilter, setCiudadFilter] = useState<string>('ALL');

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [rfc, setRfc] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [activo, setActivo] = useState(true);

  // Address fields (Requerimiento 3)
  const [calleNumero, setCalleNumero] = useState('');
  const [colonia, setColonia] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [estado, setEstado] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');

  // Authorization Document (Requerimiento 2)
  const [authDoc, setAuthDoc] = useState<ProviderAuthorizationDoc | null>(null);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const availableEstados = React.useMemo(() => {
    const set = new Set<string>();
    providers.forEach((p) => {
      if (p.direccion?.estado?.trim()) {
        set.add(p.direccion.estado.trim());
      }
    });
    return Array.from(set).sort();
  }, [providers]);

  const availableCiudades = React.useMemo(() => {
    const set = new Set<string>();
    providers.forEach((p) => {
      if (estadoFilter !== 'ALL' && p.direccion?.estado?.trim() !== estadoFilter) return;
      if (p.direccion?.ciudad?.trim()) {
        set.add(p.direccion.ciudad.trim());
      }
    });
    return Array.from(set).sort();
  }, [providers, estadoFilter]);

  const openDocumentInNewTab = (doc: ProviderAuthorizationDoc) => {
    if (!doc?.fileDataUrl) return;
    try {
      const parts = doc.fileDataUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || doc.fileType || 'application/pdf';
      const binaryStr = atob(parts[1]);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      const link = document.createElement('a');
      link.href = doc.fileDataUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!isOpen) return null;

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setNombre('');
    setRfc('');
    setTelefono('');
    setEmail('');
    setActivo(true);
    setCalleNumero('');
    setColonia('');
    setCiudad('');
    setEstado('');
    setCodigoPostal('');
    setAuthDoc(null);
    setFeedback(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleStartEdit = (prov: Provider) => {
    setEditingId(prov.id);
    setNombre(prov.nombre);
    setRfc(prov.rfc);
    setTelefono(prov.telefono || '');
    setEmail(prov.email || '');
    setActivo(prov.activo);

    if (prov.direccion) {
      setCalleNumero(prov.direccion.calleNumero || '');
      setColonia(prov.direccion.colonia || '');
      setCiudad(prov.direccion.ciudad || '');
      setEstado(prov.direccion.estado || '');
      setCodigoPostal(prov.direccion.codigoPostal || '');
    } else {
      setCalleNumero('');
      setColonia('');
      setCiudad('');
      setEstado('');
      setCodigoPostal('');
    }

    setAuthDoc(prov.autorizacionDocumento || null);
    setIsEditing(true);
    setFeedback(null);
  };

  // Handle file upload for authorization
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      setFeedback({ type: 'error', message: 'El archivo de autorización debe ser un PDF o una imagen (JPG/PNG).' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAuthDoc({
        fileName: file.name,
        fileType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
        fileDataUrl: reader.result as string,
        uploadedAt: new Date().toISOString(),
      });
      setFeedback({ type: 'success', message: `Archivo "${file.name}" cargado exitosamente.` });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const normalizedRfc = rfc.trim().toUpperCase();

    // Requisito 4: No puede haber 2 proveedores con el mismo RFC ya que es único
    const duplicate = providers.find(
      (p) => p.id !== editingId && p.rfc.toUpperCase() === normalizedRfc
    );
    if (duplicate) {
      setFeedback({
        type: 'error',
        message: `El RFC "${normalizedRfc}" ya está registrado para "${duplicate.nombre}". El RFC debe ser único.`,
      });
      setLoading(false);
      return;
    }

    if (codigoPostal && !/^\d{5}$/.test(codigoPostal.trim())) {
      setFeedback({ type: 'error', message: 'El Código Postal (C.P.) debe ser de 5 dígitos numéricos.' });
      setLoading(false);
      return;
    }

    const direccion: ProviderAddress = {
      calleNumero: calleNumero.trim(),
      colonia: colonia.trim() || undefined,
      ciudad: ciudad.trim(),
      estado: estado.trim(),
      codigoPostal: codigoPostal.trim(),
    };

    const payload = {
      nombre: nombre.trim(),
      rfc: normalizedRfc,
      telefono: telefono.trim(),
      email: email.trim(),
      activo,
      direccion: calleNumero.trim() ? direccion : undefined,
      autorizacionDocumento: authDoc || undefined,
    };

    try {
      if (editingId) {
        // Update
        const res = await fetch(`/api/providers/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar transportista');
        setFeedback({ type: 'success', message: 'Transportista actualizado exitosamente.' });
      } else {
        // Create
        const res = await fetch('/api/providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al crear transportista');
        setFeedback({ type: 'success', message: 'Transportista creado exitosamente con RFC único.' });
      }

      onProvidersChanged();
      resetForm();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (prov: Provider) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/providers/${prov.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !prov.activo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onProvidersChanged();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (prov: Provider) => {
    if (!window.confirm(`¿Está seguro de eliminar al transportista "${prov.nombre}"?`)) return;

    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/providers/${prov.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      setFeedback({ type: 'success', message: 'Transportista eliminado exitosamente.' });
      onProvidersChanged();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredProviders = providers.filter((p) => {
    const matchesSearch =
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.rfc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.direccion?.ciudad && p.direccion.ciudad.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.direccion?.estado && p.direccion.estado.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && p.activo) ||
      (statusFilter === 'INACTIVE' && !p.activo);

    const matchesEstado =
      estadoFilter === 'ALL' ||
      (p.direccion?.estado && p.direccion.estado.trim().toLowerCase() === estadoFilter.toLowerCase());

    const matchesCiudad =
      ciudadFilter === 'ALL' ||
      (p.direccion?.ciudad && p.direccion.ciudad.trim().toLowerCase() === ciudadFilter.toLowerCase());

    return matchesSearch && matchesStatus && matchesEstado && matchesCiudad;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden my-4">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 rounded-lg border border-blue-500/40 text-blue-400">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Gestión de Transportistas / Proveedores
              </h2>
              <p className="text-xs text-slate-400">
                RFC único, dirección completa y control documental de autorización ambiental/SCT
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">✕</button>
        </div>

        {/* Feedback message */}
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
          {/* Form to Add / Edit */}
          {isEditing && (
            <form onSubmit={handleSubmit} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-600" />
                  {editingId ? 'Editar Datos del Transportista' : 'Registrar Nuevo Transportista'}
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancelar
                </button>
              </div>

              {/* Datos Generales */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                <div className="md:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Nombre / Razón Social *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Transportes Ecológicos del Centro SA de CV"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                    <span>RFC (Único) *</span>
                    <span className="text-[9px] text-blue-600 lowercase font-normal">Sin duplicados</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. TEC190820AA1"
                    value={rfc}
                    onChange={(e) => setRfc(e.target.value.toUpperCase())}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 uppercase font-mono font-bold bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    placeholder="55-1234-5678"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="contacto@transporte.mx"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Sección de Dirección (Requerimiento 3) */}
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  <span>Dirección del Transportista</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                  <div className="md:col-span-5">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Calle y número [Nombre de la vía] [Número] *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Av. de la Independencia 125"
                      value={calleNumero}
                      onChange={(e) => setCalleNumero(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Colonia o Barrio (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Parque Industrial Poniente"
                      value={colonia}
                      onChange={(e) => setColonia(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Ciudad o Municipio *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Tlalnepantla"
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Estado / Entidad *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Estado de México"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Código Postal (C.P.) *
                    </label>
                    <input
                      type="text"
                      maxLength={5}
                      placeholder="54030"
                      value={codigoPostal}
                      onChange={(e) => setCodigoPostal(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-1.5 font-mono text-center bg-white focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sección de Autorización Documental (Requerimiento 2) */}
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                    <FileCheck className="h-4 w-4 text-indigo-600" />
                    <span>Archivo de Autorización Oficial (PDF o Imagen)</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Permiso SEMARNAT, SCT, Registro Ambiental
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  {authDoc ? (
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                        {authDoc.fileType?.includes('pdf') ? (
                          <FileText className="h-5 w-5" />
                        ) : (
                          <ImageIcon className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{authDoc.fileName}</div>
                        <div className="text-[10px] text-slate-400">
                          Adjuntado el {new Date(authDoc.uploadedAt).toLocaleString('es-MX')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAuthDoc(null)}
                        className="text-xs text-red-600 hover:text-red-800 font-semibold underline ml-2"
                      >
                        Quitar archivo
                      </button>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs italic">
                      No se ha adjuntado documento de autorización aún.
                    </div>
                  )}

                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-bold transition">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{authDoc ? 'Cambiar Archivo...' : 'Subir Autorización (PDF / Imagen)...'}</span>
                    <input
                      type="file"
                      accept=".pdf, image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span className="font-semibold text-slate-800">
                    Proveedor Activo (Habilitado para asignación de órdenes)
                  </span>
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
                    disabled={loading || !nombre.trim() || !rfc.trim()}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-xs disabled:opacity-50"
                  >
                    {editingId ? 'Guardar Cambios' : 'Registrar Transportista'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Action bar and Search */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por transportista, RFC, ciudad..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 pl-8 pr-3 py-1.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Filtro Estado / Entidad */}
              <select
                value={estadoFilter}
                onChange={(e) => {
                  setEstadoFilter(e.target.value);
                  setCiudadFilter('ALL');
                }}
                className="text-xs rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Todos los Estados</option>
                {availableEstados.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              {/* Filtro Ciudad o Municipio */}
              <select
                value={ciudadFilter}
                onChange={(e) => setCiudadFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">Todas las Ciudades/Municipios</option>
                {availableCiudades.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none"
              >
                <option value="ALL">Estatus: Todos</option>
                <option value="ACTIVE">Solo Activos</option>
                <option value="INACTIVE">Solo Inactivos</option>
              </select>
            </div>

            {!isEditing && (
              <button
                onClick={handleStartCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <Plus className="h-4 w-4" />
                Nuevo Transportista
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-2.5 px-4">Transportista & RFC Único</th>
                  <th className="py-2.5 px-4">Dirección Completa</th>
                  <th className="py-2.5 px-4">Autorización</th>
                  <th className="py-2.5 px-4 text-center">Estado</th>
                  <th className="py-2.5 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProviders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No se encontraron transportistas.
                    </td>
                  </tr>
                ) : (
                  filteredProviders.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{p.nombre}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            RFC: {p.rfc}
                          </span>
                        </div>
                        {(p.telefono || p.email) && (
                          <div className="text-[11px] text-slate-400 mt-1 flex gap-3">
                            {p.telefono && <span>Tel: {p.telefono}</span>}
                            {p.email && <span>Email: {p.email}</span>}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 max-w-[260px]">
                        {p.direccion?.calleNumero ? (
                          <div>
                            <div className="font-medium text-slate-800">
                              {p.direccion.calleNumero}
                              {p.direccion.colonia ? `, ${p.direccion.colonia}` : ''}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {p.direccion.ciudad}, {p.direccion.estado} &bull; C.P. {p.direccion.codigoPostal}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Sin dirección registrada</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {p.autorizacionDocumento ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <FileCheck className="h-3 w-3 text-indigo-600" />
                              {p.autorizacionDocumento.fileName}
                            </span>
                            <button
                              onClick={() => {
                                if (p.autorizacionDocumento) {
                                  openDocumentInNewTab(p.autorizacionDocumento);
                                }
                              }}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 underline font-medium"
                              title="Abrir autorización en una nueva pestaña"
                            >
                              Ver
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Pendiente de subir</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition ${
                            p.activo
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                          }`}
                          title="Haga clic para alternar estado"
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              p.activo ? 'bg-emerald-600' : 'bg-slate-400'
                            }`}
                          />
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(p)}
                            className="p-1.5 text-slate-600 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition"
                            title="Editar transportista, dirección y autorización"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="p-1.5 text-slate-600 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                            title="Eliminar transportista"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>El RFC es único por transportista. La dirección y autorización quedan registradas en el perfil.</span>
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
