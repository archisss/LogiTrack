import React, { useState, useMemo } from 'react';
import {
  Search,
  Truck,
  MapPin,
  Check,
  X,
  DollarSign,
  ShieldCheck,
  Building,
  Phone,
  Mail,
  Filter,
} from 'lucide-react';
import type { Provider } from '../types.ts';

interface ProviderSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  providers: Provider[];
  selectedProviderId: string | null;
  currentCostoProveedor: string;
  onSelectProvider: (providerId: string | null, costo: string) => void;
}

export const ProviderSelectModal: React.FC<ProviderSelectModalProps> = ({
  isOpen,
  onClose,
  providers,
  selectedProviderId,
  currentCostoProveedor,
  onSelectProvider,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEstado, setSelectedEstado] = useState<string>('TODOS');
  const [selectedCiudad, setSelectedCiudad] = useState<string>('TODOS');
  const [tempProviderId, setTempProviderId] = useState<string | null>(selectedProviderId);
  const [tempCosto, setTempCosto] = useState<string>(currentCostoProveedor || '');
  const [costoError, setCostoError] = useState<string | null>(null);

  // Sync state whenever modal opens or props change
  React.useEffect(() => {
    if (isOpen) {
      setTempProviderId(selectedProviderId);
      setTempCosto(currentCostoProveedor || '');
      setCostoError(null);
    }
  }, [isOpen, selectedProviderId, currentCostoProveedor]);

  // Extract unique estados and ciudades for filters (only active providers)
  const activeProviders = useMemo(() => {
    return providers.filter((p) => p.activo);
  }, [providers]);

  const uniqueEstados = useMemo(() => {
    const set = new Set<string>();
    activeProviders.forEach((p) => {
      if (p.direccion?.estado) set.add(p.direccion.estado.trim());
    });
    return Array.from(set).sort();
  }, [activeProviders]);

  const uniqueCiudades = useMemo(() => {
    const set = new Set<string>();
    activeProviders.forEach((p) => {
      if (selectedEstado === 'TODOS' || p.direccion?.estado?.trim() === selectedEstado) {
        if (p.direccion?.ciudad) set.add(p.direccion.ciudad.trim());
      }
    });
    return Array.from(set).sort();
  }, [activeProviders, selectedEstado]);

  const filteredProviders = useMemo(() => {
    return activeProviders.filter((p) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        p.nombre.toLowerCase().includes(q) ||
        p.rfc.toLowerCase().includes(q) ||
        (p.direccion?.calleNumero && p.direccion.calleNumero.toLowerCase().includes(q)) ||
        (p.direccion?.colonia && p.direccion.colonia.toLowerCase().includes(q)) ||
        (p.direccion?.ciudad && p.direccion.ciudad.toLowerCase().includes(q)) ||
        (p.direccion?.estado && p.direccion.estado.toLowerCase().includes(q)) ||
        (p.direccion?.codigoPostal && p.direccion.codigoPostal.includes(q));

      const matchesEstado =
        selectedEstado === 'TODOS' || (p.direccion?.estado && p.direccion.estado.trim() === selectedEstado);

      const matchesCiudad =
        selectedCiudad === 'TODOS' || (p.direccion?.ciudad && p.direccion.ciudad.trim() === selectedCiudad);

      return matchesSearch && matchesEstado && matchesCiudad;
    });
  }, [activeProviders, searchTerm, selectedEstado, selectedCiudad]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (tempProviderId) {
      if (tempCosto === '' || isNaN(Number(tempCosto)) || Number(tempCosto) < 0) {
        setCostoError('Debe ingresar un costo válido para el proveedor seleccionado (mayor o igual a 0).');
        return;
      }
    }
    setCostoError(null);
    onSelectProvider(tempProviderId, tempProviderId ? tempCosto : '');
    onClose();
  };

  const handleClearSelection = () => {
    setTempProviderId(null);
    setTempCosto('');
    setCostoError(null);
  };

  const selectedProviderObj = activeProviders.find((p) => p.id === tempProviderId);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 rounded-xl border border-blue-400/30 text-blue-300">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Búsqueda y Asignación de Transportista
              </h2>
              <p className="text-xs text-blue-200">
                Filtre por estado, municipio/ciudad o busque por RFC / Razón Social y defina el costo del proveedor.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-blue-300 hover:text-white rounded-lg transition"
          >
            ✕
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="md:col-span-6 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por transportista, RFC, dirección, C.P...."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
              />
            </div>

            {/* Filter: Estado / Entidad federativa */}
            <div className="md:col-span-3">
              <div className="relative">
                <select
                  value={selectedEstado}
                  onChange={(e) => {
                    setSelectedEstado(e.target.value);
                    setSelectedCiudad('TODOS');
                  }}
                  className="w-full py-2 px-3 text-xs rounded-xl border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                >
                  <option value="TODOS">Todos los Estados ({uniqueEstados.length})</option>
                  {uniqueEstados.map((est) => (
                    <option key={est} value={est}>
                      {est}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter: Ciudad / Municipio */}
            <div className="md:col-span-3">
              <div className="relative">
                <select
                  value={selectedCiudad}
                  onChange={(e) => setSelectedCiudad(e.target.value)}
                  className="w-full py-2 px-3 text-xs rounded-xl border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                >
                  <option value="TODOS">Todas las Ciudades / Municipios</option>
                  {uniqueCiudades.map((cd) => (
                    <option key={cd} value={cd}>
                      {cd}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quick counts */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-blue-600" />
              Mostrando <strong className="text-slate-800">{filteredProviders.length}</strong> de{' '}
              {activeProviders.length} proveedores activos
            </span>
            {(searchTerm || selectedEstado !== 'TODOS' || selectedCiudad !== 'TODOS') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedEstado('TODOS');
                  setSelectedCiudad('TODOS');
                }}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Provider List */}
        <div className="p-4 overflow-y-auto flex-1 max-h-[46vh] space-y-2.5">
          {filteredProviders.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <Truck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">
                No se encontraron proveedores activos con los filtros especificados.
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Intente cambiando la búsqueda o restableciendo el estado y municipio.
              </p>
            </div>
          ) : (
            filteredProviders.map((prov) => {
              const isSelected = tempProviderId === prov.id;
              const hasAuth = Boolean(prov.autorizacionDocumento);
              const dir = prov.direccion;

              return (
                <div
                  key={prov.id}
                  onClick={() => setTempProviderId(prov.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer relative ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                      : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{prov.nombre}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300">
                          RFC: {prov.rfc}
                        </span>
                        {hasAuth ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="h-3 w-3" />
                            Autorización Vigente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Sin Doc Autorización
                          </span>
                        )}
                      </div>

                      {/* Dirección del proveedor */}
                      <div className="mt-1.5 text-xs text-slate-600 flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          {dir ? (
                            <span>
                              <strong>{dir.calleNumero}</strong>
                              {dir.colonia ? `, Col. ${dir.colonia}` : ''}
                              {dir.ciudad ? ` &bull; ${dir.ciudad}` : ''}
                              {dir.estado ? `, ${dir.estado}` : ''}
                              {dir.codigoPostal ? ` &bull; C.P. ${dir.codigoPostal}` : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Dirección no registrada</span>
                          )}
                        </div>
                      </div>

                      {/* Contacto */}
                      {(prov.telefono || prov.email) && (
                        <div className="mt-1 flex items-center gap-4 text-[11px] text-slate-500">
                          {prov.telefono && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-slate-400" />
                              {prov.telefono}
                            </span>
                          )}
                          {prov.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-slate-400" />
                              {prov.email}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Radio / Selection Indicator */}
                    <div className="shrink-0 flex items-center">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-3" />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Provider & Cost Section */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
          {costoError && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
              {costoError}
            </div>
          )}

          {tempProviderId ? (
            <div className="bg-white p-3.5 rounded-xl border border-blue-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Truck className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {selectedProviderObj?.nombre}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    RFC: {selectedProviderObj?.rfc} &bull; {selectedProviderObj?.direccion?.ciudad || 'Sin ciudad'},{' '}
                    {selectedProviderObj?.direccion?.estado || 'Sin estado'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                  Costo Proveedor ($ MXN) *
                </label>
                <div className="relative w-36">
                  <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={tempCosto}
                    onChange={(e) => {
                      setTempCosto(e.target.value);
                      setCostoError(null);
                    }}
                    className="w-full pl-6 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono font-bold text-right text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                  title="Quitar selección"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between">
              <div className="text-xs text-amber-800 font-medium">
                Sin transportista asignado. La orden se creará en estado inicial <strong>CREADO</strong>.
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
            >
              Crear orden sin transportista
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                Confirmar Asignación
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
