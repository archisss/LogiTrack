import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Truck,
  ExternalLink,
} from 'lucide-react';
import type { Order, Provider, Client, OrderStatus, SlaColor } from '../types.ts';
import { calculateSla } from '../domain/rules.ts';
import { StatusBadge, ManifestBadge, SlaBadge } from './StatusBadge.tsx';

interface AdminPortalProps {
  orders: Order[];
  providers: Provider[];
  clients: Client[];
  onOpenNewOrder: () => void;
  onSelectOrder: (order: Order) => void;
  onOpenAcceptanceTests: () => void;
  onOpenProviderCrud: () => void;
  onOpenConceptCatalog: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  orders,
  providers,
  clients,
  onOpenNewOrder,
  onSelectOrder,
  onOpenAcceptanceTests,
  onOpenProviderCrud,
  onOpenConceptCatalog,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [slaFilter, setSlaFilter] = useState<string>('TODOS');
  const [providerFilter, setProviderFilter] = useState<string>('TODOS');

  // Compute metrics
  const metrics = useMemo(() => {
    let totalClientBilling = 0;
    let totalProviderCost = 0;
    let totalEstimatedProfit = 0;
    let openOrdersCount = 0;
    let finalizedOrdersCount = 0;

    const slaCounts: Record<SlaColor, number> = {
      gray: 0,
      green: 0,
      yellow: 0,
      orange: 0,
      red: 0,
    };

    orders.forEach((o) => {
      totalClientBilling += o.costoTotalCliente || 0;
      if (o.costoProveedor !== null) {
        totalProviderCost += o.costoProveedor;
      }
      if (o.utilidadEstimada !== null) {
        totalEstimatedProfit += o.utilidadEstimada;
      }

      if (o.estado === 'FINALIZADO') {
        finalizedOrdersCount++;
      } else {
        openOrdersCount++;
      }

      const sla = calculateSla(o);
      slaCounts[sla.color]++;
    });

    return {
      totalOrders: orders.length,
      openOrdersCount,
      finalizedOrdersCount,
      totalClientBilling,
      totalProviderCost,
      totalEstimatedProfit,
      slaCounts,
    };
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        (o.numeroPedido && o.numeroPedido.toLowerCase().includes(searchTerm.toLowerCase())) ||
        o.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.proveedorNombre && o.proveedorNombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.numeroRecepcion && o.numeroRecepcion.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.numeroFacturacion && o.numeroFacturacion.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'TODOS' || o.estado === statusFilter;
      const matchesProvider = providerFilter === 'TODOS' || o.proveedorId === providerFilter;

      const sla = calculateSla(o);
      const matchesSla = slaFilter === 'TODOS' || sla.color === slaFilter;

      return matchesSearch && matchesStatus && matchesProvider && matchesSla;
    });
  }, [orders, searchTerm, statusFilter, slaFilter, providerFilter]);

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Panel General de Administración
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Control integral de órdenes, costeo, asignación de transportistas y validación de reglas definitivas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenProviderCrud}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition shadow-xs"
            title="Administración y CRUD de Transportistas"
          >
            <Truck className="h-4 w-4 text-blue-600" />
            Transportistas ({providers.length})
          </button>

          <button
            onClick={onOpenConceptCatalog}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition shadow-xs"
            title="Catálogo de Conceptos Estándar"
          >
            <DollarSign className="h-4 w-4 text-emerald-600" />
            Catálogo Conceptos
          </button>

          <button
            onClick={onOpenAcceptanceTests}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition shadow-xs"
          >
            <CheckCircle2 className="h-4 w-4 text-indigo-600" />
            Pruebas (13)
          </button>

          <button
            onClick={onOpenNewOrder}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Nueva Orden
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Órdenes</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.totalOrders}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {metrics.openOrdersCount} abiertas / {metrics.finalizedOrdersCount} finalizadas
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Total Facturado Cliente</div>
          <div className="text-lg font-black text-indigo-700 mt-1 font-mono">
            ${metrics.totalClientBilling.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">costoTotalCliente</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Costo Proveedores</div>
          <div className="text-lg font-black text-amber-700 mt-1 font-mono">
            ${metrics.totalProviderCost.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">costoProveedor</div>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider flex items-center justify-between">
            <span>Utilidad Estimada</span>
            <span className="text-[9px] px-1 bg-emerald-200 text-emerald-900 rounded font-bold">Admin</span>
          </div>
          <div className="text-lg font-black text-emerald-800 mt-1 font-mono">
            ${metrics.totalEstimatedProfit.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Cliente - Proveedor</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs col-span-2">
          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Antigüedad</span>
            <span className="text-[10px] text-slate-400 font-normal">Días transcurridos</span>
          </div>
          <div className="flex items-center justify-between gap-1 text-center">
            <div className="flex-1 bg-emerald-50 rounded-lg py-1 px-1.5 border border-emerald-200">
              <span className="text-xs font-bold text-emerald-800 block">{metrics.slaCounts.green}</span>
              <span className="text-[9px] text-emerald-700 font-semibold block">1-5d</span>
            </div>
            <div className="flex-1 bg-yellow-50 rounded-lg py-1 px-1.5 border border-yellow-200">
              <span className="text-xs font-bold text-yellow-800 block">{metrics.slaCounts.yellow}</span>
              <span className="text-[9px] text-yellow-700 font-semibold block">6-8d</span>
            </div>
            <div className="flex-1 bg-orange-50 rounded-lg py-1 px-1.5 border border-orange-200">
              <span className="text-xs font-bold text-orange-800 block">{metrics.slaCounts.orange}</span>
              <span className="text-[9px] text-orange-700 font-semibold block">9-10d</span>
            </div>
            <div className="flex-1 bg-red-50 rounded-lg py-1 px-1.5 border border-red-200">
              <span className="text-xs font-bold text-red-800 block">{metrics.slaCounts.red}</span>
              <span className="text-[9px] text-red-700 font-semibold block">11d+</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por número de pedido, cliente, proveedor, recepción o factura..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-3 py-2 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="CREADO">CREADO</option>
            <option value="ASIGNANDO">ASIGNANDO</option>
            <option value="EN_PROCESO">EN_PROCESO</option>
            <option value="COMPLETO">COMPLETO</option>
            <option value="FACTURADO">FACTURADO</option>
            <option value="FINALIZADO">FINALIZADO</option>
          </select>

          {/* Antigüedad Filter */}
          <select
            value={slaFilter}
            onChange={(e) => setSlaFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="TODOS">Toda Antigüedad</option>
            <option value="green">1 a 5 días</option>
            <option value="yellow">6 a 8 días</option>
            <option value="orange">9 a 10 días</option>
            <option value="red">11+ días</option>
          </select>

          {/* Provider Filter */}
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="TODOS">Todos los Proveedores</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} {!p.activo ? '(Inactivo)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <th className="py-3 px-4">Número de Pedido & Cliente</th>
                <th className="py-3 px-4">Estado Operativo</th>
                <th className="py-3 px-4">Transportista Asignado</th>
                <th className="py-3 px-4 text-right">Cobro Cliente</th>
                <th className="py-3 px-4 text-right">Costo Prov.</th>
                <th className="py-3 px-4 text-right">Utilidad Est.</th>
                <th className="py-3 px-4">Manifiesto</th>
                <th className="py-3 px-4">Antigüedad</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No se encontraron órdenes que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const sla = calculateSla(o);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => onSelectOrder(o)}
                      className="hover:bg-slate-50/80 cursor-pointer transition group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 group-hover:text-indigo-600 transition">
                          {o.numeroPedido || o.folio}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium truncate max-w-[170px]">
                          {o.clienteNombre}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <StatusBadge status={o.estado} size="sm" />
                      </td>

                      <td className="py-3 px-4">
                        {o.proveedorNombre ? (
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Truck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[150px] font-medium">{o.proveedorNombre}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Sin proveedor (CREADO)</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ${o.costoTotalCliente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {o.costoProveedor !== null
                          ? `$${o.costoProveedor.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                        {o.utilidadEstimada !== null
                          ? `$${o.utilidadEstimada.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </td>

                      <td className="py-3 px-4">
                        <ManifestBadge
                          status={o.manifiestoActual?.status}
                          version={o.manifiestoActual?.version}
                        />
                      </td>

                      <td className="py-3 px-4">
                        <SlaBadge days={sla.days} color={sla.color} label={sla.label} isFinalized={sla.isFinalized} />
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectOrder(o);
                          }}
                          className="px-3 py-1 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-semibold rounded-lg text-xs transition"
                        >
                          Gestionar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <span>Mostrando {filteredOrders.length} de {orders.length} órdenes</span>
          <span className="italic">Haga clic en cualquier fila para inspeccionar o gestionar la orden</span>
        </div>
      </div>
    </div>
  );
};
