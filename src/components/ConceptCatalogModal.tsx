import React, { useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  AlertCircle,
} from 'lucide-react';
import type { CatalogConcept } from '../types.ts';

interface ConceptCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  concepts: CatalogConcept[];
  onConceptsChanged: () => void;
}

const COMMON_UNITS = ['ST', 'KG', 'LT', 'M3', 'TAMBO', 'VIAJE', 'PZA'];

export const ConceptCatalogModal: React.FC<ConceptCatalogModalProps> = ({
  isOpen,
  onClose,
  concepts,
  onConceptsChanged,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [item, setItem] = useState('');
  const [unidad, setUnidad] = useState('KG');
  const [descripcion, setDescripcion] = useState('');
  const [precioUnitario, setPrecioUnitario] = useState('');

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setItem('');
    setUnidad('KG');
    setDescripcion('');
    setPrecioUnitario('');
    setFeedback(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleStartEdit = (cat: CatalogConcept) => {
    setEditingId(cat.id);
    setItem(cat.item || '');
    setUnidad(cat.unidad || 'ST');
    setDescripcion(cat.descripcion);
    setPrecioUnitario(String(cat.precioUnitario));
    setIsEditing(true);
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    if (!descripcion.trim()) {
      setFeedback({ type: 'error', message: 'La descripción del concepto es obligatoria.' });
      setLoading(false);
      return;
    }

    try {
      const payload = {
        item: item.trim(),
        unidad: unidad.trim().toUpperCase() || 'ST',
        descripcion: descripcion.trim(),
        precioUnitario: parseFloat(precioUnitario) || 0,
      };

      if (editingId) {
        // Update
        const res = await fetch(`/api/catalog-concepts/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar concepto');
        setFeedback({ type: 'success', message: 'Concepto actualizado exitosamente.' });
      } else {
        // Create
        const res = await fetch('/api/catalog-concepts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al crear concepto');
        setFeedback({ type: 'success', message: 'Concepto agregado al catálogo.' });
      }

      onConceptsChanged();
      resetForm();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cat: CatalogConcept) => {
    if (!window.confirm(`¿Desea eliminar el concepto "${cat.descripcion}" del catálogo?`)) return;

    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/catalog-concepts/${cat.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      setFeedback({ type: 'success', message: 'Concepto eliminado del catálogo.' });
      onConceptsChanged();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredConcepts = concepts.filter((c) => {
    return (
      c.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.item && c.item.toLowerCase().includes(searchTerm.toLowerCase())) ||
      c.unidad.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/30 rounded-lg border border-indigo-500/40 text-indigo-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Catálogo General de Conceptos
              </h2>
              <p className="text-xs text-slate-400">
                Descripción obligatoria, ITEM opcional, y unidades configurables (ST, KG, LT, etc.)
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
            <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {editingId ? 'Editar Concepto' : 'Nuevo Concepto del Catálogo'}
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
                {/* DESCRIPCIÓN (OBLIGATORIA) */}
                <div className="md:col-span-6">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    DESCRIPCIÓN (Concepto / Residuo) *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Solido contaminado, Flete lodos, Filtros..."
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* ITEM (OPCIONAL) */}
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    ITEM (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="En blanco o código"
                    value={item}
                    onChange={(e) => setItem(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* UNIDAD (ST, KG, LT, M3, etc.) */}
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    UNIDAD *
                  </label>
                  <input
                    type="text"
                    placeholder="ST, KG, LT..."
                    value={unidad}
                    onChange={(e) => setUnidad(e.target.value.toUpperCase())}
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase font-mono font-bold"
                    required
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {COMMON_UNITS.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnidad(u)}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          unidad === u
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {/* PRECIO UNITARIO */}
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    PRECIO UNITARIO *
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={precioUnitario}
                      onChange={(e) => setPrecioUnitario(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 pl-6 pr-3 py-2 text-right bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-xl text-xs text-slate-600 hover:bg-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !descripcion.trim()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-xs disabled:opacity-50"
                >
                  {editingId ? 'Guardar Cambios' : 'Registrar Concepto'}
                </button>
              </div>
            </form>
          )}

          {/* Action bar and Search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por descripción, unidad o item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 pl-8 pr-3 py-1.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {!isEditing && (
              <button
                onClick={handleStartCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <Plus className="h-4 w-4" />
                Nuevo Concepto
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-2.5 px-4">DESCRIPCIÓN (Concepto)</th>
                  <th className="py-2.5 px-4">UNIDAD</th>
                  <th className="py-2.5 px-4">ITEM (Opcional)</th>
                  <th className="py-2.5 px-4 text-right">PRECIO UNITARIO</th>
                  <th className="py-2.5 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredConcepts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No se encontraron conceptos en el catálogo.
                    </td>
                  </tr>
                ) : (
                  filteredConcepts.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {c.descripcion}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                          {c.unidad}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-400">
                        {c.item ? (
                          <span className="text-slate-700 font-semibold">{c.item}</span>
                        ) : (
                          <span className="text-slate-300 italic">(En blanco)</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        ${c.precioUnitario.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(c)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
                            title="Editar concepto"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="p-1.5 text-slate-600 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                            title="Eliminar concepto"
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
          <span>{filteredConcepts.length} conceptos disponibles en catálogo.</span>
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
