import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Decimal from 'decimal.js';
import 'dotenv/config';
import type {
  Order,
  OrderStatus,
  Role,
  Provider,
  Client,
  ItemConcept,
  CatalogConcept,
  ManifestDocument,
  HistoryEntry,
  ServiceLocation,
  AppUser,
} from './src/types.ts';
import {
  calculateOrderTotals,
  calculateItemImporte,
  evaluateOrderStateTransition,
  canFinalizeOrder,
  sanitizeOrderByRole,
} from './src/domain/rules.ts';
import { runAcceptanceTests } from './src/domain/acceptanceTests.ts';
import {
  initDatabase,
  getDbStatus,
  dbGetProviders,
  dbGetProviderById,
  dbCreateProvider,
  dbUpdateProvider,
  dbDeleteProvider,
  dbGetClients,
  dbGetClientById,
  dbGetCatalogConcepts,
  dbGetCatalogConceptById,
  dbCreateCatalogConcept,
  dbUpdateCatalogConcept,
  dbDeleteCatalogConcept,
  dbGetServiceLocations,
  dbGetServiceLocationById,
  dbCreateServiceLocation,
  dbUpdateServiceLocation,
  dbDeleteServiceLocation,
  dbGetOrders,
  dbGetOrderById,
  dbCreateOrder,
  dbUpdateOrder,
  dbResetData,
  type SeedUser,
  verifyPassword,
  dbGetUsers,
  dbGetUserById,
  dbGetUserByEmailWithPassword,
  dbCreateUser,
  dbUpdateUser,
  dbDeleteUser,
  dbCreateSession,
  dbGetSessionUser,
  dbDeleteSession,
} from './src/server/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initial benchmark seed providers
const SEED_PROVIDERS: Provider[] = [
  {
    id: 'prov-1',
    nombre: 'Transportes Ecológicos del Centro SA de CV',
    rfc: 'TEC190820AA1',
    activo: true,
    telefono: '55-1234-5678',
    email: 'contacto@tecolgicos.mx',
    direccion: {
      calleNumero: 'Av. de la Independencia 125',
      colonia: 'Parque Industrial Poniente',
      ciudad: 'Tlalnepantla',
      estado: 'Estado de México',
      codigoPostal: '54030',
    },
    autorizacionDocumento: {
      fileName: 'autorizacion_semarnat_tec1908.pdf',
      fileType: 'application/pdf',
      uploadedAt: '2026-01-10T08:00:00.000Z',
    },
  },
  {
    id: 'prov-2',
    nombre: 'Fletes Rápidos y Logística Industrial',
    rfc: 'FRL200115BB2',
    activo: true,
    telefono: '55-8765-4321',
    email: 'operaciones@fletesrapidos.com',
    direccion: {
      calleNumero: 'Carretera Central Km 14',
      colonia: 'Zona Industrial San Luis',
      ciudad: 'San Luis Potosí',
      estado: 'San Luis Potosí',
      codigoPostal: '78395',
    },
    autorizacionDocumento: {
      fileName: 'permiso_sct_transporte_frl20.pdf',
      fileType: 'application/pdf',
      uploadedAt: '2026-02-15T10:30:00.000Z',
    },
  },
  {
    id: 'prov-3',
    nombre: 'Recolecciones Especializadas del Bajío',
    rfc: 'REB180402CC3',
    activo: true,
    telefono: '47-7123-9988',
    email: 'bajio@recolecciones.com',
    direccion: {
      calleNumero: 'Blvd. Aeropuerto 5002',
      colonia: 'Industrial Delta',
      ciudad: 'León',
      estado: 'Guanajuato',
      codigoPostal: '37545',
    },
    autorizacionDocumento: {
      fileName: 'autorizacion_recolecciones_reb18.pdf',
      fileType: 'application/pdf',
      uploadedAt: '2026-03-01T14:00:00.000Z',
    },
  },
  {
    id: 'prov-4',
    nombre: 'Transportes Inactivos de Prueba',
    rfc: 'TIP101010ZZ9',
    activo: false,
    telefono: '55-0000-0000',
    email: 'inactivo@prueba.com',
    direccion: {
      calleNumero: 'Calle Reforma 10',
      colonia: 'Centro',
      ciudad: 'Querétaro',
      estado: 'Querétaro',
      codigoPostal: '76000',
    },
  },
];

// Initial benchmark seed clients
const SEED_CLIENTS: Client[] = [
  {
    id: 'client-1',
    nombre: 'Bimbo México SA de CV',
    rfc: 'BIM750101XYZ',
    email: 'logistica@bimbo.com',
    telefono: '55-5268-6600',
  },
  {
    id: 'client-2',
    nombre: 'Grupo Modelo S de RL de CV',
    rfc: 'GMO800315ABC',
    email: 'recolecciones@grupomodelo.com',
    telefono: '55-2266-0000',
  },
  {
    id: 'client-3',
    nombre: 'Femsa Coca-Cola México',
    rfc: 'FEM920625123',
    email: 'ambiental@femsa.com',
    telefono: '81-8328-6000',
  },
];

// Initial benchmark seed catalog concepts
const SEED_CATALOG_CONCEPTS: CatalogConcept[] = [
  { id: 'cat-1', item: '', unidad: 'KG', descripcion: 'Solido contaminado', precioUnitario: 12.0 },
  { id: 'cat-2', item: '', unidad: 'ST', descripcion: 'Flete lodos', precioUnitario: 2500.0 },
  { id: 'cat-3', item: '', unidad: 'KG', descripcion: 'Filtros', precioUnitario: 12.0 },
  { id: 'cat-4', item: '', unidad: 'LT', descripcion: 'Liquidos y aceites lubricantes', precioUnitario: 1.0 },
  { id: 'cat-5', item: '', unidad: 'KG', descripcion: 'Manejo especial llantas', precioUnitario: 3.6 },
  { id: 'cat-6', item: '', unidad: 'KG', descripcion: 'Manejo y retiro de lodos', precioUnitario: 12.0 },
  { id: 'cat-7', item: '', unidad: 'ST', descripcion: 'Flete Llantas 51 a 100', precioUnitario: 13500.0 },
  { id: 'cat-8', item: '', unidad: 'TAMBO', descripcion: 'Tambos de Aceite Usado (200L)', precioUnitario: 950.0 },
  { id: 'cat-9', item: '', unidad: 'ST', descripcion: 'Certificado de Disposición Final', precioUnitario: 800.0 },
];

// Initial benchmark seed service locations (CEDIs para servicios)
const SEED_SERVICE_LOCATIONS: ServiceLocation[] = [
  {
    id: 'cedi-1',
    division: 'Centro',
    cedi: 'TLALPIZAHUAC',
    direccion: {
      calleNumero: 'Av. Cuauhtémoc 45',
      colonia: 'Tlalpizahuac',
      ciudad: 'Ixtapaluca',
      estado: 'Estado de México',
      codigoPostal: '56560',
    },
    activo: true,
  },
  {
    id: 'cedi-2',
    division: 'Oriente',
    cedi: 'AMECA-MECA',
    direccion: {
      calleNumero: 'Carretera México-Cuautla Km 58',
      colonia: 'San Juan',
      ciudad: 'Amecameca',
      estado: 'Estado de México',
      codigoPostal: '56900',
    },
    activo: true,
  },
  {
    id: 'cedi-3',
    division: 'Centro',
    cedi: 'TLALNEPANTLA',
    direccion: {
      calleNumero: 'Av. de la Independencia 125',
      colonia: 'Parque Industrial Poniente',
      ciudad: 'Tlalnepantla',
      estado: 'Estado de México',
      codigoPostal: '54030',
    },
    activo: true,
  },
  {
    id: 'cedi-4',
    division: 'Sur',
    cedi: 'PUEBLA SUR',
    direccion: {
      calleNumero: 'Av. 16 de Septiembre 4500',
      colonia: 'El Carmen',
      ciudad: 'Puebla',
      estado: 'Puebla',
      codigoPostal: '72530',
    },
    activo: true,
  },
  {
    id: 'cedi-5',
    division: 'Occidente',
    cedi: 'GUADALAJARA',
    direccion: {
      calleNumero: 'Calzada González Gallo 1890',
      colonia: 'Atlas',
      ciudad: 'Guadalajara',
      estado: 'Jalisco',
      codigoPostal: '44870',
    },
    activo: true,
  },
  {
    id: 'cedi-6',
    division: 'Norte',
    cedi: 'MONTERREY NORTE',
    direccion: {
      calleNumero: 'Av. Gonzalitos 840',
      colonia: 'Mitras Centro',
      ciudad: 'Monterrey',
      estado: 'Nuevo León',
      codigoPostal: '64020',
    },
    activo: true,
  },
];

// Helper to create date relative to now in ISO
function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function getInitialSeedOrders(): Order[] {
  const ord1Items: ItemConcept[] = [
    { id: 'item-101', item: '', unidad: 'KG', descripcion: 'Solido contaminado', cantidad: 110.0, cantidadOrdenada: 110.0, precioUnitario: 12.0, importe: 1320.0 },
    { id: 'item-102', item: '', unidad: 'ST', descripcion: 'Flete lodos', cantidad: 1.0, cantidadOrdenada: 1.0, precioUnitario: 2500.0, importe: 2500.0 },
    { id: 'item-103', item: '', unidad: 'KG', descripcion: 'Filtros', cantidad: 60.0, cantidadOrdenada: 60.0, precioUnitario: 12.0, importe: 720.0 },
    { id: 'item-104', item: '', unidad: 'LT', descripcion: 'Liquidos y aceites lubricantes', cantidad: 1000.0, cantidadOrdenada: 1000.0, precioUnitario: 1.0, importe: 1000.0 },
    { id: 'item-105', item: '', unidad: 'KG', descripcion: 'Manejo especial llantas', cantidad: 2970.0, cantidadOrdenada: 2970.0, precioUnitario: 3.6, importe: 10692.0 },
    { id: 'item-106', item: '', unidad: 'KG', descripcion: 'Manejo y retiro de lodos', cantidad: 135.0, cantidadOrdenada: 135.0, precioUnitario: 12.0, importe: 1620.0 },
    { id: 'item-107', item: '', unidad: 'ST', descripcion: 'Flete Llantas 51 a 100', cantidad: 1.0, cantidadOrdenada: 1.0, precioUnitario: 13500.0, importe: 13500.0 },
  ];
  const ord1Totals = calculateOrderTotals(ord1Items, null);

  const ord2Items: ItemConcept[] = [
    { id: 'item-201', item: '', unidad: 'TAMBO', descripcion: 'Tambos de Aceite Usado (200L)', cantidad: 5, cantidadOrdenada: 5, precioUnitario: 950.0, importe: 4750.0 },
    { id: 'item-202', item: '', unidad: 'ST', descripcion: 'Certificado de Disposición Final', cantidad: 1, cantidadOrdenada: 1, precioUnitario: 800.0, importe: 800.0 },
  ];
  const ord2Totals = calculateOrderTotals(ord2Items, 3200.0);

  const ord3Items: ItemConcept[] = [
    { id: 'item-301', item: '', unidad: 'KG', descripcion: 'Manejo y retiro de lodos', cantidad: 3, cantidadOrdenada: 3, precioUnitario: 2400.0, importe: 7200.0 },
  ];
  const ord3Totals = calculateOrderTotals(ord3Items, 4500.0);

  const ord4Items: ItemConcept[] = [
    { id: 'item-401', item: '', unidad: 'KG', descripcion: 'Solido contaminado', cantidad: 750, cantidadOrdenada: 750, precioUnitario: 12.0, importe: 9000.0 },
    { id: 'item-402', item: '', unidad: 'ST', descripcion: 'Flete lodos', cantidad: 1, cantidadOrdenada: 1, precioUnitario: 1500.0, importe: 1500.0 },
  ];
  const ord4Totals = calculateOrderTotals(ord4Items, 6200.0);

  const ord5Items: ItemConcept[] = [
    { id: 'item-501', item: '', unidad: 'LT', descripcion: 'Liquidos y aceites lubricantes', cantidad: 7400, cantidadOrdenada: 7400, precioUnitario: 1.0, importe: 7400.0 },
  ];
  const ord5Totals = calculateOrderTotals(ord5Items, 4800.0);

  const ord6Items: ItemConcept[] = [
    { id: 'item-601', item: '', unidad: 'KG', descripcion: 'Manejo especial llantas', cantidad: 1388.89, cantidadOrdenada: 1388.89, precioUnitario: 3.6, importe: 5000.0 },
  ];
  const ord6Totals = calculateOrderTotals(ord6Items, 3100.0);

  return [
    // 1. CREADO (sin proveedor, 2 días desde fechaOrden -> SLA Verde)
    {
      id: 'ORD-2026-001',
      numeroPedido: 'PED-2026-001',
      folio: 'FOL-001',
      clienteId: 'client-1',
      clienteNombre: 'Bimbo México SA de CV',
      proveedorId: null,
      proveedorNombre: null,
      fechaOrden: daysAgoIso(2),
      conceptos: ord1Items,
      subtotalCliente: ord1Totals.subtotalCliente,
      costoTotalCliente: ord1Totals.costoTotalCliente,
      costoProveedor: null,
      utilidadEstimada: null,
      estado: 'CREADO',
      numeroRecepcion: null,
      recepcionRegistradaPor: null,
      numeroFacturacion: null,
      facturacionRegistradaPor: null,
      facturacionPendiente: null,
      createdAt: daysAgoIso(2),
      assignedAt: null,
      startedAt: null,
      receptionRecordedAt: null,
      manifestUploadedAt: null,
      manifestReviewedAt: null,
      invoicedAt: null,
      finalizedAt: null,
      manifiestos: [],
      manifiestoActual: null,
      historial: [
        {
          id: 'h-101',
          timestamp: daysAgoIso(2),
          action: 'CREACION_ORDEN',
          newStatus: 'CREADO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
          comment: 'Orden creada por administración sin proveedor inicial asignado.',
        },
      ],
    },

    // 2. ASIGNANDO (asignado hace 7 días -> SLA Amarillo)
    {
      id: 'ORD-2026-002',
      numeroPedido: 'PED-2026-002',
      folio: 'FOL-002',
      clienteId: 'client-2',
      clienteNombre: 'Grupo Modelo S de RL de CV',
      proveedorId: 'prov-1',
      proveedorNombre: 'Transportes Ecológicos del Centro SA de CV',
      fechaOrden: daysAgoIso(8),
      conceptos: ord2Items,
      subtotalCliente: ord2Totals.subtotalCliente,
      costoTotalCliente: ord2Totals.costoTotalCliente,
      costoProveedor: ord2Totals.costoProveedor,
      utilidadEstimada: ord2Totals.utilidadEstimada,
      estado: 'ASIGNANDO',
      numeroRecepcion: null,
      recepcionRegistradaPor: null,
      numeroFacturacion: null,
      facturacionRegistradaPor: null,
      facturacionPendiente: null,
      createdAt: daysAgoIso(8),
      assignedAt: daysAgoIso(7),
      startedAt: null,
      receptionRecordedAt: null,
      manifestUploadedAt: null,
      manifestReviewedAt: null,
      invoicedAt: null,
      finalizedAt: null,
      manifiestos: [],
      manifiestoActual: null,
      historial: [
        {
          id: 'h-201',
          timestamp: daysAgoIso(8),
          action: 'CREACION_ORDEN',
          newStatus: 'CREADO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
          comment: 'Orden creada.',
        },
        {
          id: 'h-202',
          timestamp: daysAgoIso(7),
          action: 'ASIGNACION_PROVEEDOR',
          prevStatus: 'CREADO',
          newStatus: 'ASIGNANDO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
          comment: 'Proveedor asignado: Transportes Ecológicos del Centro. Costo convenido: $3,200.00 MXN',
        },
      ],
    },

    // 3. EN_PROCESO (asignado hace 9 días -> SLA Naranja, manifiesto v1 PENDING cargado)
    {
      id: 'ORD-2026-003',
      numeroPedido: 'PED-2026-003',
      folio: 'FOL-003',
      clienteId: 'client-3',
      clienteNombre: 'Femsa Coca-Cola México',
      proveedorId: 'prov-2',
      proveedorNombre: 'Fletes Rápidos y Logística Industrial',
      fechaOrden: daysAgoIso(10),
      conceptos: ord3Items,
      subtotalCliente: ord3Totals.subtotalCliente,
      costoTotalCliente: ord3Totals.costoTotalCliente,
      costoProveedor: ord3Totals.costoProveedor,
      utilidadEstimada: ord3Totals.utilidadEstimada,
      estado: 'EN_PROCESO',
      numeroRecepcion: null,
      recepcionRegistradaPor: null,
      numeroFacturacion: null,
      facturacionRegistradaPor: null,
      facturacionPendiente: null,
      createdAt: daysAgoIso(10),
      assignedAt: daysAgoIso(9),
      startedAt: daysAgoIso(8),
      receptionRecordedAt: null,
      manifestUploadedAt: daysAgoIso(1),
      manifestReviewedAt: null,
      invoicedAt: null,
      finalizedAt: null,
      manifiestos: [
        {
          version: 1,
          fileName: 'manifiesto_femsa_lodos_v1.pdf',
          fileSize: '1.4 MB',
          uploadedBy: 'chofer.fletes@rapidos.com',
          uploadedAt: daysAgoIso(1),
          status: 'PENDING',
          isCurrent: true,
        },
      ],
      manifiestoActual: {
        version: 1,
        fileName: 'manifiesto_femsa_lodos_v1.pdf',
        fileSize: '1.4 MB',
        uploadedBy: 'chofer.fletes@rapidos.com',
        uploadedAt: daysAgoIso(1),
        status: 'PENDING',
        isCurrent: true,
      },
      historial: [
        {
          id: 'h-301',
          timestamp: daysAgoIso(10),
          action: 'CREACION_ORDEN',
          newStatus: 'CREADO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
          comment: 'Orden registrada.',
        },
        {
          id: 'h-302',
          timestamp: daysAgoIso(9),
          action: 'ASIGNACION_PROVEEDOR',
          prevStatus: 'CREADO',
          newStatus: 'ASIGNANDO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
          comment: 'Proveedor asignado: Fletes Rápidos.',
        },
        {
          id: 'h-303',
          timestamp: daysAgoIso(8),
          action: 'INICIO_RECOLECCION',
          prevStatus: 'ASIGNANDO',
          newStatus: 'EN_PROCESO',
          user: 'operaciones@fletesrapidos.com',
          role: 'PROVIDER',
          comment: 'Unidad de transporte en ruta hacia la planta.',
        },
        {
          id: 'h-304',
          timestamp: daysAgoIso(1),
          action: 'CARGA_MANIFIESTO',
          user: 'chofer.fletes@rapidos.com',
          role: 'PROVIDER',
          comment: 'Carga de manifiesto versión 1 (Estado: PENDING). En espera de revisión.',
          details: { version: 1, fileName: 'manifiesto_femsa_lodos_v1.pdf' },
        },
      ],
    },

    // 4. COMPLETO (recepción REC-2026-4401 registrada, assigned hace 12 días -> SLA Rojo, v1 rechazada, v2 PENDING)
    {
      id: 'ORD-2026-004',
      numeroPedido: 'PED-2026-004',
      folio: 'FOL-004',
      clienteId: 'client-1',
      clienteNombre: 'Bimbo México SA de CV',
      proveedorId: 'prov-1',
      proveedorNombre: 'Transportes Ecológicos del Centro SA de CV',
      fechaOrden: daysAgoIso(14),
      conceptos: ord4Items,
      subtotalCliente: ord4Totals.subtotalCliente,
      costoTotalCliente: ord4Totals.costoTotalCliente,
      costoProveedor: ord4Totals.costoProveedor,
      utilidadEstimada: ord4Totals.utilidadEstimada,
      estado: 'COMPLETO',
      numeroRecepcion: 'REC-2026-4401',
      recepcionRegistradaPor: 'admin@logitrack.com',
      numeroFacturacion: null,
      facturacionRegistradaPor: null,
      facturacionPendiente: null,
      createdAt: daysAgoIso(14),
      assignedAt: daysAgoIso(12),
      startedAt: daysAgoIso(11),
      receptionRecordedAt: daysAgoIso(3),
      manifestUploadedAt: daysAgoIso(1),
      manifestReviewedAt: daysAgoIso(2),
      invoicedAt: null,
      finalizedAt: null,
      manifiestos: [
        {
          version: 1,
          fileName: 'manifiesto_bimbo_v1_ilegible.pdf',
          fileSize: '890 KB',
          uploadedBy: 'chofer@tecolgicos.mx',
          uploadedAt: daysAgoIso(3),
          status: 'REJECTED',
          rejectionReason: 'Firma de entrega del destinatario borrosa e ilegible.',
          reviewedBy: 'admin@logitrack.com',
          reviewedAt: daysAgoIso(2),
          isCurrent: false,
        },
        {
          version: 2,
          fileName: 'manifiesto_bimbo_v2_corregido.pdf',
          fileSize: '1.1 MB',
          uploadedBy: 'chofer@tecolgicos.mx',
          uploadedAt: daysAgoIso(1),
          status: 'PENDING',
          isCurrent: true,
        },
      ],
      manifiestoActual: {
        version: 2,
        fileName: 'manifiesto_bimbo_v2_corregido.pdf',
        fileSize: '1.1 MB',
        uploadedBy: 'chofer@tecolgicos.mx',
        uploadedAt: daysAgoIso(1),
        status: 'PENDING',
        isCurrent: true,
      },
      historial: [
        {
          id: 'h-401',
          timestamp: daysAgoIso(14),
          action: 'CREACION_ORDEN',
          newStatus: 'CREADO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
        },
        {
          id: 'h-402',
          timestamp: daysAgoIso(12),
          action: 'ASIGNACION_PROVEEDOR',
          prevStatus: 'CREADO',
          newStatus: 'ASIGNANDO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
          comment: 'Asignado a Transportes Ecológicos del Centro',
        },
        {
          id: 'h-403',
          timestamp: daysAgoIso(11),
          action: 'INICIO_RECOLECCION',
          prevStatus: 'ASIGNANDO',
          newStatus: 'EN_PROCESO',
          user: 'chofer@tecolgicos.mx',
          role: 'PROVIDER',
        },
        {
          id: 'h-404',
          timestamp: daysAgoIso(3),
          action: 'REGISTRO_RECEPCION',
          prevStatus: 'EN_PROCESO',
          newStatus: 'COMPLETO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
          comment: 'Recepción registrada: REC-2026-4401',
        },
        {
          id: 'h-405',
          timestamp: daysAgoIso(3),
          action: 'CARGA_MANIFIESTO',
          user: 'chofer@tecolgicos.mx',
          role: 'PROVIDER',
          comment: 'Manifiesto versión 1 cargado.',
        },
        {
          id: 'h-406',
          timestamp: daysAgoIso(2),
          action: 'RECHAZO_MANIFIESTO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
          comment: 'Manifiesto v1 RECHAZADO: Firma de entrega del destinatario borrosa e ilegible.',
        },
        {
          id: 'h-407',
          timestamp: daysAgoIso(1),
          action: 'CARGA_MANIFIESTO',
          user: 'chofer@tecolgicos.mx',
          role: 'PROVIDER',
          comment: 'Manifiesto versión 2 (corregido) cargado. Estado: PENDING.',
        },
      ],
    },

    // 5. FACTURADO (recepción + factura FAC-2026-9011 registrada, falta aprobar manifiesto)
    {
      id: 'ORD-2026-005',
      numeroPedido: 'PED-2026-005',
      folio: 'FOL-005',
      clienteId: 'client-3',
      clienteNombre: 'Femsa Coca-Cola México',
      proveedorId: 'prov-3',
      proveedorNombre: 'Recolecciones Especializadas del Bajío',
      fechaOrden: daysAgoIso(5),
      conceptos: ord5Items,
      subtotalCliente: ord5Totals.subtotalCliente,
      costoTotalCliente: ord5Totals.costoTotalCliente,
      costoProveedor: ord5Totals.costoProveedor,
      utilidadEstimada: ord5Totals.utilidadEstimada,
      estado: 'FACTURADO',
      numeroRecepcion: 'REC-2026-3982',
      recepcionRegistradaPor: 'admin@logitrack.com',
      numeroFacturacion: 'FAC-2026-9011',
      facturacionRegistradaPor: 'admin@logitrack.com',
      facturacionPendiente: null,
      createdAt: daysAgoIso(5),
      assignedAt: daysAgoIso(4),
      startedAt: daysAgoIso(3),
      receptionRecordedAt: daysAgoIso(2),
      manifestUploadedAt: daysAgoIso(1),
      manifestReviewedAt: null,
      invoicedAt: daysAgoIso(1),
      finalizedAt: null,
      manifiestos: [
        {
          version: 1,
          fileName: 'manifiesto_femsa_aceites_v1.pdf',
          fileSize: '1.3 MB',
          uploadedBy: 'bajio@recolecciones.com',
          uploadedAt: daysAgoIso(1),
          status: 'PENDING',
          isCurrent: true,
        },
      ],
      manifiestoActual: {
        version: 1,
        fileName: 'manifiesto_femsa_aceites_v1.pdf',
        fileSize: '1.3 MB',
        uploadedBy: 'bajio@recolecciones.com',
        uploadedAt: daysAgoIso(1),
        status: 'PENDING',
        isCurrent: true,
      },
      historial: [
        {
          id: 'h-501',
          timestamp: daysAgoIso(5),
          action: 'CREACION_ORDEN',
          newStatus: 'CREADO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
        },
        {
          id: 'h-502',
          timestamp: daysAgoIso(4),
          action: 'ASIGNACION_PROVEEDOR',
          prevStatus: 'CREADO',
          newStatus: 'ASIGNANDO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
          comment: 'Asignado a Recolecciones Especializadas del Bajío',
        },
        {
          id: 'h-503',
          timestamp: daysAgoIso(3),
          action: 'INICIO_RECOLECCION',
          prevStatus: 'ASIGNANDO',
          newStatus: 'EN_PROCESO',
          user: 'bajio@recolecciones.com',
          role: 'PROVIDER',
        },
        {
          id: 'h-504',
          timestamp: daysAgoIso(2),
          action: 'REGISTRO_RECEPCION',
          prevStatus: 'EN_PROCESO',
          newStatus: 'COMPLETO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
          comment: 'Recepción registrada: REC-2026-3982',
        },
        {
          id: 'h-505',
          timestamp: daysAgoIso(1),
          action: 'REGISTRO_FACTURACION',
          prevStatus: 'COMPLETO',
          newStatus: 'FACTURADO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
          comment: 'Factura registrada: FAC-2026-9011. Falta aprobación del manifiesto para finalizar.',
        },
        {
          id: 'h-506',
          timestamp: daysAgoIso(1),
          action: 'CARGA_MANIFIESTO',
          user: 'bajio@recolecciones.com',
          role: 'PROVIDER',
          comment: 'Manifiesto versión 1 cargado.',
        },
      ],
    },

    // 6. FINALIZADO (cumplió recepción, factura y manifiesto aprobado. Finalizado hace 2 días, SLA congelado)
    {
      id: 'ORD-2026-006',
      numeroPedido: 'PED-2026-006',
      folio: 'FOL-006',
      clienteId: 'client-2',
      clienteNombre: 'Grupo Modelo S de RL de CV',
      proveedorId: 'prov-1',
      proveedorNombre: 'Transportes Ecológicos del Centro SA de CV',
      fechaOrden: daysAgoIso(6),
      conceptos: ord6Items,
      subtotalCliente: ord6Totals.subtotalCliente,
      costoTotalCliente: ord6Totals.costoTotalCliente,
      costoProveedor: ord6Totals.costoProveedor,
      utilidadEstimada: ord6Totals.utilidadEstimada,
      estado: 'FINALIZADO',
      numeroRecepcion: 'REC-2026-1102',
      recepcionRegistradaPor: 'admin@logitrack.com',
      numeroFacturacion: 'FAC-2026-7840',
      facturacionRegistradaPor: 'admin@logitrack.com',
      facturacionPendiente: null,
      createdAt: daysAgoIso(6),
      assignedAt: daysAgoIso(5),
      startedAt: daysAgoIso(4),
      receptionRecordedAt: daysAgoIso(3),
      manifestUploadedAt: daysAgoIso(3),
      manifestReviewedAt: daysAgoIso(2),
      invoicedAt: daysAgoIso(2),
      finalizedAt: daysAgoIso(2),
      manifiestos: [
        {
          version: 1,
          fileName: 'manifiesto_modelo_empaque_aprobado.pdf',
          fileSize: '1.2 MB',
          uploadedBy: 'chofer@tecolgicos.mx',
          uploadedAt: daysAgoIso(3),
          status: 'APPROVED',
          reviewedBy: 'admin@logitrack.com',
          reviewedAt: daysAgoIso(2),
          isCurrent: true,
        },
      ],
      manifiestoActual: {
        version: 1,
        fileName: 'manifiesto_modelo_empaque_aprobado.pdf',
        fileSize: '1.2 MB',
        uploadedBy: 'chofer@tecolgicos.mx',
        uploadedAt: daysAgoIso(3),
        status: 'APPROVED',
        reviewedBy: 'admin@logitrack.com',
        reviewedAt: daysAgoIso(2),
        isCurrent: true,
      },
      historial: [
        {
          id: 'h-601',
          timestamp: daysAgoIso(6),
          action: 'CREACION_ORDEN',
          newStatus: 'CREADO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
        },
        {
          id: 'h-602',
          timestamp: daysAgoIso(5),
          action: 'ASIGNACION_PROVEEDOR',
          prevStatus: 'CREADO',
          newStatus: 'ASIGNANDO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
        },
        {
          id: 'h-603',
          timestamp: daysAgoIso(4),
          action: 'INICIO_RECOLECCION',
          prevStatus: 'ASIGNANDO',
          newStatus: 'EN_PROCESO',
          user: 'chofer@tecolgicos.mx',
          role: 'PROVIDER',
        },
        {
          id: 'h-604',
          timestamp: daysAgoIso(3),
          action: 'REGISTRO_RECEPCION',
          prevStatus: 'EN_PROCESO',
          newStatus: 'COMPLETO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
          comment: 'Recepción registrada: REC-2026-1102',
        },
        {
          id: 'h-605',
          timestamp: daysAgoIso(2),
          action: 'REGISTRO_FACTURACION',
          prevStatus: 'COMPLETO',
          newStatus: 'FACTURADO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
          comment: 'Factura registrada: FAC-2026-7840',
        },
        {
          id: 'h-606',
          timestamp: daysAgoIso(2),
          action: 'APROBACION_MANIFIESTO',
          prevStatus: 'FACTURADO',
          newStatus: 'FINALIZADO',
          user: 'admin@logitrack.com',
          role: 'ADMIN',
          comment: 'Manifiesto v1 aprobado por administrador. Todas las condiciones cumplidas. Orden FINALIZADA automáticamente.',
        },
      ],
    },
  ];
}

const SEED_USERS: SeedUser[] = [
  {
    id: 'user-admin',
    nombre: 'Administrador General',
    email: 'admin@logitrack.com',
    password: 'Admin2026!',
    role: 'ADMIN',
    entityId: null,
    activo: true,
  },
  {
    id: 'user-operador',
    nombre: 'Usuario Operativo y Reportes',
    email: 'usuario@logitrack.com',
    password: 'User2026!',
    role: 'USER',
    entityId: null,
    activo: true,
  },
  {
    id: 'user-prov-1',
    nombre: 'Transportes Ecológicos del Centro',
    email: 'contacto@tecolgicos.mx',
    password: 'Prov2026!',
    role: 'PROVIDER',
    entityId: 'prov-1',
    activo: true,
  },
  {
    id: 'user-prov-2',
    nombre: 'Fletes Rápidos y Logística Industrial',
    email: 'operaciones@fletesrapidos.com',
    password: 'Prov2026!',
    role: 'PROVIDER',
    entityId: 'prov-2',
    activo: true,
  },
  {
    id: 'user-prov-3',
    nombre: 'Recolecciones Especializadas del Bajío',
    email: 'bajio@recolecciones.com',
    password: 'Prov2026!',
    role: 'PROVIDER',
    entityId: 'prov-3',
    activo: true,
  },
  {
    id: 'user-client-1',
    nombre: 'Bimbo México SA de CV',
    email: 'logistica@bimbo.com',
    password: 'Client2026!',
    role: 'CLIENT',
    entityId: 'client-1',
    activo: true,
  },
  {
    id: 'user-client-2',
    nombre: 'Grupo Modelo S de RL de CV',
    email: 'recolecciones@grupomodelo.com',
    password: 'Client2026!',
    role: 'CLIENT',
    entityId: 'client-2',
    activo: true,
  },
  {
    id: 'user-client-3',
    nombre: 'Femsa Coca-Cola México',
    email: 'ambiental@femsa.com',
    password: 'Client2026!',
    role: 'CLIENT',
    entityId: 'client-3',
    activo: true,
  },
];

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json({ limit: '25mb' }));

  // Initialize PostgreSQL database with initial tables and benchmark seeds
  try {
    await initDatabase({
      providers: SEED_PROVIDERS,
      clients: SEED_CLIENTS,
      catalogConcepts: SEED_CATALOG_CONCEPTS,
      serviceLocations: SEED_SERVICE_LOCATIONS,
      orders: getInitialSeedOrders(),
      users: SEED_USERS,
    });
  } catch (dbErr) {
    console.error('[DB] Error inicializando base de datos PostgreSQL:', dbErr);
  }

  // Helper for audit logging
  function addHistory(order: Order, entry: Omit<HistoryEntry, 'id' | 'timestamp'>) {
    const newEntry: HistoryEntry = {
      id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    order.historial.push(newEntry);
    return newEntry;
  }

  // Helper to resolve authenticated session user from Authorization Bearer header
  async function getAuthUser(req: Request): Promise<AppUser | null> {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    return await dbGetSessionUser(match[1].trim());
  }

  // --- API ROUTES ---

  // Health check & DB Status (Public)
  app.get('/api/health', async (req: Request, res: Response) => {
    const dbStatus = await getDbStatus();
    res.json({
      status: 'ok',
      service: 'LogiTrack MVP API',
      database: dbStatus,
    });
  });

  // --- AUTHENTICATION ROUTES ---
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Ingrese su correo electrónico y contraseña' });
      }

      const userRecord = await dbGetUserByEmailWithPassword(String(email));
      if (!userRecord) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
      }
      if (!userRecord.activo) {
        return res.status(403).json({ error: 'Este usuario se encuentra desactivado. Contacte al administrador.' });
      }

      const valid = verifyPassword(String(password), userRecord.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Credenciales incorrectas' });
      }

      const token = await dbCreateSession(userRecord.id);
      const { passwordHash: _ignored, ...safeUser } = userRecord;
      res.json({ token, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al iniciar sesión', details: err.message });
    }
  });

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Sesión no válida o expirada' });
      }
      res.json({ user });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al verificar sesión', details: err.message });
    }
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || '';
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match) {
        await dbDeleteSession(match[1].trim());
      }
      res.json({ message: 'Sesión cerrada correctamente' });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al cerrar sesión', details: err.message });
    }
  });

  // --- USERS MANAGEMENT (Admin Only) ---
  app.get('/api/users', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Solo el administrador puede consultar la tabla de usuarios' });
      }
      const users = await dbGetUsers();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al obtener usuarios', details: err.message });
    }
  });

  app.post('/api/users', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Solo el administrador puede crear usuarios' });
      }

      const { nombre, email, password, role, entityId, activo } = req.body;
      if (!nombre || !String(nombre).trim()) {
        return res.status(400).json({ error: 'El nombre del usuario es obligatorio' });
      }
      if (!email || !String(email).trim()) {
        return res.status(400).json({ error: 'El correo electrónico es obligatorio' });
      }
      if (!password || String(password).length < 6) {
        return res.status(400).json({ error: 'La contraseña es obligatoria (mínimo 6 caracteres)' });
      }
      if (!['ADMIN', 'USER', 'PROVIDER', 'CLIENT'].includes(role)) {
        return res.status(400).json({ error: 'Rol de usuario inválido' });
      }
      if ((role === 'PROVIDER' || role === 'CLIENT') && !entityId) {
        return res.status(400).json({ error: 'Debe vincular el transportista o empresa cliente correspondiente' });
      }

      const existing = await dbGetUserByEmailWithPassword(String(email));
      if (existing) {
        return res.status(400).json({ error: `Ya existe un usuario con el correo "${String(email).trim().toLowerCase()}"` });
      }

      const created = await dbCreateUser({
        id: `user-${Date.now()}`,
        nombre: String(nombre).trim(),
        email: String(email).trim().toLowerCase(),
        password: String(password),
        role: role as Role,
        entityId: role === 'PROVIDER' || role === 'CLIENT' ? String(entityId) : null,
        activo: activo !== false,
      });

      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al crear usuario', details: err.message });
    }
  });

  app.put('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Solo el administrador puede editar usuarios' });
      }

      const target = await dbGetUserById(req.params.id);
      if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

      const { nombre, email, password, role, entityId, activo } = req.body;
      if (email) {
        const duplicate = await dbGetUserByEmailWithPassword(String(email));
        if (duplicate && duplicate.id !== req.params.id) {
          return res.status(400).json({ error: `El correo "${String(email).trim().toLowerCase()}" ya está en uso` });
        }
      }
      if (password && String(password).length > 0 && String(password).length < 6) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
      }

      const nextRole = (role || target.role) as Role;
      const nextEntityId =
        nextRole === 'PROVIDER' || nextRole === 'CLIENT'
          ? (entityId !== undefined ? entityId : target.entityId)
          : null;

      if ((nextRole === 'PROVIDER' || nextRole === 'CLIENT') && !nextEntityId) {
        return res.status(400).json({ error: 'Debe seleccionar la empresa vinculada al perfil' });
      }

      const updated = await dbUpdateUser(req.params.id, {
        nombre,
        email,
        password: password || undefined,
        role: nextRole,
        entityId: nextEntityId,
        activo,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al actualizar usuario', details: err.message });
    }
  });

  app.delete('/api/users/:id', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Solo el administrador puede eliminar usuarios' });
      }
      if (authUser.id === req.params.id) {
        return res.status(400).json({ error: 'No puede eliminar su propio usuario administrador activo' });
      }

      const deleted = await dbDeleteUser(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Usuario no encontrado' });
      res.json({ message: 'Usuario eliminado exitosamente' });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al eliminar usuario', details: err.message });
    }
  });

  // Providers, Clients, Catalog concepts & Service Locations (CEDIs)
  app.get('/api/config', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });

      const [providers, clients, catalogConcepts, serviceLocations, dbStatus] = await Promise.all([
        dbGetProviders(),
        dbGetClients(),
        dbGetCatalogConcepts(),
        dbGetServiceLocations(),
        authUser.role === 'ADMIN' ? getDbStatus() : Promise.resolve(null),
      ]);

      // Hide unit pricing in catalogConcepts only when role is PROVIDER
      const safeCatalogConcepts =
        authUser.role === 'PROVIDER'
          ? catalogConcepts.map(c => ({ ...c, precioUnitario: 0 }))
          : catalogConcepts;

      res.json({
        providers,
        clients,
        catalogConcepts: safeCatalogConcepts,
        serviceLocations,
        ...(dbStatus ? { database: dbStatus } : {}),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al obtener configuración', details: err.message });
    }
  });

  // --- CRUD PROVEEDORES ---
  app.get('/api/providers', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      const providers = await dbGetProviders();
      res.json(providers);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al obtener transportistas', details: err.message });
    }
  });

  app.post('/api/providers', async (req: Request, res: Response) => {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
    if (authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
      return res.status(403).json({ error: 'No tiene permisos para registrar transportistas' });
    }
    const {
      nombre,
      rfc,
      telefono,
      email,
      activo,
      direccion,
      autorizacionDocumento,
      autorizacionesDocumentos,
    } = req.body;
    if (!nombre || String(nombre).trim().length === 0) {
      return res.status(400).json({ error: 'El nombre o razón social del transportista es obligatorio' });
    }
    if (!rfc || String(rfc).trim().length === 0) {
      return res.status(400).json({ error: 'El RFC del proveedor es obligatorio' });
    }

    try {
      // Regla 4: No puede haber 2 proveedores con el mismo RFC ya que es único
      const normalizedRfc = String(rfc).trim().toUpperCase();
      const currentProviders = await dbGetProviders();
      const duplicate = currentProviders.find(p => p.rfc.toUpperCase() === normalizedRfc);
      if (duplicate) {
        return res.status(400).json({
          error: `Ya existe un transportista registrado con el RFC "${normalizedRfc}" (${duplicate.nombre}). El RFC debe ser único en el sistema.`,
        });
      }

      const rawDocs = Array.isArray(autorizacionesDocumentos)
        ? autorizacionesDocumentos
        : autorizacionDocumento
        ? [autorizacionDocumento]
        : [];
      const cleanDocs = rawDocs
        .filter((d: any) => d && d.fileName)
        .map((d: any, idx: number) => ({
          id: d.id ? String(d.id) : `auth-${Date.now()}-${idx}`,
          fileName: String(d.fileName || 'autorizacion.pdf').trim(),
          fileType: d.fileType || 'application/pdf',
          fileDataUrl: d.fileDataUrl,
          descripcion: d.descripcion && String(d.descripcion).trim() ? String(d.descripcion).trim() : undefined,
          uploadedAt: d.uploadedAt || new Date().toISOString(),
        }));

      const newProvider: Provider = {
        id: `prov-${Date.now()}`,
        nombre: String(nombre).trim(),
        rfc: normalizedRfc,
        telefono: String(telefono || '').trim(),
        email: String(email || '').trim(),
        activo: activo !== false,
        direccion: direccion
          ? {
              calleNumero: String(direccion.calleNumero || '').trim(),
              colonia: direccion.colonia ? String(direccion.colonia).trim() : undefined,
              ciudad: String(direccion.ciudad || '').trim(),
              estado: String(direccion.estado || '').trim(),
              codigoPostal: String(direccion.codigoPostal || '').trim(),
            }
          : undefined,
        autorizacionDocumento: cleanDocs[0] || undefined,
        autorizacionesDocumentos: cleanDocs,
      };

      const created = await dbCreateProvider(newProvider);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al registrar transportista en la base de datos', details: err.message });
    }
  });

  app.put('/api/providers/:id', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
        return res.status(403).json({ error: 'No tiene permisos para editar transportistas' });
      }
      const provider = await dbGetProviderById(req.params.id);
      if (!provider) {
        return res.status(404).json({ error: 'Transportista no encontrado' });
      }

      const {
        nombre,
        rfc,
        telefono,
        email,
        activo,
        direccion,
        autorizacionDocumento,
        autorizacionesDocumentos,
      } = req.body;

      // Regla 4: No puede haber 2 proveedores con el mismo RFC
      if (rfc !== undefined) {
        const normalizedRfc = String(rfc).trim().toUpperCase();
        const currentProviders = await dbGetProviders();
        const duplicate = currentProviders.find(
          p => p.id !== req.params.id && p.rfc.toUpperCase() === normalizedRfc
        );
        if (duplicate) {
          return res.status(400).json({
            error: `El RFC "${normalizedRfc}" ya está asignado al transportista "${duplicate.nombre}". El RFC debe ser único en el sistema.`,
          });
        }
        provider.rfc = normalizedRfc;
      }

      if (nombre !== undefined) provider.nombre = String(nombre).trim();
      if (telefono !== undefined) provider.telefono = String(telefono).trim();
      if (email !== undefined) provider.email = String(email).trim();
      if (activo !== undefined) provider.activo = Boolean(activo);
      if (direccion !== undefined) {
        provider.direccion = {
          calleNumero: String(direccion.calleNumero || '').trim(),
          colonia: direccion.colonia ? String(direccion.colonia).trim() : undefined,
          ciudad: String(direccion.ciudad || '').trim(),
          estado: String(direccion.estado || '').trim(),
          codigoPostal: String(direccion.codigoPostal || '').trim(),
        };
      }
      if (autorizacionesDocumentos !== undefined) {
        const cleanDocs = Array.isArray(autorizacionesDocumentos)
          ? autorizacionesDocumentos
              .filter((d: any) => d && d.fileName)
              .map((d: any, idx: number) => ({
                id: d.id ? String(d.id) : `auth-${Date.now()}-${idx}`,
                fileName: String(d.fileName || 'autorizacion.pdf').trim(),
                fileType: d.fileType || 'application/pdf',
                fileDataUrl: d.fileDataUrl,
                descripcion: d.descripcion && String(d.descripcion).trim() ? String(d.descripcion).trim() : undefined,
                uploadedAt: d.uploadedAt || new Date().toISOString(),
              }))
          : [];
        provider.autorizacionesDocumentos = cleanDocs;
        provider.autorizacionDocumento = cleanDocs[0] || undefined;
      } else if (autorizacionDocumento !== undefined) {
        if (autorizacionDocumento && autorizacionDocumento.fileName) {
          const singleDoc = {
            id: autorizacionDocumento.id ? String(autorizacionDocumento.id) : `auth-${Date.now()}-0`,
            fileName: String(autorizacionDocumento.fileName).trim(),
            fileType: autorizacionDocumento.fileType || 'application/pdf',
            fileDataUrl: autorizacionDocumento.fileDataUrl,
            descripcion:
              autorizacionDocumento.descripcion && String(autorizacionDocumento.descripcion).trim()
                ? String(autorizacionDocumento.descripcion).trim()
                : undefined,
            uploadedAt: autorizacionDocumento.uploadedAt || new Date().toISOString(),
          };
          provider.autorizacionesDocumentos = [singleDoc];
          provider.autorizacionDocumento = singleDoc;
        } else {
          provider.autorizacionesDocumentos = [];
          provider.autorizacionDocumento = undefined;
        }
      }

      const updated = await dbUpdateProvider(req.params.id, provider);

      // Actualizar nombre en órdenes asignadas si cambió
      if (nombre) {
        const orders = await dbGetOrders();
        for (const o of orders) {
          if (o.proveedorId === provider.id) {
            o.proveedorNombre = provider.nombre;
            await dbUpdateOrder(o);
          }
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al actualizar transportista', details: err.message });
    }
  });

  app.delete('/api/providers/:id', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
        return res.status(403).json({ error: 'No tiene permisos para eliminar transportistas' });
      }
      const provider = await dbGetProviderById(req.params.id);
      if (!provider) {
        return res.status(404).json({ error: 'Transportista no encontrado' });
      }

      const providerId = req.params.id;
      const orders = await dbGetOrders();
      const activeAssignedOrders = orders.filter(
        o => o.proveedorId === providerId && o.estado !== 'FINALIZADO'
      );

      if (activeAssignedOrders.length > 0) {
        return res.status(400).json({
          error: `No es posible eliminar a ${provider.nombre} porque tiene ${activeAssignedOrders.length} orden(es) activas asignadas. En su lugar, desactive al proveedor para pausar nuevas asignaciones.`,
        });
      }

      await dbDeleteProvider(providerId);
      res.json({ message: 'Transportista eliminado exitosamente', deleted: provider });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al eliminar transportista', details: err.message });
    }
  });

  // --- CRUD CATALOGO DE CONCEPTOS ---
  app.get('/api/catalog-concepts', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      const concepts = await dbGetCatalogConcepts();
      res.json(
        authUser.role === 'PROVIDER'
          ? concepts.map(c => ({ ...c, precioUnitario: 0 }))
          : concepts
      );
    } catch (err: any) {
      res.status(500).json({ error: 'Error al obtener conceptos', details: err.message });
    }
  });

  app.post('/api/catalog-concepts', async (req: Request, res: Response) => {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
    if (authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
      return res.status(403).json({ error: 'No tiene permisos para modificar el catálogo' });
    }
    const { item, unidad, descripcion, precioUnitario } = req.body;
    // Regla 1: ITEM opcional, DESCRIPCION obligatoria
    if (!descripcion || String(descripcion).trim().length === 0) {
      return res.status(400).json({ error: 'La descripción del concepto es obligatoria' });
    }

    try {
      const unitPrice = Number(precioUnitario) || 0;
      const newConcept: CatalogConcept = {
        id: `cat-${Date.now()}`,
        item: item ? String(item).trim() : '',
        unidad: String(unidad || 'ST').trim().toUpperCase(),
        descripcion: String(descripcion).trim(),
        precioUnitario: unitPrice,
      };

      const created = await dbCreateCatalogConcept(newConcept);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al registrar concepto', details: err.message });
    }
  });

  app.put('/api/catalog-concepts/:id', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
        return res.status(403).json({ error: 'No tiene permisos para modificar el catálogo' });
      }
      const concept = await dbGetCatalogConceptById(req.params.id);
      if (!concept) {
        return res.status(404).json({ error: 'Concepto no encontrado en el catálogo' });
      }

      const { item, unidad, descripcion, precioUnitario } = req.body;
      if (descripcion !== undefined) {
        if (!descripcion || String(descripcion).trim().length === 0) {
          return res.status(400).json({ error: 'La descripción del concepto es obligatoria' });
        }
        concept.descripcion = String(descripcion).trim();
      }
      if (item !== undefined) concept.item = String(item).trim();
      if (unidad !== undefined) concept.unidad = String(unidad).trim().toUpperCase();
      if (precioUnitario !== undefined) {
        concept.precioUnitario = Number(precioUnitario) || 0;
      }

      const updated = await dbUpdateCatalogConcept(req.params.id, concept);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al actualizar concepto', details: err.message });
    }
  });

  app.delete('/api/catalog-concepts/:id', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
        return res.status(403).json({ error: 'No tiene permisos para modificar el catálogo' });
      }
      const concept = await dbGetCatalogConceptById(req.params.id);
      if (!concept) {
        return res.status(404).json({ error: 'Concepto no encontrado en el catálogo' });
      }
      await dbDeleteCatalogConcept(req.params.id);
      res.json({ message: 'Concepto eliminado del catálogo', deleted: concept });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al eliminar concepto', details: err.message });
    }
  });

  // --- CRUD UBICACIONES PARA SERVICIO (CEDIs) ---
  app.get('/api/service-locations', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      const locations = await dbGetServiceLocations();
      res.json(locations);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al obtener ubicaciones de servicio', details: err.message });
    }
  });

  app.post('/api/service-locations', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
        return res.status(403).json({ error: 'No tiene permisos para registrar ubicaciones' });
      }
      const { division, cedi, direccion, activo } = req.body;
      if (!division || String(division).trim().length === 0) {
        return res.status(400).json({ error: 'La división (ej. Centro, Sur, Norte) es obligatoria' });
      }
      if (!cedi || String(cedi).trim().length === 0) {
        return res.status(400).json({ error: 'El nombre o código del CEDI es obligatorio' });
      }
      if (!direccion || typeof direccion !== 'object') {
        return res.status(400).json({ error: 'La dirección del CEDI es obligatoria' });
      }
      if (!direccion.calleNumero || String(direccion.calleNumero).trim().length === 0) {
        return res.status(400).json({ error: 'La calle y número son obligatorios' });
      }
      if (!direccion.ciudad || String(direccion.ciudad).trim().length === 0) {
        return res.status(400).json({ error: 'La ciudad o municipio es obligatorio' });
      }
      if (!direccion.estado || String(direccion.estado).trim().length === 0) {
        return res.status(400).json({ error: 'El estado / entidad federativa es obligatorio' });
      }
      if (!direccion.codigoPostal || String(direccion.codigoPostal).trim().length === 0) {
        return res.status(400).json({ error: 'El código postal es obligatorio' });
      }

      const newLocation: ServiceLocation = {
        id: `cedi-${Date.now()}`,
        division: String(division).trim(),
        cedi: String(cedi).trim().toUpperCase(),
        direccion: {
          calleNumero: String(direccion.calleNumero).trim(),
          colonia: direccion.colonia ? String(direccion.colonia).trim() : undefined,
          ciudad: String(direccion.ciudad).trim(),
          estado: String(direccion.estado).trim(),
          codigoPostal: String(direccion.codigoPostal).trim(),
        },
        activo: activo !== undefined ? Boolean(activo) : true,
      };

      const created = await dbCreateServiceLocation(newLocation);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al registrar ubicación de servicio', details: err.message });
    }
  });

  app.put('/api/service-locations/:id', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
        return res.status(403).json({ error: 'No tiene permisos para editar ubicaciones' });
      }
      const location = await dbGetServiceLocationById(req.params.id);
      if (!location) {
        return res.status(404).json({ error: 'Ubicación / CEDI no encontrado' });
      }

      const { division, cedi, direccion, activo } = req.body;
      const updates: Partial<ServiceLocation> = {};

      if (division !== undefined) {
        if (!division || String(division).trim().length === 0) {
          return res.status(400).json({ error: 'La división no puede estar vacía' });
        }
        updates.division = String(division).trim();
      }

      if (cedi !== undefined) {
        if (!cedi || String(cedi).trim().length === 0) {
          return res.status(400).json({ error: 'El CEDI no puede estar vacío' });
        }
        updates.cedi = String(cedi).trim().toUpperCase();
      }

      if (direccion !== undefined && typeof direccion === 'object') {
        updates.direccion = {
          ...location.direccion,
          calleNumero: direccion.calleNumero !== undefined ? String(direccion.calleNumero).trim() : location.direccion.calleNumero,
          colonia: direccion.colonia !== undefined ? String(direccion.colonia).trim() : location.direccion.colonia,
          ciudad: direccion.ciudad !== undefined ? String(direccion.ciudad).trim() : location.direccion.ciudad,
          estado: direccion.estado !== undefined ? String(direccion.estado).trim() : location.direccion.estado,
          codigoPostal: direccion.codigoPostal !== undefined ? String(direccion.codigoPostal).trim() : location.direccion.codigoPostal,
        };
      }

      if (activo !== undefined) {
        updates.activo = Boolean(activo);
      }

      const updated = await dbUpdateServiceLocation(req.params.id, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al actualizar ubicación de servicio', details: err.message });
    }
  });

  app.delete('/api/service-locations/:id', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
        return res.status(403).json({ error: 'No tiene permisos para eliminar ubicaciones' });
      }
      const location = await dbGetServiceLocationById(req.params.id);
      if (!location) {
        return res.status(404).json({ error: 'Ubicación / CEDI no encontrado' });
      }
      await dbDeleteServiceLocation(req.params.id);
      res.json({ message: 'Ubicación / CEDI eliminado exitosamente', deleted: location });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al eliminar ubicación de servicio', details: err.message });
    }
  });

  // Get orders (sanitized by authenticated user role)
  app.get('/api/orders', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });

      const effectiveRole: Role =
        authUser.role === 'ADMIN' ? ((req.query.role as Role) || 'ADMIN') : authUser.role;
      const effectiveEntityId =
        authUser.role === 'ADMIN'
          ? (req.query.entityId as string | undefined)
          : (authUser.entityId || undefined);

      const allOrders = await dbGetOrders();
      const sanitizedList = allOrders
        .map(o => sanitizeOrderByRole(o, effectiveRole, effectiveEntityId))
        .filter((o): o is Order => o !== null);

      res.json(sanitizedList);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al obtener órdenes', details: err.message });
    }
  });

  // Get single order
  app.get('/api/orders/:id', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });

      const order = await dbGetOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      const effectiveRole: Role =
        authUser.role === 'ADMIN' ? ((req.query.role as Role) || 'ADMIN') : authUser.role;
      const effectiveEntityId =
        authUser.role === 'ADMIN'
          ? (req.query.entityId as string | undefined)
          : (authUser.entityId || undefined);

      const sanitized = sanitizeOrderByRole(order, effectiveRole, effectiveEntityId);
      if (!sanitized) {
        return res.status(403).json({ error: 'Acceso no autorizado a esta orden' });
      }
      res.json(sanitized);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al obtener orden', details: err.message });
    }
  });

  // Create order (Admin or Operational User)
  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
        return res.status(403).json({ error: 'No tiene permisos para crear órdenes' });
      }

      const {
        clienteId,
        conceptos,
        proveedorId,
        costoProveedor,
        numeroPedido,
        ubicacionServicio,
        solicitoNombre,
        solicitoTelefono,
      } = req.body;

      if (!numeroPedido || String(numeroPedido).trim().length === 0) {
        return res.status(400).json({ error: 'El Número de Pedido es obligatorio' });
      }
      const cleanNumeroPedido = String(numeroPedido).trim();

      if (!clienteId) {
        return res.status(400).json({ error: 'El cliente es requerido' });
      }
      const client = await dbGetClientById(clienteId);
      if (!client) {
        return res.status(400).json({ error: 'Cliente inválido' });
      }

      const allOrders = await dbGetOrders();
      const duplicatePedido = allOrders.find(
        (o) =>
          (o.numeroPedido && o.numeroPedido.toUpperCase() === cleanNumeroPedido.toUpperCase()) ||
          o.id.toUpperCase() === cleanNumeroPedido.toUpperCase()
      );
      if (duplicatePedido) {
        return res.status(400).json({
          error: `Ya existe una orden registrada con el Número de Pedido "${cleanNumeroPedido}". El número de pedido debe ser único.`,
        });
      }

      if (!conceptos || !Array.isArray(conceptos) || conceptos.length === 0) {
        return res.status(400).json({ error: 'Se requiere al menos un concepto en la orden' });
      }

      if (conceptos.some((c: any) => !c.descripcion || String(c.descripcion).trim().length === 0)) {
        return res.status(400).json({ error: 'La descripción es obligatoria para cada concepto de la orden' });
      }

      const sanitizedConceptos: ItemConcept[] = conceptos.map((c: any, idx: number) => {
        const cantidad = Number(c.cantidadOrdenada ?? c.cantidad ?? 1);
        const precioUnitario = Number(c.precioUnitario) || 0;
        const importe = calculateItemImporte(cantidad, precioUnitario);
        return {
          id: c.id || `item-${Date.now()}-${idx}`,
          item: c.item ? String(c.item).trim() : '',
          unidad: String(c.unidad || 'ST').trim().toUpperCase(),
          descripcion: String(c.descripcion).trim(),
          cantidad,
          cantidadOrdenada: cantidad,
          precioUnitario,
          importe,
          observaciones: c.observaciones && String(c.observaciones).trim() ? String(c.observaciones).trim() : undefined,
        };
      });

      let assignedProv: Provider | null = null;
      let provCostNumber: number | null = null;
      let initialStatus: OrderStatus = 'CREADO';
      let assignedAt: string | null = null;

      if (proveedorId) {
        const prov = await dbGetProviderById(proveedorId);
        if (!prov || !prov.activo) {
          return res.status(400).json({ error: 'El proveedor seleccionado no existe o no está activo' });
        }
        assignedProv = prov;
        if (costoProveedor === undefined || costoProveedor === null || Number(costoProveedor) < 0) {
          return res.status(400).json({ error: 'Debe especificar un costo de proveedor válido (mayor o igual a cero)' });
        }
        provCostNumber = new Decimal(costoProveedor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
        initialStatus = 'EN_PROCESO';
        assignedAt = new Date().toISOString();
      }

      const totals = calculateOrderTotals(sanitizedConceptos, provCostNumber);

      const newOrderNumber = allOrders.length + 1;
      const newFolio = `FOL-${String(newOrderNumber).padStart(3, '0')}`;
      const nowIso = new Date().toISOString();

      const newOrder: Order = {
        id: cleanNumeroPedido,
        numeroPedido: cleanNumeroPedido,
        folio: newFolio,
        clienteId: client.id,
        clienteNombre: client.nombre,
        proveedorId: assignedProv ? assignedProv.id : null,
        proveedorNombre: assignedProv ? assignedProv.nombre : null,
        fechaOrden: nowIso,
        solicitoNombre: solicitoNombre && String(solicitoNombre).trim() ? String(solicitoNombre).trim() : undefined,
        solicitoTelefono: solicitoTelefono && String(solicitoTelefono).trim() ? String(solicitoTelefono).trim() : undefined,
        ubicacionServicio: ubicacionServicio || undefined,
        conceptos: sanitizedConceptos,
        subtotalCliente: totals.subtotalCliente,
        costoTotalCliente: totals.costoTotalCliente,
        costoProveedor: totals.costoProveedor,
        utilidadEstimada: totals.utilidadEstimada,
        estado: initialStatus,
        numeroRecepcion: null,
        recepcionRegistradaPor: null,
        numeroFacturacion: null,
        facturacionRegistradaPor: null,
        facturacionPendiente: null,
        createdAt: nowIso,
        assignedAt,
        startedAt: assignedProv ? assignedAt : null,
        receptionRecordedAt: null,
        manifestUploadedAt: null,
        manifestReviewedAt: null,
        invoicedAt: null,
        finalizedAt: null,
        manifiestos: [],
        manifiestoActual: null,
        historial: [],
      };

      addHistory(newOrder, {
        action: 'CREACION_ORDEN',
        newStatus: initialStatus,
        user: authUser.email,
        role: authUser.role,
        comment: assignedProv
          ? `Orden creada con proveedor ${assignedProv.nombre} asignado; recolección iniciada inmediatamente en EN_PROCESO.`
          : 'Orden creada sin proveedor asignado en estado CREADO.',
      });

      if (assignedProv) {
        addHistory(newOrder, {
          action: 'ASIGNACION_PROVEEDOR',
          prevStatus: 'CREADO',
          newStatus: 'EN_PROCESO',
          user: authUser.email,
          role: authUser.role,
          comment: `Proveedor asignado: ${assignedProv.nombre}. Costo: $${provCostNumber?.toFixed(2)} MXN. Orden iniciada inmediatamente en EN_PROCESO para cronometraje.`,
          details: { proveedorId: assignedProv.id, costoProveedor: provCostNumber },
        });
      }

      const created = await dbCreateOrder(newOrder);
      res.status(201).json(sanitizeOrderByRole(created, authUser.role));
    } catch (err: any) {
      res.status(500).json({ error: 'Error al registrar orden en la base de datos', details: err.message });
    }
  });

  // Assign or reassign provider (Admin or Operational User)
  app.post('/api/orders/:id/assign-provider', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
        return res.status(403).json({ error: 'Un proveedor o cliente no puede asignar órdenes' });
      }

      const order = await dbGetOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      const { providerId, costoProveedor } = req.body;

      if (!providerId) {
        return res.status(400).json({ error: 'Debe seleccionar un proveedor' });
      }

      const provider = await dbGetProviderById(providerId);
      if (!provider) {
        return res.status(400).json({ error: 'Proveedor no encontrado' });
      }
      if (!provider.activo) {
        return res.status(400).json({ error: 'No se puede asignar un proveedor inactivo' });
      }

      if (costoProveedor === undefined || costoProveedor === null || Number(costoProveedor) < 0) {
        return res.status(400).json({ error: 'Debe ingresar un costo de proveedor válido (mayor o igual a cero)' });
      }
      const costNum = new Decimal(costoProveedor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

      const prevProvId = order.proveedorId;
      const prevProvName = order.proveedorNombre;
      const isReassignment = Boolean(prevProvId && prevProvId !== provider.id);

      order.costoProveedor = costNum;

      const totals = calculateOrderTotals(order.conceptos, costNum);
      order.utilidadEstimada = totals.utilidadEstimada;

      order.proveedorId = provider.id;
      order.proveedorNombre = provider.nombre;
      const nowIso = new Date().toISOString();
      order.assignedAt = nowIso;

      const prevStatus = order.estado;
      if (order.estado === 'CREADO' || order.estado === 'ASIGNANDO') {
        order.estado = 'EN_PROCESO';
        if (!order.startedAt) {
          order.startedAt = nowIso;
        }
      }

      if (isReassignment) {
        addHistory(order, {
          action: 'REASIGNACION_PROVEEDOR',
          prevStatus,
          newStatus: order.estado,
          user: authUser.email,
          role: authUser.role,
          comment: `Reasignación de transportista: de '${prevProvName}' a '${provider.nombre}'. Costo registrado: $${costNum.toFixed(2)} MXN. Orden activa en EN_PROCESO.`,
          details: {
            proveedorAnteriorId: prevProvId,
            proveedorAnterior: prevProvName,
            proveedorNuevoId: provider.id,
            proveedorNuevo: provider.nombre,
            costoProveedor: costNum,
          },
        });
      } else {
        addHistory(order, {
          action: 'ASIGNACION_PROVEEDOR',
          prevStatus,
          newStatus: order.estado,
          user: authUser.email,
          role: authUser.role,
          comment: `Proveedor asignado: '${provider.nombre}'. Costo: $${costNum.toFixed(2)} MXN. Orden iniciada inmediatamente en EN_PROCESO para cronometraje exacto.`,
          details: {
            proveedorId: provider.id,
            proveedorNombre: provider.nombre,
            costoProveedor: costNum,
          },
        });
      }

      const updated = await dbUpdateOrder(order);
      res.json(sanitizeOrderByRole(updated, authUser.role));
    } catch (err: any) {
      res.status(500).json({ error: 'Error al asignar transportista', details: err.message });
    }
  });

  // Start process (Provider or Admin preview)
  app.post('/api/orders/:id/start-process', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'PROVIDER' && authUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Solo el proveedor asignado puede iniciar esta recolección' });
      }

      const order = await dbGetOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      const targetProviderId = authUser.role === 'PROVIDER' ? authUser.entityId : req.body.providerId;
      if (targetProviderId && order.proveedorId !== targetProviderId) {
        return res.status(403).json({ error: 'Solo el proveedor asignado puede iniciar esta recolección' });
      }

      if (order.estado !== 'ASIGNANDO') {
        return res.status(400).json({ error: `La orden se encuentra en estado ${order.estado}, no puede iniciarse recolección` });
      }

      const prevStatus = order.estado;
      order.estado = 'EN_PROCESO';
      const nowIso = new Date().toISOString();
      order.startedAt = nowIso;

      addHistory(order, {
        action: 'INICIO_RECOLECCION',
        prevStatus,
        newStatus: 'EN_PROCESO',
        user: authUser.email || order.proveedorNombre || 'Proveedor',
        role: 'PROVIDER',
        comment: 'El proveedor asignado ha iniciado el servicio de recolección en ruta.',
      });

      const updated = await dbUpdateOrder(order);
      res.json(sanitizeOrderByRole(updated, authUser.role, targetProviderId || undefined));
    } catch (err: any) {
      res.status(500).json({ error: 'Error al iniciar recolección', details: err.message });
    }
  });

  // Record reception number (Admin or Operational User)
  app.post('/api/orders/:id/record-reception', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
        return res.status(403).json({ error: 'No tiene permisos para registrar recepción' });
      }

      const order = await dbGetOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      if (!order.proveedorId) {
        return res.status(400).json({
          error: 'No es posible registrar recepción en una orden sin proveedor asignado. Debe asignarse un proveedor activo primero.',
        });
      }

      const { numeroRecepcion } = req.body;
      if (!numeroRecepcion || String(numeroRecepcion).trim().length === 0) {
        return res.status(400).json({ error: 'El número de recepción no puede estar vacío' });
      }

      const cleanNumber = String(numeroRecepcion).trim();
      const prevStatus = order.estado;
      const nowIso = new Date().toISOString();

      order.numeroRecepcion = cleanNumber;
      order.recepcionRegistradaPor = authUser.email;
      order.receptionRecordedAt = nowIso;

      if (order.estado === 'ASIGNANDO' || order.estado === 'EN_PROCESO') {
        order.estado = 'COMPLETO';
      }

      addHistory(order, {
        action: 'REGISTRO_RECEPCION',
        prevStatus,
        newStatus: order.estado,
        user: authUser.email,
        role: authUser.role,
        comment: `Número de recepción '${cleanNumber}' registrado exitosamente por ${authUser.nombre}.`,
        details: { numeroRecepcion: cleanNumber },
      });

      if (order.facturacionPendiente && order.estado === 'COMPLETO') {
        order.numeroFacturacion = order.facturacionPendiente;
        order.facturacionRegistradaPor = authUser.email;
        order.invoicedAt = new Date().toISOString();
        order.facturacionPendiente = null;
        order.estado = 'FACTURADO';

        addHistory(order, {
          action: 'APLICACION_FACTURA_PENDIENTE',
          prevStatus: 'COMPLETO',
          newStatus: 'FACTURADO',
          user: authUser.email,
          role: authUser.role,
          comment: `Factura pendiente '${order.numeroFacturacion}' aplicada automáticamente al completar la orden.`,
        });
      }

      const transition = evaluateOrderStateTransition(order);
      if (transition.changed) {
        const prevTransitionStatus = order.estado;
        order.estado = transition.nextState;
        if (order.estado === 'FINALIZADO') {
          order.finalizedAt = new Date().toISOString();
        }
        addHistory(order, {
          action: 'FINALIZACION_AUTOMATICA',
          prevStatus: prevTransitionStatus,
          newStatus: order.estado,
          user: 'Sistema Central',
          role: 'ADMIN',
          comment: transition.reason,
        });
      }

      const updated = await dbUpdateOrder(order);
      res.json(sanitizeOrderByRole(updated, authUser.role));
    } catch (err: any) {
      res.status(500).json({ error: 'Error al registrar número de recepción', details: err.message });
    }
  });

  // Upload Manifest (Provider, Admin, or Operational User)
  app.post('/api/orders/:id/manifest/upload', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'PROVIDER' && authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
        return res.status(403).json({ error: 'No tiene permisos para subir manifiestos en esta orden' });
      }

      const order = await dbGetOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      const { fileName, fileSize, fileDataUrl, providerId } = req.body;
      const targetProviderId = authUser.role === 'PROVIDER' ? authUser.entityId : providerId;

      if (authUser.role === 'PROVIDER' && (!targetProviderId || order.proveedorId !== targetProviderId)) {
        return res.status(403).json({ error: 'Solo el proveedor asignado puede subir el manifiesto de esta orden' });
      }
      if (authUser.role === 'ADMIN' && providerId && order.proveedorId !== providerId) {
        return res.status(403).json({ error: 'Solo el proveedor asignado puede subir el manifiesto de esta orden' });
      }

      if (!fileName || String(fileName).trim().length === 0) {
        return res.status(400).json({ error: 'El nombre del archivo es obligatorio' });
      }

      const nextVersion = (order.manifiestos.length > 0 ? Math.max(...order.manifiestos.map(m => m.version)) : 0) + 1;
      const nowIso = new Date().toISOString();

      order.manifiestos.forEach(m => {
        m.isCurrent = false;
      });

      const newManifest: ManifestDocument = {
        version: nextVersion,
        fileName: String(fileName).trim(),
        fileSize: fileSize || '1.2 MB',
        fileDataUrl: fileDataUrl || `data:application/pdf;base64,JVBERi0xLjQK...[mock-secure-doc-v${nextVersion}]`,
        uploadedBy: authUser.email || authUser.nombre || order.proveedorNombre || 'Usuario',
        uploadedAt: nowIso,
        status: 'PENDING',
        isCurrent: true,
      };

      order.manifiestos.push(newManifest);
      order.manifiestoActual = newManifest;
      order.manifestUploadedAt = nowIso;

      addHistory(order, {
        action: 'CARGA_MANIFIESTO',
        user: authUser.email,
        role: authUser.role,
        comment: `Manifiesto versión ${nextVersion} ('${newManifest.fileName}') subido por ${authUser.nombre} (${authUser.role}). Estado: PENDING (pendiente de revisión).`,
        details: { version: nextVersion, fileName: newManifest.fileName, status: 'PENDING' },
      });

      const updated = await dbUpdateOrder(order);
      const returnRole: Role =
        authUser.role === 'ADMIN' && providerId ? 'PROVIDER' : authUser.role;
      res.json(sanitizeOrderByRole(updated, returnRole, targetProviderId || undefined));
    } catch (err: any) {
      res.status(500).json({ error: 'Error al subir manifiesto', details: err.message });
    }
  });

  // Review Manifest (Admin or Operational User: Approve or Reject)
  app.post('/api/orders/:id/manifest/review', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
        return res.status(403).json({ error: 'No tiene permisos para aprobar o rechazar manifiestos' });
      }

      const order = await dbGetOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      const { action, reason } = req.body;

      if (!order.manifiestoActual) {
        return res.status(400).json({ error: 'No hay ningún manifiesto cargado para revisar en esta orden' });
      }

      const nowIso = new Date().toISOString();

      if (action === 'REJECT') {
        if (!reason || String(reason).trim().length === 0) {
          return res.status(400).json({ error: 'Debe especificar el motivo del rechazo del manifiesto' });
        }

        order.manifiestoActual.status = 'REJECTED';
        order.manifiestoActual.rejectionReason = String(reason).trim();
        order.manifiestoActual.reviewedBy = authUser.email;
        order.manifiestoActual.reviewedAt = nowIso;
        order.manifestReviewedAt = nowIso;

        addHistory(order, {
          action: 'RECHAZO_MANIFIESTO',
          user: authUser.email,
          role: authUser.role,
          comment: `Manifiesto v${order.manifiestoActual.version} RECHAZADO. Motivo: ${order.manifiestoActual.rejectionReason}`,
          details: { version: order.manifiestoActual.version, motivo: order.manifiestoActual.rejectionReason },
        });

        const updated = await dbUpdateOrder(order);
        return res.json(sanitizeOrderByRole(updated, authUser.role));
      }

      if (action === 'APPROVE') {
        order.manifiestoActual.status = 'APPROVED';
        order.manifiestoActual.rejectionReason = undefined;
        order.manifiestoActual.reviewedBy = authUser.email;
        order.manifiestoActual.reviewedAt = nowIso;
        order.manifestReviewedAt = nowIso;

        addHistory(order, {
          action: 'APROBACION_MANIFIESTO',
          user: authUser.email,
          role: authUser.role,
          comment: `Manifiesto v${order.manifiestoActual.version} APROBADO por ${authUser.nombre}.`,
          details: { version: order.manifiestoActual.version },
        });

        const transition = evaluateOrderStateTransition(order);
        if (transition.changed) {
          const prevStatus = order.estado;
          order.estado = transition.nextState;
          if (order.estado === 'FINALIZADO') {
            order.finalizedAt = nowIso;
          }
          addHistory(order, {
            action: 'FINALIZACION_AUTOMATICA',
            prevStatus,
            newStatus: order.estado,
            user: 'Sistema Central',
            role: 'ADMIN',
            comment: transition.reason,
          });
        }

        const updated = await dbUpdateOrder(order);
        return res.json(sanitizeOrderByRole(updated, authUser.role));
      }

      return res.status(400).json({ error: 'Acción de revisión inválida' });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al procesar revisión del manifiesto', details: err.message });
    }
  });

  // Record billing / invoice number (Admin or Operational User)
  app.post('/api/orders/:id/record-invoice', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
        return res.status(403).json({ error: 'No está permitido que un proveedor o cliente registre facturación' });
      }

      const order = await dbGetOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      const { numeroFacturacion } = req.body;

      if (!numeroFacturacion || String(numeroFacturacion).trim().length === 0) {
        return res.status(400).json({ error: 'El número de facturación no puede estar vacío' });
      }

      const cleanInvoice = String(numeroFacturacion).trim();
      const nowIso = new Date().toISOString();
      const isEdit = Boolean(order.numeroFacturacion);
      const prevInvoice = order.numeroFacturacion;

      if (order.estado !== 'COMPLETO' && order.estado !== 'FACTURADO' && order.estado !== 'FINALIZADO') {
        order.facturacionPendiente = cleanInvoice;
        addHistory(order, {
          action: 'FACTURACION_ANTICIPADA_PENDIENTE',
          user: authUser.email,
          role: authUser.role,
          comment: `Número de facturación '${cleanInvoice}' registrado como pendiente de aplicación (la orden está en ${order.estado} y no se saltan estados operativos).`,
          details: { facturacionPendiente: cleanInvoice },
        });
        const updated = await dbUpdateOrder(order);
        return res.json(sanitizeOrderByRole(updated, authUser.role));
      }

      order.numeroFacturacion = cleanInvoice;
      order.facturacionRegistradaPor = authUser.email;
      order.invoicedAt = nowIso;
      order.facturacionPendiente = null;

      if (order.estado === 'COMPLETO') {
        const prevStatus = order.estado;
        order.estado = 'FACTURADO';

        addHistory(order, {
          action: isEdit ? 'MODIFICACION_FACTURA' : 'REGISTRO_FACTURACION',
          prevStatus,
          newStatus: 'FACTURADO',
          user: authUser.email,
          role: authUser.role,
          comment: isEdit
            ? `Factura modificada de '${prevInvoice}' a '${cleanInvoice}'.`
            : `Factura '${cleanInvoice}' registrada. Orden pasa a FACTURADO.`,
          details: { facturaAnterior: prevInvoice, nuevaFactura: cleanInvoice },
        });
      } else {
        addHistory(order, {
          action: 'MODIFICACION_FACTURA',
          prevStatus: order.estado,
          newStatus: order.estado,
          user: authUser.email,
          role: authUser.role,
          comment: `Factura actualizada a '${cleanInvoice}'.`,
          details: { facturaAnterior: prevInvoice, nuevaFactura: cleanInvoice },
        });
      }

      const transition = evaluateOrderStateTransition(order);
      if (transition.changed) {
        const prevTransStatus = order.estado;
        order.estado = transition.nextState;
        if (order.estado === 'FINALIZADO') {
          order.finalizedAt = nowIso;
        }
        addHistory(order, {
          action: 'FINALIZACION_AUTOMATICA',
          prevStatus: prevTransStatus,
          newStatus: order.estado,
          user: 'Sistema Central',
          role: 'ADMIN',
          comment: transition.reason,
        });
      }

      const updated = await dbUpdateOrder(order);
      res.json(sanitizeOrderByRole(updated, authUser.role));
    } catch (err: any) {
      res.status(500).json({ error: 'Error al registrar facturación', details: err.message });
    }
  });

  // Reopen finalized order (Admin or Operational User)
  app.post('/api/orders/:id/reopen', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN' && authUser.role !== 'USER') {
        return res.status(403).json({ error: 'Solo personal autorizado puede reabrir una orden finalizada' });
      }

      const order = await dbGetOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      const { motivo } = req.body;

      if (order.estado !== 'FINALIZADO') {
        return res.status(400).json({ error: 'Solo se pueden reabrir órdenes que se encuentren en estado FINALIZADO' });
      }

      if (!motivo || String(motivo).trim().length === 0) {
        return res.status(400).json({ error: 'Debe proporcionar una justificación obligatoria para la reapertura' });
      }

      const prevStatus = order.estado;
      order.estado = 'FACTURADO';
      order.finalizedAt = null;

      addHistory(order, {
        action: 'REAPERTURA_ADMINISTRATIVA',
        prevStatus,
        newStatus: 'FACTURADO',
        user: authUser.email,
        role: authUser.role,
        comment: `Reapertura administrativa autorizada. Motivo: ${String(motivo).trim()}`,
        details: { justificacion: String(motivo).trim() },
      });

      const updated = await dbUpdateOrder(order);
      res.json(sanitizeOrderByRole(updated, authUser.role));
    } catch (err: any) {
      res.status(500).json({ error: 'Error al reabrir orden', details: err.message });
    }
  });

  // Acceptance Test Suite Runner (Admin Only)
  app.get('/api/acceptance-tests', async (req: Request, res: Response) => {
    const authUser = await getAuthUser(req);
    if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
    if (authUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo el administrador tiene acceso a la suite de pruebas' });
    }
    const suite = runAcceptanceTests();
    res.json(suite);
  });

  // Reset database to seed in PostgreSQL (Admin Only)
  app.post('/api/reset-data', async (req: Request, res: Response) => {
    try {
      const authUser = await getAuthUser(req);
      if (!authUser) return res.status(401).json({ error: 'Autenticación requerida' });
      if (authUser.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Solo el administrador puede reiniciar la base de datos' });
      }
      await dbResetData({
        providers: SEED_PROVIDERS,
        clients: SEED_CLIENTS,
        catalogConcepts: SEED_CATALOG_CONCEPTS,
        serviceLocations: SEED_SERVICE_LOCATIONS,
        orders: getInitialSeedOrders(),
      });
      res.json({ message: 'Datos reiniciados con éxito en PostgreSQL', totalOrders: 6 });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al reiniciar datos en PostgreSQL', details: err.message });
    }
  });

  // Serve static files in production or mount Vite middleware in development
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
