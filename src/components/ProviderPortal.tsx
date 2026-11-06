import React, { useState, useMemo } from 'react';
import {
  Truck,
  Upload,
  Play,
  CheckCircle,
  AlertCircle,
  FileText,
  Search,
  ShieldCheck,
  Eye,
  Clock,
  File,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import type { Order, Provider } from '../types.ts';
import { calculateSla } from '../domain/rules.ts';
import { StatusBadge, ManifestBadge, SlaBadge } from './StatusBadge.tsx';

interface ProviderPortalProps {
  orders: Order[];
  providers: Provider[];
  activeProviderId: string;
  onSelectProvider: (providerId: string) => void;
  onOrderUpdated: () => void;
  onSelectOrder: (order: Order) => void;
}

export const ProviderPortal: React.FC<ProviderPortalProps> = ({
  orders,
  providers,
  activeProviderId,
  onSelectProvider,
  onOrderUpdated,
  onSelectOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [uploadingOrder, setUploadingOrder] = useState<Order | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [fileSizeFormatted, setFileSizeFormatted] = useState<string>('');
  const [fileTypeError, setFileTypeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const activeProvider = providers.find((p) => p.id === activeProviderId) || providers[0];

  // Provider only sees their assigned orders
  const assignedOrders = useMemo(() => {
    return orders.filter((o) => o.proveedorId === activeProvider?.id);
  }, [orders, activeProvider?.id]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return assignedOrders.filter((o) => {
      const matchesSearch =
        (o.numeroPedido && o.numeroPedido.toLowerCase().includes(searchTerm.toLowerCase())) ||
        o.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.numeroRecepcion && o.numeroRecepcion.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'TODOS' || o.estado === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [assignedOrders, searchTerm, statusFilter]);

  const handleStartProcess = async (orderId: string) => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/start-process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: activeProvider.id,
          user: activeProvider.email || activeProvider.nombre,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedback({
        type: 'success',
        message: 'Recolección iniciada. La orden cambió a EN_PROCESO.',
      });
      onOrderUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileTypeError(null);
    const isValidPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isValidJpg =
      file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name);

    if (!isValidPdf && !isValidJpg) {
      setFileTypeError('Solo se admiten archivos en formato PDF o Imagen (JPG, PNG).');
      return;
    }

    const sizeMb = file.size / (1024 * 1024);
    const formattedSize = sizeMb >= 1 ? `${sizeMb.toFixed(2)} MB` : `${(file.size / 1024).toFixed(1)} KB`;

    setSelectedFileName(file.name);
    setFileSizeFormatted(formattedSize);

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileDataUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadManifest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadingOrder || !selectedFileName.trim()) return;

    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/orders/${uploadingOrder.id}/manifest/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFileName.trim(),
          fileSize: fileSizeFormatted || '1.2 MB',
          fileDataUrl: fileDataUrl || undefined,
          user: activeProvider.nombre,
          providerId: activeProvider.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedback({
        type: 'success',
        message: 'Manifiesto (PDF/Imagen) subido con éxito en estado PENDING. En espera de revisión.',
      });
      setUploadingOrder(null);
      setSelectedFileName('');
      setFileDataUrl(null);
      setFileSizeFormatted('');
      setFileTypeError(null);
      onOrderUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-200">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Portal del Transportista</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                Rol: Proveedor
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Listado compacto de recolecciones asignadas, control de rutas y gestión de manifiestos
            </p>
          </div>
        </div>

        {/* Provider switcher */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-600">Transportista activo:</label>
          <select
            value={activeProvider?.id}
            onChange={(e) => onSelectProvider(e.target.value)}
            className="text-xs font-bold rounded-xl border border-slate-300 px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {providers
              .filter((p) => p.activo)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Privacy Guarantee banner */}
      <div className="bg-slate-900 text-slate-200 px-5 py-3 rounded-2xl flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Privacidad de Negocio Enforzada:</strong> Visualiza únicamente sus órdenes asignadas. Los costos totales al cliente y la utilidad comercial están protegidos.
          </span>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">RFC: {activeProvider?.rfc}</span>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)}>✕</button>
        </div>
      )}

      {/* Search and Filters Bar (Same compact style as Admin) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar en sus órdenes por número de pedido, cliente o número de recepción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-3 py-2 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="TODOS">Todos los Estados</option>
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
                <th className="py-3 px-4">Número de Pedido & Cliente</th>
                <th className="py-3 px-4">Estado Operativo</th>
                <th className="py-3 px-4">Antigüedad</th>
                <th className="py-3 px-4">Manifiesto Actual</th>
                <th className="py-3 px-4">Nº Recepción</th>
                <th className="py-3 px-4 text-right">Su Tarifa Cobrada</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No se encontraron órdenes asignadas para este transportista.
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
                        <div className="font-mono font-bold text-slate-900 group-hover:text-blue-600 transition">
                          {o.numeroPedido || o.folio}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium truncate max-w-[200px]">
                          {o.clienteNombre}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <StatusBadge status={o.estado} size="sm" />
                      </td>

                      <td className="py-3 px-4">
                        <SlaBadge days={sla.days} color={sla.color} label={sla.label} isFinalized={sla.isFinalized} />
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <ManifestBadge
                            status={o.manifiestoActual?.status}
                            version={o.manifiestoActual?.version}
                          />
                          {o.manifiestoActual?.status === 'REJECTED' && (
                            <div className="text-[10px] text-red-700 font-medium">
                              Rechazado: {o.manifiestoActual.rejectionReason}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-700">
                        {o.numeroRecepcion || <span className="text-slate-400 italic">Pendiente</span>}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                        {o.costoProveedor !== null
                          ? `$${o.costoProveedor.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                          : '-'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onSelectOrder(o)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-bold rounded-lg text-xs transition"
                          >
                            Ver Detalle
                          </button>

                          {/* Acciones del transportista: Subir manifiesto cuando la orden esté en proceso o completa */}
                          {(o.estado === 'EN_PROCESO' || o.estado === 'COMPLETO' || o.estado === 'FACTURADO') && (
                            <button
                              onClick={() => {
                                setUploadingOrder(o);
                                setSelectedFileName(`manifiesto_${o.folio.toLowerCase()}_v${o.manifiestos.length + 1}.pdf`);
                                setFileDataUrl(null);
                                setFileSizeFormatted('');
                                setFileTypeError(null);
                              }}
                              className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-bold rounded-lg text-xs flex items-center gap-1 transition"
                              title="Cargar manifiesto (PDF o Imagen)"
                            >
                              <Upload className="h-3 w-3" />
                              Manifiesto
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
          <span>Mostrando {filteredOrders.length} de {assignedOrders.length} órdenes asignadas</span>
          <span className="italic">Haga clic en cualquier fila para inspeccionar el detalle</span>
        </div>
      </div>

      {/* Upload Manifest Quick Modal con soporte PDF y JPG */}
      {uploadingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-200">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Cargar Manifiesto Oficial de Recolección
                  </h3>
                  <p className="text-xs text-slate-500">
                    Orden: <span className="font-mono font-bold text-blue-700">{uploadingOrder.numeroPedido || uploadingOrder.folio}</span> &bull; {uploadingOrder.clienteNombre}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setUploadingOrder(null);
                  setFileDataUrl(null);
                  setFileTypeError(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Adjunte el manifiesto firmado y sellado (versión <strong>{uploadingOrder.manifiestos.length + 1}</strong>). Se admiten archivos en formato <strong>PDF</strong> o <strong>Imagen JPG / PNG</strong>. Al subirlo pasará a estado <strong>PENDING</strong> para revisión de administración.
            </p>

            {fileTypeError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{fileTypeError}</span>
              </div>
            )}

            <form onSubmit={handleUploadManifest} className="space-y-4">
              {/* Selector de Archivo PDF / JPG */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center justify-between">
                  <span>Archivo del Manifiesto (PDF o JPG) *</span>
                  <span className="text-[10px] text-blue-600 font-semibold lowercase">archivo digital</span>
                </label>

                {!fileDataUrl ? (
                  <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition text-center group">
                    <div className="flex items-center gap-2 text-slate-400 group-hover:text-blue-600 mb-2">
                      <FileText className="h-7 w-7" />
                      <ImageIcon className="h-7 w-7" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">
                      Haga clic para seleccionar o arrastre el archivo aquí
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">
                      Formatos permitidos: <strong>PDF</strong>, <strong>JPG</strong>, <strong>JPEG</strong>, <strong>PNG</strong> (hasta 10 MB)
                    </span>
                    <input
                      type="file"
                      accept=".pdf,image/jpeg,image/jpg,image/png,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      required={!fileDataUrl}
                    />
                  </label>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl border border-blue-200 flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      {fileDataUrl.startsWith('data:image/') || selectedFileName.match(/\.(jpg|jpeg|png)$/i) ? (
                        <img
                          src={fileDataUrl}
                          alt="Vista previa"
                          className="h-12 w-12 object-cover rounded-lg border border-slate-200 shadow-xs shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-red-100 text-red-700 font-bold flex items-center justify-center shrink-0 border border-red-200">
                          <FileText className="h-6 w-6" />
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-slate-900 truncate max-w-[240px]">
                          {selectedFileName}
                        </div>
                        <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Archivo cargado ({fileSizeFormatted || 'Listo'})</span>
                        </div>
                      </div>
                    </div>

                    <label className="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer underline">
                      Cambiar
                      <input
                        type="file"
                        accept=".pdf,image/jpeg,image/jpg,image/png,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Nombre del Documento */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nombre descriptivo del documento *
                </label>
                <input
                  type="text"
                  value={selectedFileName}
                  onChange={(e) => setSelectedFileName(e.target.value)}
                  placeholder="Ej. Manifiesto_Folio_001_v1.pdf"
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                  required
                />
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setUploadingOrder(null);
                    setFileDataUrl(null);
                    setFileTypeError(null);
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-600 text-xs rounded-xl hover:bg-slate-50 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedFileName.trim() || !fileDataUrl}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5 transition"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {loading ? 'Subiendo...' : `Subir Manifiesto v${uploadingOrder.manifiestos.length + 1}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
