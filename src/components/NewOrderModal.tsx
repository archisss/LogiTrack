import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Calculator,
  Truck,
  Building2,
  AlertCircle,
  Settings,
  Search,
  Check,
  X,
  MapPin,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type { Client, Provider, ItemConcept, CatalogConcept } from '../types.ts';
import { calculateOrderTotals, calculateItemImporte } from '../domain/rules.ts';
import { ProviderSelectModal } from './ProviderSelectModal.tsx';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  providers: Provider[];
  catalogConcepts: CatalogConcept[];
  onOpenCatalogManager: () => void;
  onOrderCreated: () => void;
}

interface FormConcept {
  id: string;
  catalogId?: string;
  item?: string; // Opcional (por defecto '')
  unidad: string; // ST, KG, LT, etc.
  descripcion: string; // Obligatoria
  cantidadOrdenada: number;
  precioUnitario: number;
}

const COMMON_UNITS = ['ST', 'KG', 'LT', 'M3', 'TAMBO', 'VIAJE', 'PZA'];

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  clients,
  providers,
  catalogConcepts,
  onOpenCatalogManager,
  onOrderCreated,
}) => {
  // Requisito 1: Cada que abrimos Nueva Orden los valores deben estar en limpio
  const [clienteId, setClienteId] = useState<string>('');
  const [proveedorId, setProveedorId] = useState<string | null>(null);
  const [costoProveedor, setCostoProveedor] = useState<string>('');

  // Requisito 2: Lista de conceptos tipo tabla como en la captura
  const [conceptos, setConceptos] = useState<FormConcept[]>([]);

  // Estado para el formulario de agregar/editar concepto
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [catalogSelectId, setCatalogSelectId] = useState<string>('');
  const [inputDescripcion, setInputDescripcion] = useState<string>('');
  const [inputUnidad, setInputUnidad] = useState<string>('ST');
  const [inputItem, setInputItem] = useState<string>('');
  const [inputCantidad, setInputCantidad] = useState<string>('1.00');
  const [inputPrecioUnitario, setInputPrecioUnitario] = useState<string>('');
  const [conceptFormError, setConceptFormError] = useState<string | null>(null);

  // Requisito 3: Modal de búsqueda y selección de transportista con filtros
  const [isProviderSelectOpen, setIsProviderSelectOpen] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Inicializar en limpio cada vez que se abre el modal (Requisito 1)
  useEffect(() => {
    if (isOpen) {
      setClienteId(clients[0]?.id || '');
      setProveedorId(null);
      setCostoProveedor('');
      setConceptos([]);
      resetConceptInputs();
      setGeneralError(null);
      setConceptFormError(null);
    }
  }, [isOpen, clients]);

  if (!isOpen) return null;

  const resetConceptInputs = () => {
    setEditingIndex(null);
    setCatalogSelectId('');
    setInputDescripcion('');
    setInputUnidad('ST');
    setInputItem('');
    setInputCantidad('1.00');
    setInputPrecioUnitario('');
    setConceptFormError(null);
  };

  // Manejador al seleccionar un concepto del catálogo predefinido
  const handleCatalogSelectionChange = (catId: string) => {
    setCatalogSelectId(catId);
    if (!catId) return;

    const selected = catalogConcepts.find((c) => c.id === catId);
    if (selected) {
      setInputDescripcion(selected.descripcion);
      setInputUnidad(selected.unidad || 'ST');
      setInputItem(selected.item || '');
      setInputPrecioUnitario(selected.precioUnitario ? selected.precioUnitario.toString() : '0');
    }
  };

  // Agregar o Guardar Edición de Concepto
  const handleSaveConcept = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setConceptFormError(null);

    const desc = inputDescripcion.trim();
    if (!desc) {
      setConceptFormError('La DESCRIPCIÓN del concepto es obligatoria.');
      return;
    }

    const cant = parseFloat(inputCantidad);
    if (isNaN(cant) || cant <= 0) {
      setConceptFormError('La CANTIDAD debe ser un número mayor a 0.');
      return;
    }

    const pu = parseFloat(inputPrecioUnitario);
    if (isNaN(pu) || pu < 0) {
      setConceptFormError('El PRECIO UNITARIO debe ser mayor o igual a 0.');
      return;
    }

    const newConcept: FormConcept = {
      id: editingIndex !== null ? conceptos[editingIndex].id : `c-${Date.now()}-${Math.random()}`,
      catalogId: catalogSelectId || undefined,
      item: inputItem.trim(),
      unidad: (inputUnidad || 'ST').trim().toUpperCase(),
      descripcion: desc,
      cantidadOrdenada: cant,
      precioUnitario: pu,
    };

    if (editingIndex !== null) {
      // Modificar existente
      const updated = [...conceptos];
      updated[editingIndex] = newConcept;
      setConceptos(updated);
    } else {
      // Agregar nuevo a la lista
      setConceptos([...conceptos, newConcept]);
    }

    resetConceptInputs();
  };

  const handleStartEdit = (index: number) => {
    const target = conceptos[index];
    setEditingIndex(index);
    setCatalogSelectId(target.catalogId || '');
    setInputDescripcion(target.descripcion);
    setInputUnidad(target.unidad);
    setInputItem(target.item || '');
    setInputCantidad(target.cantidadOrdenada.toString());
    setInputPrecioUnitario(target.precioUnitario.toString());
    setConceptFormError(null);
  };

  const handleRemoveConcept = (index: number) => {
    if (editingIndex === index) {
      resetConceptInputs();
    }
    setConceptos(conceptos.filter((_, i) => i !== index));
  };

  // Preview calculations using rules engine
  const conceptsWithImporte: ItemConcept[] = conceptos.map((c, idx) => ({
    id: c.id || `temp-${idx}`,
    item: c.item ? c.item.trim() : '',
    unidad: c.unidad ? c.unidad.trim().toUpperCase() : 'ST',
    descripcion: c.descripcion ? c.descripcion.trim() : '',
    cantidad: Number(c.cantidadOrdenada) || 0,
    cantidadOrdenada: Number(c.cantidadOrdenada) || 0,
    precioUnitario: Number(c.precioUnitario) || 0,
    importe: calculateItemImporte(Number(c.cantidadOrdenada) || 0, Number(c.precioUnitario) || 0),
  }));

  const provCostNum = proveedorId && costoProveedor !== '' ? Number(costoProveedor) : null;
  const totals = calculateOrderTotals(conceptsWithImporte, provCostNum);

  const selectedProviderObj = providers.find((p) => p.id === proveedorId);

  // Submit final orden
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!clienteId) {
      setGeneralError('Por favor seleccione un cliente.');
      return;
    }

    if (conceptos.length === 0) {
      setGeneralError('Debe agregar al menos un concepto a la orden de recolección.');
      return;
    }

    if (proveedorId && (costoProveedor === '' || Number(costoProveedor) < 0)) {
      setGeneralError('Si asigna un transportista, debe especificar un costo válido (mayor o igual a 0).');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        clienteId,
        proveedorId: proveedorId || null,
        costoProveedor: proveedorId ? Number(costoProveedor) : null,
        conceptos: conceptsWithImporte,
        user: 'admin@logitrack.com',
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al crear la orden');
      }

      onOrderCreated();
      onClose();
    } catch (err: any) {
      setGeneralError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl border border-slate-200 overflow-hidden my-6 max-h-[94vh] flex flex-col">
          {/* Header */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600/30 rounded-xl border border-blue-500/40 text-blue-400">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">Nueva Orden de Recolección</h2>
                <p className="text-xs text-slate-400">
                  Agregue conceptos de forma dinámica y asigne transportista con filtros geográficos
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
            {generalError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{generalError}</span>
              </div>
            )}

            {/* SECCIÓN 1: CLIENTE */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                Cliente de la Recolección *
              </label>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                required
              >
                <option value="">-- Seleccione un cliente --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} (RFC: {c.rfc})
                  </option>
                ))}
              </select>
            </div>

            {/* SECCIÓN 2: FORMULARIO PARA AGREGAR NUEVO CONCEPTO */}
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {editingIndex !== null ? 'Editar Concepto Seleccionado' : 'Registrar Nuevo Concepto'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenCatalogManager}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 bg-white border border-slate-300 hover:bg-slate-50 px-2.5 py-1 rounded-lg transition"
                  >
                    <Settings className="h-3 w-3" />
                    Catálogo de Conceptos
                  </button>
                  {editingIndex !== null && (
                    <button
                      type="button"
                      onClick={resetConceptInputs}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2 py-1"
                    >
                      Cancelar Edición
                    </button>
                  )}
                </div>
              </div>

              {conceptFormError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                  {conceptFormError}
                </div>
              )}

              {/* Selector de Catálogo para autocompletar */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Autocompletar desde Catálogo de Conceptos (Opcional):
                </label>
                <select
                  value={catalogSelectId}
                  onChange={(e) => handleCatalogSelectionChange(e.target.value)}
                  className="w-full text-xs font-medium rounded-lg border border-slate-300 px-3 py-1.5 bg-white text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs"
                >
                  <option value="">-- Concepto manual / libre --</option>
                  {catalogConcepts.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.descripcion} ({cat.unidad}) - ${cat.precioUnitario.toFixed(2)} MXN
                    </option>
                  ))}
                </select>
              </div>

              {/* Fila de campos del concepto */}
              <div className="grid grid-cols-12 gap-2.5 items-end">
                {/* DESCRIPCIÓN (OBLIGATORIA) */}
                <div className="col-span-12 md:col-span-4">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    DESCRIPCIÓN *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Solido contaminado kg, Flete lodos..."
                    value={inputDescripcion}
                    onChange={(e) => setInputDescripcion(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* CANTIDAD ORDENADA */}
                <div className="col-span-6 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    CANTIDAD *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="1.00"
                    value={inputCantidad}
                    onChange={(e) => setInputCantidad(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1.5 text-right bg-white font-mono"
                  />
                </div>

                {/* UNIDAD (ST, KG, LT, etc.) */}
                <div className="col-span-6 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    UNIDAD *
                  </label>
                  <input
                    type="text"
                    placeholder="ST, KG, LT..."
                    value={inputUnidad}
                    onChange={(e) => setInputUnidad(e.target.value.toUpperCase())}
                    className="w-full text-xs rounded-lg border border-slate-300 px-2 py-1.5 bg-white uppercase font-mono font-bold"
                  />
                </div>

                {/* PRECIO UNITARIO */}
                <div className="col-span-6 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    PRECIO UNIT. *
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1.5 text-xs text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={inputPrecioUnitario}
                      onChange={(e) => setInputPrecioUnitario(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 pl-5 pr-2 py-1.5 text-right bg-white font-mono"
                    />
                  </div>
                </div>

                {/* BOTÓN AGREGAR / ACTUALIZAR */}
                <div className="col-span-6 md:col-span-2 flex items-center">
                  <button
                    type="button"
                    onClick={() => handleSaveConcept()}
                    className="w-full py-2 px-3 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center justify-center gap-1.5"
                  >
                    {editingIndex !== null ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Guardar
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Agregar
                      </>
                    )}
                  </button>
                </div>

                {/* ITEM OPCIONAL Y UNIDADES RÁPIDAS */}
                <div className="col-span-12 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-400">ITEM (Opcional):</span>
                    <input
                      type="text"
                      placeholder="Dejar en blanco o código"
                      value={inputItem}
                      onChange={(e) => setInputItem(e.target.value)}
                      className="text-[11px] rounded border border-slate-200 px-2 py-0.5 bg-white font-mono text-slate-600 w-32"
                    />
                  </div>

                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-slate-400">Unidades rápidas:</span>
                    {COMMON_UNITS.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setInputUnidad(u)}
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          inputUnidad === u
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>

                  {inputCantidad && inputPrecioUnitario && (
                    <div className="text-[11px] font-bold text-slate-700">
                      Importe previsto: $
                      {calculateItemImporte(
                        parseFloat(inputCantidad) || 0,
                        parseFloat(inputPrecioUnitario) || 0
                      ).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      MXN
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: LISTA PARECIDA A LA IMAGEN ADJUNTA (TABLA ESTILO AZUL MARINO) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-blue-800" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Conceptos de la Orden ({conceptos.length})
                  </span>
                </div>
                {conceptos.length > 0 && (
                  <span className="text-[11px] text-slate-500">
                    Haga clic en el botón de edición o eliminar para ajustar cualquier concepto
                  </span>
                )}
              </div>

              {/* TABLA ESTILO EXACTO A LA IMAGEN ADJUNTA */}
              <div className="overflow-hidden rounded-xl border border-slate-200 shadow-xs">
                <table className="w-full text-left border-collapse">
                  {/* Encabezado azul marino corporativo (exacto imagen) */}
                  <thead>
                    <tr className="bg-[#004b93] text-white text-xs font-black uppercase tracking-wider">
                      <th className="py-3 px-4 text-left font-black">DESCRIPCIÓN</th>
                      <th className="py-3 px-4 text-right font-black">PRECIO UNITARIO</th>
                      <th className="py-3 px-4 text-right font-black">PRECIO TOTAL</th>
                      <th className="py-3 px-3 text-center font-black w-24">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white text-xs text-slate-800">
                    {conceptos.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 bg-slate-50/50">
                          <Calculator className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                          <p className="font-semibold text-slate-600">Aún no se han agregado conceptos a la orden</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Utilice el formulario superior para registrar conceptos y formar la lista
                          </p>
                        </td>
                      </tr>
                    ) : (
                      conceptos.map((concept, index) => {
                        const totalImporte = calculateItemImporte(
                          concept.cantidadOrdenada,
                          concept.precioUnitario
                        );
                        const isBeingEdited = editingIndex === index;

                        return (
                          <tr
                            key={concept.id}
                            className={`transition hover:bg-slate-50/80 ${
                              isBeingEdited ? 'bg-amber-50/70 font-semibold' : ''
                            }`}
                          >
                            {/* DESCRIPCIÓN (con detalle de unidad y cantidad si aplica) */}
                            <td className="py-3 px-4 text-slate-900 font-medium">
                              <div className="flex items-center gap-2">
                                <span>{concept.descripcion}</span>
                                {concept.item && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200">
                                    {concept.item}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                                Cantidad: {concept.cantidadOrdenada.toLocaleString('es-MX', { minimumFractionDigits: 2 })}{' '}
                                {concept.unidad}
                              </div>
                            </td>

                            {/* PRECIO UNITARIO */}
                            <td className="py-3 px-4 text-right font-mono font-medium text-slate-800">
                              ${' '}
                              {concept.precioUnitario.toLocaleString('es-MX', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>

                            {/* PRECIO TOTAL */}
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-950">
                              ${' '}
                              {totalImporte.toLocaleString('es-MX', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>

                            {/* ACCIONES: EDITAR Y ELIMINAR */}
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(index)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition"
                                  title="Editar concepto"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveConcept(index)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                  title="Eliminar concepto"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>

                  {/* Pie de tabla con Suma de Precio Total */}
                  {conceptos.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                        <td className="py-3 px-4 text-right uppercase tracking-wider text-xs text-slate-600">
                          Costo total (Suma del Precio Total):
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-slate-500 font-normal">
                          {conceptos.length} concepto(s)
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm text-[#004b93] font-black">
                          ${' '}
                          {totals.subtotalCliente.toLocaleString('es-MX', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* SECCIÓN 4: ASIGNACIÓN DE TRANSPORTISTA CON VENTANA MODAL DE BÚSQUEDA Y FILTROS */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-700" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Asignación de Transportista (Opcional en Creación)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsProviderSelectOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition"
                >
                  <Search className="h-3.5 w-3.5" />
                  Buscar y Filtrar Proveedores
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                La orden puede crearse sin transportista y permanecerá en <strong>CREADO</strong>. Si se asigna un
                proveedor activo y su costo, la recolección iniciará inmediatamente en <strong>EN_PROCESO</strong> para medir los tiempos con precisión.
              </p>

              {/* Ficha del proveedor seleccionado */}
              {selectedProviderObj ? (
                <div className="bg-white p-3.5 rounded-xl border border-blue-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 mt-0.5">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{selectedProviderObj.nombre}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-300">
                          RFC: {selectedProviderObj.rfc}
                        </span>
                        {selectedProviderObj.autorizacionDocumento && (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Autorización OK
                          </span>
                        )}
                      </div>

                      {/* Dirección */}
                      {selectedProviderObj.direccion && (
                        <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-blue-600 shrink-0" />
                          <span>
                            {selectedProviderObj.direccion.calleNumero},{' '}
                            {selectedProviderObj.direccion.ciudad}, {selectedProviderObj.direccion.estado} (C.P.{' '}
                            {selectedProviderObj.direccion.codigoPostal})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Costo Proveedor:</div>
                      <div className="text-sm font-mono font-bold text-slate-900">
                        ${' '}
                        {parseFloat(costoProveedor || '0').toLocaleString('es-MX', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        MXN
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsProviderSelectOpen(true)}
                      className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                    >
                      Cambiar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProveedorId(null);
                        setCostoProveedor('');
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition"
                      title="Quitar proveedor"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-3 rounded-xl border border-dashed border-slate-300 flex items-center justify-between text-xs text-slate-500">
                  <span>Ningún transportista asignado aún. Puede buscarlo usando el botón superior.</span>
                  <button
                    type="button"
                    onClick={() => setIsProviderSelectOpen(true)}
                    className="text-blue-600 hover:text-blue-800 font-bold"
                  >
                    Abrir buscador &rarr;
                  </button>
                </div>
              )}
            </div>

            {/* SECCIÓN 5: RESUMEN FINANCIERO DEFINITIVO (REGLA DE NEGOCIO 1) */}
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Cliente (Suma de conceptos):</span>
                <span className="font-mono font-semibold">
                  ${totals.subtotalCliente.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                </span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-indigo-100 pt-2">
                <span>Costo Total Cobrado al Cliente (costoTotalCliente):</span>
                <span className="font-mono text-base text-indigo-700">
                  ${totals.costoTotalCliente.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                </span>
              </div>
              {totals.costoProveedor !== null && (
                <>
                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>Costo Proveedor:</span>
                    <span className="font-mono">
                      ${totals.costoProveedor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-800 border-t border-indigo-100 pt-1.5">
                    <span>Utilidad Estimada (Solo Administrador):</span>
                    <span className="font-mono text-sm text-emerald-700">
                      ${totals.utilidadEstimada?.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Acciones */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || conceptos.length === 0}
                className="px-6 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {submitting ? 'Guardando...' : 'Crear Orden de Recolección'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de Búsqueda y Selección de Proveedor */}
      <ProviderSelectModal
        isOpen={isProviderSelectOpen}
        onClose={() => setIsProviderSelectOpen(false)}
        providers={providers}
        selectedProviderId={proveedorId}
        currentCostoProveedor={costoProveedor}
        onSelectProvider={(selectedId, costo) => {
          setProveedorId(selectedId);
          setCostoProveedor(costo);
        }}
      />
    </>
  );
};
