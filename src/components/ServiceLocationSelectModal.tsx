import React, { useState, useMemo } from 'react';
import { Search, MapPin, Building2, Check, X } from 'lucide-react';
import type { ServiceLocation } from '../types.ts';

interface ServiceLocationSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceLocations: ServiceLocation[];
  onSelect: (location: ServiceLocation) => void;
  selectedLocationId?: string;
}

export const ServiceLocationSelectModal: React.FC<ServiceLocationSelectModalProps> = ({
  isOpen,
  onClose,
  serviceLocations,
  onSelect,
  selectedLocationId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('TODAS');
  const [estadoFilter, setEstadoFilter] = useState('TODOS');

  // React Rules of Hooks: Place all hooks before any early return!
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
      // Solo mostrar ubicaciones activas en el selector para nuevas órdenes
      if (!loc.activo) return false;

      const q = searchTerm.toLowerCase();
      const matchesSearch =
        loc.cedi.toLowerCase().includes(q) ||
        loc.division.toLowerCase().includes(q) ||
        loc.direccion.ciudad.toLowerCase().includes(q) ||
        loc.direccion.estado.toLowerCase().includes(q) ||
        loc.direccion.calleNumero.toLowerCase().includes(q) ||
        (loc.direccion.colonia && loc.direccion.colonia.toLowerCase().includes(q)) ||
        loc.direccion.codigoPostal.includes(q);

      const matchesDivision =
        divisionFilter === 'TODAS' ||
        loc.division.toLowerCase() === divisionFilter.toLowerCase();
      const matchesEstado =
        estadoFilter === 'TODOS' ||
        loc.direccion.estado.toLowerCase() === estadoFilter.toLowerCase();

      return matchesSearch && matchesDivision && matchesEstado;
    });
  }, [serviceLocations, searchTerm, divisionFilter, estadoFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden my-4">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/30 rounded-lg border border-purple-500/40 text-purple-400">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Seleccionar Ubicación para el Servicio
              </h2>
              <p className="text-xs text-slate-400">
                Busque y elija el CEDI y división operativa de destino o recolección
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por CEDI (ej. TLALPIZAHUAC), división, municipio o C.P..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Filtro División */}
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
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
              className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="TODOS">Todos los Estados</option>
              {availableEstados.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {filteredLocations.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Building2 className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">No se encontraron ubicaciones de servicio.</p>
              <p className="text-xs text-slate-400 mt-1">
                Intente ajustar los filtros de búsqueda o registre un nuevo CEDI en el catálogo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredLocations.map((loc) => {
                const isSelected = selectedLocationId === loc.id;
                return (
                  <div
                    key={loc.id}
                    className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/40 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-purple-300 hover:shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-sm font-bold text-slate-900 tracking-wide uppercase">
                            {loc.cedi}
                          </span>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                              División: {loc.division}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                              C.P. {loc.direccion.codigoPostal}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                            <Check className="h-3 w-3" /> Seleccionado
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 space-y-0.5 mt-2 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                        <div className="font-medium text-slate-800">
                          {loc.direccion.calleNumero}
                          {loc.direccion.colonia ? `, Col. ${loc.direccion.colonia}` : ''}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>
                            {loc.direccion.ciudad}, {loc.direccion.estado}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(loc);
                          onClose();
                        }}
                        className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-purple-700 text-white'
                            : 'bg-slate-900 hover:bg-purple-600 text-white'
                        }`}
                      >
                        {isSelected ? 'Ubicación Asignada' : 'Seleccionar Ubicación'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>{filteredLocations.length} ubicaciones disponibles</span>
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
