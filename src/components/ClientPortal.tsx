import React, { useState, useMemo } from 'react';
import {
  Building2,
  FileText,
  DollarSign,
  Download,
  CheckCircle,
  Clock,
  ShieldCheck,
  Search,
  Eye,
} from 'lucide-react';
import type { Order, Client } from '../types.ts';
import { calculateSla } from '../domain/rules.ts';
import { StatusBadge, ManifestBadge, SlaBadge } from './StatusBadge.tsx';

interface ClientPortalProps {
  orders: Order[];
  clients: Client[];
  activeClientId: string;
  onSelectClient: (clientId: string) => void;
  onSelectOrder: (order: Order) => void;
}

export const ClientPortal: React.FC<ClientPortalProps> = ({
  orders,
  clients,
  activeClientId,
  onSelectClient,
  onSelectOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  const activeClient = clients.find((c) => c.id === activeClientId) || clients[0];

  // Client only sees their own orders
  const clientOrders = useMemo(() => {
    return orders.filter((o) => o.clienteId === activeClient?.id);
  }, [orders, activeClient?.id]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return clientOrders.filter((o) => {
      const matchesSearch =
        (o.numeroPedido && o.numeroPedido.toLowerCase().includes(searchTerm.toLowerCase())) ||
        o.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.numeroRecepcion && o.numeroRecepcion.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.numeroFacturacion && o.numeroFacturacion.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'TODOS' || o.estado === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [clientOrders, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Portal del Cliente</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                Rol: Cliente
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Listado compacto de recolecciones, importes autorizados y consulta de manifiestos certificados
            </p>
          </div>
        </div>

        {/* Client selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-600">Empresa Cliente:</label>
          <select
            value={activeClient?.id}
            onChange={(e) => onSelectClient(e.target.value)}
            className="text-xs font-bold rounded-xl border border-slate-300 px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Privacy guarantee */}
      <div className="bg-slate-900 text-slate-200 px-5 py-3 rounded-2xl flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Transparencia y Protección de Datos:</strong> Visualiza los importes autorizados y manifiestos formalmente aprobados. Los costos operativos internos y márgenes comerciales están protegidos.
          </span>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">RFC: {activeClient?.rfc}</span>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por número de pedido, número de recepción o factura..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-3 py-2 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

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
      </div>

      {/* Compact Table View matching Admin */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <th className="py-3 px-4">Número de Pedido</th>
                <th className="py-3 px-4">Estado Operativo</th>
                <th className="py-3 px-4">Antigüedad</th>
                <th className="py-3 px-4">Manifiesto Oficial</th>
                <th className="py-3 px-4">Nº Recepción</th>
                <th className="py-3 px-4">Nº Factura</th>
                <th className="py-3 px-4 text-right">Total Cobrado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No se encontraron órdenes registradas para esta empresa cliente.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const sla = calculateSla(o);
                  const approvedManifest = o.manifiestos.find((m) => m.status === 'APPROVED');

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
                        <div className="text-[10px] text-slate-400">
                          {new Date(o.fechaOrden).toLocaleDateString('es-MX')}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <StatusBadge status={o.estado} size="sm" />
                      </td>

                      <td className="py-3 px-4">
                        <SlaBadge days={sla.days} color={sla.color} label={sla.label} isFinalized={sla.isFinalized} />
                      </td>

                      <td className="py-3 px-4">
                        {approvedManifest ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                            <CheckCircle className="h-3 w-3 text-emerald-600" />
                            <span>Certificado (v{approvedManifest.version})</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>En trámite</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-700">
                        {o.numeroRecepcion || <span className="text-slate-400 italic">-</span>}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-700">
                        {o.numeroFacturacion || <span className="text-slate-400 italic">-</span>}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                        ${o.costoTotalCliente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onSelectOrder(o)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-bold rounded-lg text-xs transition"
                          >
                            Ver Detalle
                          </button>

                          {approvedManifest && (
                            <button
                              onClick={() => alert(`Descargando manifiesto certificado: ${approvedManifest.fileName}`)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                              title="Descargar manifiesto"
                            >
                              <Download className="h-3 w-3" />
                              PDF
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

        {/* Table footer */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <span>Mostrando {filteredOrders.length} de {clientOrders.length} órdenes</span>
          <span className="italic">Haga clic en cualquier fila para inspeccionar el desglose de conceptos</span>
        </div>
      </div>
    </div>
  );
};
