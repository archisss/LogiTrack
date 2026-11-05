export type Role = 'ADMIN' | 'PROVIDER' | 'CLIENT';

export type OrderStatus =
  | 'CREADO'
  | 'ASIGNANDO'
  | 'EN_PROCESO'
  | 'COMPLETO'
  | 'FACTURADO'
  | 'FINALIZADO';

export type ManifestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ServiceLocationAddress {
  calleNumero: string; // Calle y número [Nombre de la vía] [Número] * (ej: Av. de la Independencia 125)
  colonia?: string; // Colonia o Barrio (Opcional) (ej: Parque Industrial Poniente)
  ciudad: string; // Ciudad o Municipio * (ej: Tlalnepantla)
  estado: string; // Estado / Entidad * (ej: Estado de México)
  codigoPostal: string; // Código Postal (C.P.) * (ej: 54030)
}

export interface ServiceLocation {
  id: string;
  division: string; // Sur, Norte, Centro, Bajío, Occidente, etc.
  cedi: string; // TLALPIZAHUAC, AMECA-MECA, TLALNEPANTLA, etc.
  direccion: ServiceLocationAddress;
  activo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CatalogConcept {
  id: string;
  item?: string; // Campo opcional
  unidad: string; // ST, KG, LT, M3, etc.
  descripcion: string; // Campo obligatorio
  precioUnitario: number;
}

export interface ItemConcept {
  id: string;
  item?: string; // Campo opcional
  unidad: string; // ST, KG, LT, etc.
  descripcion: string; // Campo obligatorio con el concepto
  cantidad: number;
  cantidadOrdenada: number;
  precioUnitario: number;
  importe: number; // cantidad * precioUnitario calculated via Decimal
}

export interface ManifestDocument {
  version: number;
  fileName: string;
  fileSize?: string;
  fileDataUrl?: string; // Stored securely/privately
  uploadedBy: string;
  uploadedAt: string; // ISO
  status: ManifestStatus;
  reviewedBy?: string;
  reviewedAt?: string; // ISO
  rejectionReason?: string;
  isCurrent: boolean;
}

export interface HistoryEntry {
  id: string;
  timestamp: string; // ISO
  action: string;
  prevStatus?: OrderStatus;
  newStatus?: OrderStatus;
  user: string;
  role: Role;
  comment?: string;
  details?: Record<string, any>;
}

export interface ProviderAddress {
  calleNumero: string; // [Nombre de la vía] [Número] (ej: Av. de la Independencia 125)
  colonia?: string; // Colonia o Barrio (Opcional)
  ciudad: string; // Ciudad o Municipio
  estado: string; // Estado, Provincia o Entidad federativa
  codigoPostal: string; // Código Postal (5 dígitos)
}

export interface ProviderAuthorizationDoc {
  fileName: string;
  fileType?: string; // pdf | image
  fileDataUrl?: string;
  uploadedAt: string;
}

export interface Provider {
  id: string;
  nombre: string;
  rfc: string; // ÚNICO
  activo: boolean;
  telefono: string;
  email: string;
  direccion?: ProviderAddress;
  autorizacionDocumento?: ProviderAuthorizationDoc;
}

export interface Client {
  id: string;
  nombre: string;
  rfc: string;
  email: string;
  telefono: string;
}

export interface Order {
  id: string;
  numeroPedido: string; // Identificador / ID del pedido
  folio: string; // Folio de proceso interno
  clienteId: string;
  clienteNombre: string;
  proveedorId: string | null;
  proveedorNombre: string | null;
  fechaOrden: string; // ISO
  ubicacionServicio?: ServiceLocation; // Ubicación para el servicio / CEDI
  conceptos: ItemConcept[];
  
  // Costos e importes
  subtotalCliente: number;
  costoTotalCliente: number;
  costoProveedor: number | null;
  utilidadEstimada: number | null; // Informativa, strictly Admin only
  
  // Estados operativos y documentales
  estado: OrderStatus;
  
  // Recepción
  numeroRecepcion: string | null;
  recepcionRegistradaPor: string | null;
  
  // Facturación
  numeroFacturacion: string | null;
  facturacionRegistradaPor: string | null;
  facturacionPendiente: string | null; // Si se registra antes de COMPLETO
  
  // Fechas e hitos
  createdAt: string;
  assignedAt: string | null;
  startedAt: string | null;
  receptionRecordedAt: string | null;
  manifestUploadedAt: string | null;
  manifestReviewedAt: string | null;
  invoicedAt: string | null;
  finalizedAt: string | null;

  // Manifiestos
  manifiestos: ManifestDocument[];
  manifiestoActual: ManifestDocument | null;

  // Historial de auditoría
  historial: HistoryEntry[];
}

export type SlaColor = 'gray' | 'green' | 'yellow' | 'orange' | 'red';

export interface SlaInfo {
  days: number;
  color: SlaColor;
  label: string;
  referenceDate: string;
  endDate: string;
  isFinalized: boolean;
}

export interface DatabaseStatus {
  connected: boolean;
  type: string;
  version?: string;
  database?: string;
  host?: string;
  error?: string;
}
