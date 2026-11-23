import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import type { Order, Provider, Client, Role, ServiceLocation } from '../types.ts';
import { calculateSla } from '../domain/rules.ts';
import { StatusBadge, ManifestBadge, SlaBadge } from './StatusBadge.tsx';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  providers: Provider[];
  clients: Client[];
  serviceLocations: ServiceLocation[];
  userRole: Role;
}

export const ReportsModal: React.FC<ReportsModalProps> = ({
  isOpen,
  onClose,
  orders,
  providers,
  clients,
  serviceLocations,
  userRole,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [clientFilter, setClientFilter] = useState<string>('TODOS');
  const [providerFilter, setProviderFilter] = useState<string>('TODOS');
  const [divisionFilter, setDivisionFilter] = useState<string>('TODAS');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const canViewGlobalKpis = userRole === 'ADMIN';
  const canViewOrderColumns = userRole === 'ADMIN' || userRole === 'USER';

  const divisions = useMemo(() => {
    const set = new Set<string>();
    serviceLocations.forEach((loc) => {
      if (loc.division?.trim()) set.add(loc.division.trim());
    });
    orders.forEach((o) => {
      if (o.ubicacionServicio?.division?.trim()) set.add(o.ubicacionServicio.division.trim());
    });
    return Array.from(set).sort();
  }, [serviceLocations, orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'TODOS' && o.estado !== statusFilter) return false;
      if (clientFilter !== 'TODOS' && o.clienteId !== clientFilter) return false;
      if (providerFilter !== 'TODOS' && o.proveedorId !== providerFilter) return false;
      if (
        divisionFilter !== 'TODAS' &&
        (o.ubicacionServicio?.division || '').toLowerCase() !== divisionFilter.toLowerCase()
      ) {
        return false;
      }

      const orderDay = o.fechaOrden.slice(0, 10);
      if (dateFrom && orderDay < dateFrom) return false;
      if (dateTo && orderDay > dateTo) return false;

      return true;
    });
  }, [orders, statusFilter, clientFilter, providerFilter, divisionFilter, dateFrom, dateTo]);

  const summary = useMemo(() => {
    let finalized = 0;
    let approvedManifests = 0;
    let totalDays = 0;
    let totalClientBilling = 0;
    let totalProviderCost = 0;
    let totalProfit = 0;

    filteredOrders.forEach((o) => {
      if (o.estado === 'FINALIZADO') finalized++;
      if (o.manifiestoActual?.status === 'APPROVED') approvedManifests++;
      totalDays += calculateSla(o).days;

      if (canViewGlobalKpis) {
        totalClientBilling += o.costoTotalCliente || 0;
        totalProviderCost += o.costoProveedor || 0;
        totalProfit += o.utilidadEstimada || 0;
      }
    });

    const avgDays = filteredOrders.length > 0 ? (totalDays / filteredOrders.length).toFixed(1) : '0.0';

    return {
      total: filteredOrders.length,
      finalized,
      open: filteredOrders.length - finalized,
      approvedManifests,
      avgDays,
      totalClientBilling,
      totalProviderCost,
      totalProfit,
    };
  }, [filteredOrders, canViewGlobalKpis]);

  if (!isOpen) return null;

  const escapeCsv = (val: string | number | null | undefined) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportCsv = () => {
    const headers = [
      'Numero de Pedido',
      'Folio Interno',
      'Fecha Orden',
      'Cliente',
      'Solicito',
      'Telefono Solicitante',
      'CEDI',
      'Division',
      'Estado',
      'Transportista',
      'Numero Recepcion',
      'Numero Facturacion',
      'Manifiesto',
      'Antiguedad (dias)',
      ...(canViewOrderColumns
        ? ['Cobro Cliente', 'Costo Proveedor', 'Utilidad Estimada']
        : []),
    ];

    const rows = filteredOrders.map((o) => {
      const sla = calculateSla(o);
      const manifestStatus = o.manifiestoActual
        ? `v${o.manifiestoActual.version} (${o.manifiestoActual.status})`
        : 'Sin manifiesto';

      return [
        o.numeroPedido || o.folio,
        o.folio,
        new Date(o.fechaOrden).toLocaleDateString('es-MX'),
        o.clienteNombre,
        o.solicitoNombre || '',
        o.solicitoTelefono || '',
        o.ubicacionServicio?.cedi || '',
        o.ubicacionServicio?.division || '',
        o.estado,
        o.proveedorNombre || 'Sin asignar',
        o.numeroRecepcion || '',
        o.numeroFacturacion || o.facturacionPendiente || '',
        manifestStatus,
        sla.days,
        ...(canViewOrderColumns
          ? [
              o.costoTotalCliente.toFixed(2),
              o.costoProveedor !== null ? o.costoProveedor.toFixed(2) : '',
              o.utilidadEstimada !== null ? o.utilidadEstimada.toFixed(2) : '',
            ]
          : []),
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().slice(0, 10);
    link.download = `reporte_logitrack_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden my-4">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-600/30 rounded-lg border border-sky-500/40 text-sky-300">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Generador de Reportes Operativos {canViewGlobalKpis ? 'y Financieros' : ''}
              </h2>
              <p className="text-xs text-slate-400">
                {canViewGlobalKpis
                  ? 'Consulta filtrada de órdenes, cumplimiento de manifiestos, antigüedad y márgenes'
                  : 'Consulta filtrada de órdenes, precios, seguimiento de servicios, recepciones y manifiestos'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredOrders.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV ({filteredOrders.length})
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Filters */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-indigo-600" />
                Filtros del Reporte
              </span>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('TODOS');
                  setClientFilter('TODOS');
                  setProviderFilter('TODOS');
                  setDivisionFilter('TODAS');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Limpiar filtros
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Estado
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-700"
                >
                  <option value="TODOS">Todos</option>
                  <option value="CREADO">CREADO</option>
                  <option value="ASIGNANDO">ASIGNANDO</option>
                  <option value="EN_PROCESO">EN_PROCESO</option>
                  <option value="COMPLETO">COMPLETO</option>
                  <option value="FACTURADO">FACTURADO</option>
                  <option value="FINALIZADO">FINALIZADO</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Cliente
                </label>
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-700"
                >
                  <option value="TODOS">Todos</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Transportista
                </label>
                <select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-700"
                >
                  <option value="TODOS">Todos</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  División CEDI
                </label>
                <select
                  value={divisionFilter}
                  onChange={(e) => setDivisionFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-700"
                >
                  <option value="TODAS">Todas</option>
                  {divisions.map((div) => (
                    <option key={div} value={div}>
                      {div}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  Desde
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  Hasta
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-700 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Summary KPIs (Aggregate Financial KPIs strictly hidden for USER) */}
          <div className={`grid grid-cols-2 ${canViewGlobalKpis ? 'lg:grid-cols-6' : 'lg:grid-cols-4'} gap-3`}>
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Órdenes Filtradas</div>
              <div className="text-xl font-black text-slate-900 mt-1 font-mono">{summary.total}</div>
              <div className="text-[11px] text-slate-500">
                {summary.open} activas / {summary.finalized} cerradas
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Manifiestos Aprobados</div>
              <div className="text-xl font-black text-emerald-700 mt-1 font-mono flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {summary.approvedManifests}
              </div>
              <div className="text-[11px] text-slate-500">
                de {summary.total} órdenes
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Promedio Antigüedad</div>
              <div className="text-xl font-black text-slate-900 mt-1 font-mono flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-400" />
                {summary.avgDays} d
              </div>
              <div className="text-[11px] text-slate-500">Días promedio</div>
            </div>

            {!canViewGlobalKpis && (
              <div className="bg-sky-50/70 p-3.5 rounded-2xl border border-sky-200 shadow-xs">
                <div className="text-[10px] font-bold text-sky-800 uppercase">Nivel de Reporte</div>
                <div className="text-sm font-black text-sky-900 mt-1.5">Operativo por Orden</div>
                <div className="text-[11px] text-sky-700 mt-0.5">Detalle y descarga CSV</div>
              </div>
            )}

            {canViewGlobalKpis && (
              <>
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] font-bold text-indigo-700 uppercase">Total Facturado Cliente</div>
                  <div className="text-base font-black text-indigo-700 mt-1 font-mono">
                    ${summary.totalClientBilling.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] font-bold text-amber-700 uppercase">Costo Proveedores</div>
                  <div className="text-base font-black text-amber-700 mt-1 font-mono">
                    ${summary.totalProviderCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 shadow-xs">
                  <div className="text-[10px] font-bold text-emerald-900 uppercase">Utilidad Estimada</div>
                  <div className="text-base font-black text-emerald-800 mt-1 font-mono">
                    ${summary.totalProfit.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Preview Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-2.5 px-3.5">Pedido & Fecha</th>
                    <th className="py-2.5 px-3.5">Cliente & CEDI</th>
                    <th className="py-2.5 px-3.5">Estado</th>
                    <th className="py-2.5 px-3.5">Transportista</th>
                    <th className="py-2.5 px-3.5">Recepción / Factura</th>
                    <th className="py-2.5 px-3.5">Manifiesto</th>
                    <th className="py-2.5 px-3.5">Antigüedad</th>
                    {canViewOrderColumns && (
                      <>
                        <th className="py-2.5 px-3.5 text-right">Cobro Cliente</th>
                        <th className="py-2.5 px-3.5 text-right">Costo Prov.</th>
                        <th className="py-2.5 px-3.5 text-right">Utilidad Est.</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={canViewOrderColumns ? 10 : 7} className="py-10 text-center text-slate-400">
                        No hay registros que coincidan con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => {
                      const sla = calculateSla(o);
                      return (
                        <tr key={o.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3.5">
                            <div className="font-mono font-bold text-slate-900">{o.numeroPedido || o.folio}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {new Date(o.fechaOrden).toLocaleDateString('es-MX')}
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5">
                            <div className="font-semibold text-slate-800">{o.clienteNombre}</div>
                            {o.ubicacionServicio && (
                              <div className="text-[10px] text-purple-700 flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span>
                                  {o.ubicacionServicio.cedi} ({o.ubicacionServicio.division})
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5">
                            <StatusBadge status={o.estado} size="sm" />
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-700">
                            {o.proveedorNombre || <span className="text-slate-400 italic">Sin asignar</span>}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-600">
                            <div>Rec: {o.numeroRecepcion || '-'}</div>
                            <div>Fac: {o.numeroFacturacion || o.facturacionPendiente || '-'}</div>
                          </td>
                          <td className="py-2.5 px-3.5">
                            <ManifestBadge
                              status={o.manifiestoActual?.status}
                              version={o.manifiestoActual?.version}
                            />
                          </td>
                          <td className="py-2.5 px-3.5">
                            <SlaBadge
                              days={sla.days}
                              color={sla.color}
                              label={sla.label}
                              isFinalized={sla.isFinalized}
                            />
                          </td>
                          {canViewOrderColumns && (
                            <>
                              <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900">
                                ${o.costoTotalCliente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-mono text-slate-600">
                                {o.costoProveedor !== null
                                  ? `$${o.costoProveedor.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                                  : '-'}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                                {o.utilidadEstimada !== null
                                  ? `$${o.utilidadEstimada.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                                  : '-'}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>{filteredOrders.length} orden(es) incluidas en el reporte</span>
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
