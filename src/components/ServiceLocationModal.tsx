import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Plus,
  Search,
  Edit2,
  Trash2,
  Building2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Globe,
  Navigation,
} from 'lucide-react';
import type { ServiceLocation, ServiceLocationAddress } from '../types.ts';

interface ServiceLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceLocations: ServiceLocation[];
  onLocationsChanged: () => void;
}

export const ServiceLocationModal: React.FC<ServiceLocationModalProps> = ({
  isOpen,
  onClose,
  serviceLocations,
  onLocationsChanged,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [divisionFilter, setDivisionFilter] = useState<string>('TODAS');
  const [estadoFilter, setEstadoFilter] = useState<string>('TODOS');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [division, setDivision] = useState('');
  const [cedi, setCedi] = useState('');
  const [calleNumero, setCalleNumero] = useState('');
  const [colonia, setColonia] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [estado, setEstado] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [activo, setActivo] = useState(true);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Available unique divisions and states (Hooks placed at top before any early return)
  const availableDivisions = useMemo(() => {
    const set = new Set<string>();
    serviceLocations.forEach((loc) => {
      if (loc.division?.trim()) set.add(loc.division.trim());
    });
    return Array.from(set).sort();
  }, [serviceLocations]);

  const availableEstados = useMemo(() => {
    const set = new Set<string>();
    serviceLocations.forEach((loc) => {
      if (loc.direccion?.estado?.trim()) set.add(loc.direccion.estado.trim());
    });
    return Array.from(set).sort();
  }, [serviceLocations]);

  const filteredLocations = useMemo(() => {
    return serviceLocations.filter((loc) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        loc.cedi.toLowerCase().includes(q) ||
        loc.division.toLowerCase().includes(q) ||
        loc.direccion.ciudad.toLowerCase().includes(q) ||
        loc.direccion.estado.toLowerCase().includes(q) ||
        loc.direccion.calleNumero.toLowerCase().includes(q) ||
        (loc.direccion.colonia && loc.direccion.colonia.toLowerCase().includes(q)) ||
        loc.direccion.codigoPostal.includes(q);

      const matchesDivision = divisionFilter === 'TODAS' || loc.division.toLowerCase() === divisionFilter.toLowerCase();
      const matchesEstado = estadoFilter === 'TODOS' || loc.direccion.estado.toLowerCase() === estadoFilter.toLowerCase();
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && loc.activo) ||
        (statusFilter === 'INACTIVE' && !loc.activo);

      return matchesSearch && matchesDivision && matchesEstado && matchesStatus;
    });
  }, [serviceLocations, searchTerm, divisionFilter, estadoFilter, statusFilter]);

  if (!isOpen) return null;

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setDivision('');
    setCedi('');
    setCalleNumero('');
    setColonia('');
    setCiudad('');
    setEstado('');
    setCodigoPostal('');
    setActivo(true);
    setFeedback(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleStartEdit = (loc: ServiceLocation) => {
    setEditingId(loc.id);
    setDivision(loc.division);
    setCedi(loc.cedi);
    setCalleNumero(loc.direccion.calleNumero);
    setColonia(loc.direccion.colonia || '');
    setCiudad(loc.direccion.ciudad);
    setEstado(loc.direccion.estado);
    setCodigoPostal(loc.direccion.codigoPostal);
    setActivo(loc.activo);
    setIsEditing(true);
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    if (!division.trim()) {
      setFeedback({ type: 'error', message: 'La división es requerida (ej. Centro, Sur, Norte).' });
      setLoading(false);
      return;
    }
    if (!cedi.trim()) {
      setFeedback({ type: 'error', message: 'El nombre o código del CEDI es requerido (ej. TLALPIZAHUAC).' });
      setLoading(false);
      return;
    }
    if (!calleNumero.trim() || !ciudad.trim() || !estado.trim() || !codigoPostal.trim()) {
      setFeedback({ type: 'error', message: 'Complete todos los campos obligatorios de la dirección del CEDI.' });
      setLoading(false);
      return;
    }

    if (!/^\d{5}$/.test(codigoPostal.trim())) {
      setFeedback({ type: 'error', message: 'El Código Postal (C.P.) debe ser de 5 dígitos numéricos.' });
      setLoading(false);
      return;
    }

    const payload = {
      division: division.trim(),
      cedi: cedi.trim().toUpperCase(),
      direccion: {
        calleNumero: calleNumero.trim(),
        colonia: colonia.trim() || undefined,
        ciudad: ciudad.trim(),
        estado: estado.trim(),
        codigoPostal: codigoPostal.trim(),
      },
      activo,
    };

    try {
      if (editingId) {
        const res = await fetch(`/api/service-locations/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar ubicación');
        setFeedback({ type: 'success', message: 'Ubicación / CEDI actualizado exitosamente.' });
      } else {
        const res = await fetch('/api/service-locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al crear ubicación');
        setFeedback({ type: 'success', message: 'Ubicación / CEDI registrado exitosamente.' });
      }

      onLocationsChanged();
      resetForm();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (loc: ServiceLocation) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/service-locations/${loc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !loc.activo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onLocationsChanged();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (loc: ServiceLocation) => {
    if (!window.confirm(`¿Está seguro de eliminar el CEDI "${loc.cedi}" (División ${loc.division})?`)) return;

    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/service-locations/${loc.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      setFeedback({ type: 'success', message: 'Ubicación / CEDI eliminado exitosamente.' });
      onLocationsChanged();
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
            <div className="p-2 bg-purple-600/30 rounded-lg border border-purple-500/40 text-purple-400">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Catálogo de Ubicaciones para Servicios (CEDIs)
              </h2>
              <p className="text-xs text-slate-400">
                Control de centros de distribución, divisiones operativas y direcciones para recolección
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
          {/* Form Create / Edit */}
          {isEditing && (
            <form onSubmit={handleSubmit} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-purple-600" />
                  {editingId ? 'Editar Ubicación / CEDI' : 'Registrar Nueva Ubicación para Servicios'}
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                >
                  Cancelar
                </button>
              </div>

              {/* División y CEDI */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                <div className="md:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    División Operativa *
                  </label>
                  <input
                    type="text"
                    list="division-suggestions"
                    placeholder="Ej. Centro, Sur, Norte, Occidente, Bajío..."
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    required
                  />
                  <datalist id="division-suggestions">
                    <option value="Centro" />
                    <option value="Sur" />
                    <option value="Norte" />
                    <option value="Oriente" />
                    <option value="Poniente" />
                    <option value="Occidente" />
                    <option value="Bajío" />
                    <option value="Sureste" />
                  </datalist>
                </div>

                <div className="md:col-span-7">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Nombre o Clave del CEDI *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. TLALPIZAHUAC, AMECA-MECA, TLALNEPANTLA..."
                    value={cedi}
                    onChange={(e) => setCedi(e.target.value.toUpperCase())}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 uppercase font-bold tracking-wide bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    required
                  />
                </div>
              </div>

              {/* Dirección del CEDI */}
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  <span>Dirección del CEDI</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                  <div className="md:col-span-6">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Calle y número [Nombre de la vía] [Número] *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Av. de la Independencia 125"
                      value={calleNumero}
                      onChange={(e) => setCalleNumero(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-1.5 bg-white focus:ring-1 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div className="md:col-span-6">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Colonia o Barrio (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Parque Industrial Poniente"
                      value={colonia}
                      onChange={(e) => setColonia(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-1.5 bg-white focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div className="md:col-span-5">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Ciudad o Municipio *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Tlalnepantla"
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-1.5 bg-white focus:ring-1 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Estado / Entidad *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Estado de México"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-1.5 bg-white focus:ring-1 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Código Postal (C.P.) *
                    </label>
                    <input
                      type="text"
                      maxLength={5}
                      placeholder="54030"
                      value={codigoPostal}
                      onChange={(e) => setCodigoPostal(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-xs rounded-xl border border-slate-300 px-3 py-1.5 font-mono text-center bg-white focus:ring-1 focus:ring-purple-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                  />
                  <span className="font-semibold text-slate-800">
                    CEDI Activo (Habilitado para asignación de órdenes de servicio)
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
                    disabled={loading || !division.trim() || !cedi.trim() || !calleNumero.trim()}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-xs disabled:opacity-50"
                  >
                    {editingId ? 'Guardar Cambios' : 'Registrar Ubicación'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Action bar and Search */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por CEDI, división, municipio, dirección o C.P..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 pl-8 pr-3 py-1.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Filtro División */}
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="TODAS">Todas las Divisiones</option>
                {availableDivisions.map((div) => (
                  <option key={div} value={div}>
                    División: {div}
                  </option>
                ))}
              </select>

              {/* Filtro Estado */}
              <select
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="TODOS">Todos los Estados</option>
                {availableEstados.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              {/* Filtro Estatus */}
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
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <Plus className="h-4 w-4" />
                Nueva Ubicación / CEDI
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-2.5 px-4">CEDI & División</th>
                  <th className="py-2.5 px-4">Dirección Oficial del CEDI</th>
                  <th className="py-2.5 px-4 text-center">Estado</th>
                  <th className="py-2.5 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLocations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No se encontraron ubicaciones de servicio que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredLocations.map((loc) => (
                    <tr key={loc.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm tracking-wide">
                          {loc.cedi}
                        </div>
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            División: {loc.division}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 max-w-[360px]">
                        <div className="font-medium text-slate-800">
                          {loc.direccion.calleNumero}
                          {loc.direccion.colonia ? `, Col. ${loc.direccion.colonia}` : ''}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>
                            {loc.direccion.ciudad}, {loc.direccion.estado} &bull; C.P. {loc.direccion.codigoPostal}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(loc)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition ${
                            loc.activo
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                          }`}
                          title="Haga clic para alternar estado"
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              loc.activo ? 'bg-emerald-600' : 'bg-slate-400'
                            }`}
                          />
                          {loc.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(loc)}
                            className="p-1.5 text-slate-600 hover:text-purple-600 rounded-lg hover:bg-purple-50 transition"
                            title="Editar CEDI y dirección"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(loc)}
                            className="p-1.5 text-slate-600 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                            title="Eliminar CEDI"
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
          <span>{filteredLocations.length} ubicaciones registradas en el catálogo.</span>
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
