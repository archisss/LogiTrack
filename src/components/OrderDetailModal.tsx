import React, { useState } from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Building2,
  DollarSign,
  Calendar,
  AlertCircle,
  History,
  FileCheck,
  RotateCcw,
  Upload,
  ArrowRight,
  ShieldAlert,
  Info,
} from 'lucide-react';
import type { Order, Provider, Client, Role, OrderStatus } from '../types.ts';
import { calculateSla, canFinalizeOrder } from '../domain/rules.ts';
import { StatusBadge, ManifestBadge, SlaBadge } from './StatusBadge.tsx';

interface OrderDetailModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: Role;
  providers: Provider[];
  clients: Client[];
  onOrderUpdated: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  currentUserRole,
  providers,
  clients,
  onOrderUpdated,
}) => {
  if (!isOpen || !order) return null;

  const [activeTab, setActiveTab] = useState<'operacion' | 'manifiesto' | 'historial'>('operacion');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states
  const [selectedProviderId, setSelectedProviderId] = useState<string>(order.proveedorId || '');
  const [costoProveedorInput, setCostoProveedorInput] = useState<string>(
    order.costoProveedor !== null ? String(order.costoProveedor) : ''
  );
  const [numeroRecepcionInput, setNumeroRecepcionInput] = useState<string>(order.numeroRecepcion || '');
  const [numeroFacturacionInput, setNumeroFacturacionInput] = useState<string>(
    order.numeroFacturacion || order.facturacionPendiente || ''
  );
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [showRejectBox, setShowRejectBox] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>('');
  const [showReopenBox, setShowReopenBox] = useState<boolean>(false);

  // SLA calculation
  const sla = calculateSla(order);
  const finalizationCheck = canFinalizeOrder(order);

  const activeProviders = providers.filter((p) => p.activo);
  const isFinalized = order.estado === 'FINALIZADO';
  const isAdmin = currentUserRole === 'ADMIN';

  const operationalSteps: OrderStatus[] = [
    'CREADO',
    'ASIGNANDO',
    'EN_PROCESO',
    'COMPLETO',
    'FACTURADO',
    'FINALIZADO',
  ];

  const currentStepIndex = operationalSteps.indexOf(order.estado);

  // Sum of precio total across concepts
  const totalConceptsSum = order.conceptos.reduce((acc, c) => acc + (c.importe || 0), 0);

  // Handlers
  const handleAssignProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/assign-provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedProviderId,
          costoProveedor: parseFloat(costoProveedorInput),
          user: 'admin@logitrack.com',
          role: currentUserRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeedback({ type: 'success', message: 'Proveedor asignado correctamente.' });
      onOrderUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRecordReception = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/record-reception`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numeroRecepcion: numeroRecepcionInput,
          user: 'admin@logitrack.com',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeedback({
        type: 'success',
        message: 'Número de recepción registrado. La orden ha avanzado según las reglas.',
      });
      onOrderUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRecordInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/record-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numeroFacturacion: numeroFacturacionInput,
          user: 'admin@logitrack.com',
          role: currentUserRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeedback({
        type: 'success',
        message: 'Número de facturación registrado exitosamente.',
      });
      onOrderUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReviewManifest = async (action: 'APPROVE' | 'REJECT') => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/manifest/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: action === 'REJECT' ? rejectionReason : undefined,
          user: 'admin@logitrack.com',
          role: currentUserRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeedback({
        type: 'success',
        message: action === 'APPROVE' ? 'Manifiesto aprobado.' : 'Manifiesto rechazado.',
      });
      setShowRejectBox(false);
      setRejectionReason('');
      onOrderUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReopenOrder = async () => {
    if (!reopenReason.trim()) {
      setFeedback({ type: 'error', message: 'Debe ingresar un motivo para reabrir la orden.' });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivo: reopenReason,
          user: 'admin@logitrack.com',
          role: currentUserRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeedback({ type: 'success', message: 'Orden reabierta administrativamente.' });
      setShowReopenBox(false);
      setReopenReason('');
      onOrderUpdated();
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
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 rounded-xl border border-indigo-500/40 text-indigo-400">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-white tracking-wide">
                  {order.folio}
                </span>
                <StatusBadge status={order.estado} size="sm" />
                {order.manifiestoActual && (
                  <ManifestBadge
                    status={order.manifiestoActual.status}
                    version={order.manifiestoActual.version}
                  />
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                {order.clienteNombre} &bull; ID: {order.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SlaBadge days={sla.days} color={sla.color} label={sla.label} isFinalized={sla.isFinalized} />
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Operational State Stepper */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[680px]">
            {operationalSteps.map((step, idx) => {
              const isPassed = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                        isPassed
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                          ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {isPassed ? '✓' : idx + 1}
                    </div>
                    <span
                      className={`text-xs font-bold whitespace-nowrap ${
                        isCurrent
                          ? 'text-indigo-900'
                          : isPassed
                          ? 'text-emerald-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                  {idx < operationalSteps.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 transition ${
                        idx < currentStepIndex ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Feedback message banner */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-red-50 text-red-800 border-b border-red-200'
            }`}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="text-xs opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 px-6 bg-white flex gap-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab('operacion')}
            className={`py-3 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'operacion'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="h-4 w-4" />
            Detalles de la Orden
          </button>
          <button
            onClick={() => setActiveTab('manifiesto')}
            className={`py-3 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'manifiesto'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileCheck className="h-4 w-4" />
            Manifiestos y Revisiones ({order.manifiestos.length})
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('historial')}
              className={`py-3 border-b-2 flex items-center gap-2 transition ${
                activeTab === 'historial'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <History className="h-4 w-4" />
              Historial de Auditoría ({order.historial.length})
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: DETALLES DE LA ORDEN & CONCEPTOS */}
          {activeTab === 'operacion' && (
            <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-3' : ''} gap-6`}>
              {/* Main Column: Concepts table and order details */}
              <div className={`${isAdmin ? 'lg:col-span-2' : ''} space-y-6`}>
                {/* Desglose de Conceptos con formato reglamentario solicitado */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Desglose de Conceptos de la Orden
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {order.conceptos.length} concepto(s)
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-wider">
                          <th className="py-2.5 px-3 text-right">CANTIDAD ORDENADA</th>
                          <th className="py-2.5 px-3">UNIDAD</th>
                          <th className="py-2.5 px-3">ITEM</th>
                          <th className="py-2.5 px-3">DESCRIPCIÓN</th>
                          <th className="py-2.5 px-3 text-right">PRECIO UNITARIO</th>
                          <th className="py-2.5 px-3 text-right">PRECIO TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {order.conceptos.map((c, idx) => {
                          const cantidadFormatted = (c.cantidadOrdenada ?? c.cantidad ?? 0).toFixed(2);
                          const unidadVal = c.unidad || 'ST';
                          const itemVal = c.item || c.descripcion;
                          const descVal = c.descripcion && c.descripcion !== c.item ? c.descripcion : '';
                          const precioUnitFormatted = `$ ${c.precioUnitario.toLocaleString('es-MX', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`;
                          const precioTotalFormatted = `$ ${c.importe.toLocaleString('es-MX', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`;

                          return (
                            <tr key={c.id || idx} className="hover:bg-slate-50/60 transition">
                              <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700">
                                {cantidadFormatted}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                                {unidadVal}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {itemVal}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono">
                                {descVal}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                {precioUnitFormatted}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                {precioTotalFormatted}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-xs">
                          <td colSpan={4} className="py-3 px-3 text-right text-slate-700 uppercase tracking-wider">
                            Costo total la suma del Precio Total:
                          </td>
                          <td colSpan={2} className="py-3 px-3 text-right font-mono text-base font-black text-indigo-700">
                            $ {totalConceptsSum.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Sección renombrada exactamente a "Detalles de la orden" (antes Condiciones Obligatorias para Estado FINALIZADO) */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-indigo-600" />
                      Detalles de la orden
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        finalizationCheck.canFinalize
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {finalizationCheck.canFinalize ? '✓ Condiciones Cumplidas' : 'Pendientes por cumplir'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div
                      className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                        order.numeroRecepcion
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      {order.numeroRecepcion ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold">1. Número de Recepción</div>
                        <div className="text-[11px] font-mono mt-0.5">
                          {order.numeroRecepcion || 'Sin registrar'}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                        order.numeroFacturacion
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      {order.numeroFacturacion ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold">2. Número de Factura</div>
                        <div className="text-[11px] font-mono mt-0.5">
                          {order.numeroFacturacion ||
                            (order.facturacionPendiente
                              ? `(Pendiente: ${order.facturacionPendiente})`
                              : 'Sin registrar')}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                        order.manifiestoActual?.status === 'APPROVED'
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      {order.manifiestoActual?.status === 'APPROVED' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold">3. Manifiesto Aprobado</div>
                        <div className="text-[11px] mt-0.5">
                          {order.manifiestoActual
                            ? `v${order.manifiestoActual.version}: ${order.manifiestoActual.status}`
                            : 'Sin cargar'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Si es Admin, mostrar resumen de costos y utilidad */}
                {isAdmin && (
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      Resumen Financiero (Solo Administrador)
                    </span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Subtotal Cliente</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          ${order.subtotalCliente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-indigo-700 font-semibold block uppercase">Total Cliente</span>
                        <span className="font-mono font-bold text-indigo-700 text-sm">
                          ${order.costoTotalCliente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-amber-700 font-semibold block uppercase">Costo Proveedor</span>
                        <span className="font-mono font-bold text-amber-700 text-sm">
                          {order.costoProveedor !== null
                            ? `$${order.costoProveedor.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                            : 'Sin asignar'}
                        </span>
                      </div>
                      <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                        <span className="text-[10px] text-emerald-800 font-semibold block uppercase">Utilidad Estimada</span>
                        <span className="font-mono font-bold text-emerald-800 text-sm">
                          {order.utilidadEstimada !== null
                            ? `$${order.utilidadEstimada.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Operational Controls for Admin */}
              {isAdmin && (
                <div className="space-y-5">
                  {/* Asignación / Reasignación de Proveedor (Regla 2) */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-blue-600" />
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        {order.proveedorId ? 'Reasignar Proveedor' : 'Asignar Proveedor'}
                      </h4>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      {order.proveedorId
                        ? `Actualmente asignado a: ${order.proveedorNombre}. Si reasigna, se conservará el anterior en el historial.`
                        : 'Seleccione un transportista activo y registre su costo para iniciar inmediatamente la recolección en EN_PROCESO.'}
                    </p>

                    <form onSubmit={handleAssignProvider} className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Proveedor Activo
                        </label>
                        <select
                          value={selectedProviderId}
                          onChange={(e) => setSelectedProviderId(e.target.value)}
                          disabled={isFinalized}
                          className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
                          required
                        >
                          <option value="">-- Seleccionar Proveedor --</option>
                          {activeProviders.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Costo del Proveedor ($ MXN)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-xs text-slate-400">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Ej. 2500.00"
                            value={costoProveedorInput}
                            onChange={(e) => setCostoProveedorInput(e.target.value)}
                            disabled={isFinalized}
                            className="w-full text-xs rounded-xl border border-slate-300 pl-6 pr-3 py-2 text-right bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || isFinalized || !selectedProviderId}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        {order.proveedorId ? 'Confirmar Reasignación' : 'Asignar e Iniciar Recolección (EN_PROCESO)'}
                      </button>
                    </form>
                  </div>

                  {/* Registro de Recepción (Regla 4) */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-amber-600" />
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Registro de Recepción
                      </h4>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Cambia estados ASIGNANDO o EN_PROCESO a <strong>COMPLETO</strong>. No aprueba el manifiesto.
                    </p>

                    {!order.proveedorId && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                        ⚠ <strong>Restricción:</strong> No se puede registrar recepción sin un proveedor previamente asignado.
                      </div>
                    )}

                    <form onSubmit={handleRecordReception} className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Número de Recepción
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. REC-2026-0982"
                          value={numeroRecepcionInput}
                          onChange={(e) => setNumeroRecepcionInput(e.target.value)}
                          disabled={isFinalized || !order.proveedorId}
                          className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 font-mono uppercase bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading || isFinalized || !order.proveedorId || !numeroRecepcionInput.trim()}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        {order.numeroRecepcion ? 'Actualizar Recepción' : 'Guardar Recepción (Pasar a COMPLETO)'}
                      </button>
                    </form>
                  </div>

                  {/* Registro de Facturación (Regla 4) */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-purple-600" />
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Registro de Facturación
                      </h4>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Si la orden está en COMPLETO, pasa a <strong>FACTURADO</strong>. Si se registra antes de completar, se conserva como pendiente sin saltar estados operativos.
                    </p>

                    <form onSubmit={handleRecordInvoice} className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Número de Factura
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. FAC-2026-7788"
                          value={numeroFacturacionInput}
                          onChange={(e) => setNumeroFacturacionInput(e.target.value)}
                          disabled={isFinalized}
                          className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 font-mono uppercase bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading || isFinalized || !numeroFacturacionInput.trim()}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        {order.numeroFacturacion ? 'Actualizar Factura' : 'Registrar Facturación'}
                      </button>
                    </form>
                  </div>

                  {/* Reapertura Excepcional */}
                  {isFinalized && (
                    <div className="bg-red-50/50 rounded-2xl p-4 border border-red-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4 text-red-600" />
                        <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider">
                          Reapertura Administrativa Excepcional
                        </h4>
                      </div>
                      <p className="text-[11px] text-red-700">
                        Una orden finalizada no se reabre automáticamente. Esta operación debe ser explícita y motivada.
                      </p>

                      {!showReopenBox ? (
                        <button
                          onClick={() => setShowReopenBox(true)}
                          className="w-full py-2 border border-red-300 text-red-700 hover:bg-red-100 rounded-xl text-xs font-bold transition"
                        >
                          Reabrir Orden...
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <textarea
                            placeholder="Justificación formal obligatoria para la reapertura..."
                            value={reopenReason}
                            onChange={(e) => setReopenReason(e.target.value)}
                            className="w-full text-xs rounded-xl border border-red-300 p-2 bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                            rows={2}
                            required
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setShowReopenBox(false)}
                              className="flex-1 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-xs"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleReopenOrder}
                              disabled={loading || !reopenReason.trim()}
                              className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
                            >
                              Autorizar Reapertura
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANIFIESTOS */}
          {activeTab === 'manifiesto' && (
            <div className="space-y-6">
              {/* Review card if current manifest is PENDING and user is ADMIN */}
              {isAdmin && order.manifiestoActual && order.manifiestoActual.status === 'PENDING' && (
                <div className="bg-yellow-50/80 rounded-2xl p-5 border border-yellow-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-700" />
                      <div>
                        <h4 className="text-xs font-bold text-yellow-900 uppercase tracking-wider">
                          Revisión Pendiente de Manifiesto Versión {order.manifiestoActual.version}
                        </h4>
                        <p className="text-xs text-yellow-800">
                          Archivo: <strong>{order.manifiestoActual.fileName}</strong> subido por {order.manifiestoActual.uploadedBy}
                        </p>
                      </div>
                    </div>
                  </div>

                  {!showRejectBox ? (
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => handleReviewManifest('APPROVE')}
                        disabled={loading}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Aprobar Manifiesto v{order.manifiestoActual.version}
                      </button>
                      <button
                        onClick={() => setShowRejectBox(true)}
                        disabled={loading}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs"
                      >
                        <XCircle className="h-4 w-4" />
                        Rechazar Manifiesto...
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-2 border-t border-yellow-200">
                      <label className="block text-xs font-bold text-yellow-900">
                        Motivo obligatorio de rechazo:
                      </label>
                      <textarea
                        placeholder="Especifique con claridad el motivo (ej. falta firma del receptor, sello ilegible)..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="w-full text-xs rounded-xl border border-yellow-300 p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setShowRejectBox(false)}
                          className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs rounded-lg hover:bg-slate-100"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleReviewManifest('REJECT')}
                          disabled={loading || !rejectionReason.trim()}
                          className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                        >
                          Confirmar Rechazo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Version History List */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-slate-500" />
                    Historial de Versiones de Manifiestos
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    {order.manifiestos.length === 0 ? 'Sin documentos cargados' : `${order.manifiestos.length} versión(es)`}
                  </span>
                </div>

                {order.manifiestos.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No se ha cargado ningún manifiesto para esta orden.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {order.manifiestos.map((m) => (
                      <div key={m.version} className="p-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{m.fileName}</span>
                              <ManifestBadge status={m.status} version={m.version} />
                              {m.isCurrent && (
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">
                                  Vigente
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 space-x-3">
                              <span>Subido: {new Date(m.uploadedAt).toLocaleString('es-MX')}</span>
                              <span>Por: {m.uploadedBy}</span>
                              {m.fileSize && <span>({m.fileSize})</span>}
                            </div>
                            {m.status === 'REJECTED' && m.rejectionReason && (
                              <div className="mt-2 text-xs bg-red-50 text-red-800 p-2 rounded-lg border border-red-200">
                                <strong>Motivo de rechazo:</strong> {m.rejectionReason}
                              </div>
                            )}
                            {m.status === 'APPROVED' && m.reviewedBy && (
                              <div className="mt-1 text-[11px] text-emerald-700">
                                ✓ Aprobado por {m.reviewedBy} el {m.reviewedAt ? new Date(m.reviewedAt).toLocaleString('es-MX') : ''}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => alert(`Visualizando documento seguro de forma autenticada: ${m.fileName} (Versión ${m.version})`)}
                            className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs rounded-lg font-medium transition"
                          >
                            Ver Documento
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: HISTORIAL DE AUDITORIA (Admin) */}
          {activeTab === 'historial' && isAdmin && (
            <div className="space-y-4">
              <div className="text-xs text-slate-500">
                Registro inmutable de eventos, cambios de estado operativo, reasignaciones y revisiones documentales.
              </div>

              <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 pb-2">
                {order.historial.map((entry) => (
                  <div key={entry.id} className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white bg-indigo-600 shadow-xs" />

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{entry.action}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            {entry.role}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          {new Date(entry.timestamp).toLocaleString('es-MX')}
                        </span>
                      </div>

                      {entry.prevStatus && entry.newStatus && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 my-1.5">
                          <span className="px-2 py-0.5 rounded bg-slate-200">{entry.prevStatus}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">{entry.newStatus}</span>
                        </div>
                      )}

                      {entry.comment && (
                        <p className="text-xs text-slate-600 mt-1">{entry.comment}</p>
                      )}

                      <div className="text-[11px] text-slate-400 mt-1">
                        Registrado por: <span className="font-semibold text-slate-600">{entry.user}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>LogiTrack MVP &bull; Motor de Reglas Definitivas de Negocio</span>
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
