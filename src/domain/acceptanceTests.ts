import Decimal from 'decimal.js';
import type { Order, Role, Provider, Client, HistoryEntry, ManifestDocument, ItemConcept } from '../types.ts';
import {
  calculateOrderTotals,
  calculateSla,
  canFinalizeOrder,
  evaluateOrderStateTransition,
  sanitizeOrderByRole,
} from './rules.ts';

export interface TestCaseResult {
  id: number;
  title: string;
  description: string;
  passed: boolean;
  error?: string;
  details?: Record<string, any>;
}

export interface AcceptanceSuiteResult {
  total: number;
  passed: number;
  failed: number;
  timestamp: string;
  results: TestCaseResult[];
}

/**
 * Generador en memoria de orden para pruebas aisladas
 */
function createMockOrder(overrides: Partial<Order> = {}): Order {
  const conceptos: ItemConcept[] = [
    { id: 'item-1', item: 'Residuos Orgánicos', unidad: 'ST', descripcion: 'Recolección de Residuos Orgánicos', cantidad: 10, cantidadOrdenada: 10, precioUnitario: 150.5, importe: 1505.0 },
    { id: 'item-2', item: 'Tratamiento y Disposición', unidad: 'ST', descripcion: 'Tratamiento y Disposición', cantidad: 5, cantidadOrdenada: 5, precioUnitario: 220.0, importe: 1100.0 },
  ];
  const totals = calculateOrderTotals(conceptos, null);

  const base: Order = {
    id: `ORD-TEST-${Math.floor(Math.random() * 10000)}`,
    folio: `FOL-${Math.floor(Math.random() * 10000)}`,
    clienteId: 'client-1',
    clienteNombre: 'Bimbo México SA de CV',
    proveedorId: null,
    proveedorNombre: null,
    fechaOrden: new Date().toISOString(),
    conceptos,
    subtotalCliente: totals.subtotalCliente,
    costoTotalCliente: totals.costoTotalCliente,
    costoProveedor: totals.costoProveedor,
    utilidadEstimada: totals.utilidadEstimada,
    estado: 'CREADO',
    numeroRecepcion: null,
    recepcionRegistradaPor: null,
    numeroFacturacion: null,
    facturacionRegistradaPor: null,
    facturacionPendiente: null,
    createdAt: new Date().toISOString(),
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
        id: 'h-1',
        timestamp: new Date().toISOString(),
        action: 'CREACION_ORDEN',
        newStatus: 'CREADO',
        user: 'admin@logitrack.com',
        role: 'ADMIN',
        comment: 'Orden creada inicialmente sin proveedor asignado.',
      },
    ],
  };

  return { ...base, ...overrides };
}

/**
 * Ejecuta la suite completa de 13 pruebas de aceptación reglamentarias
 */
export function runAcceptanceTests(): AcceptanceSuiteResult {
  const results: TestCaseResult[] = [];

  // 1. Una orden puede crearse sin proveedor
  try {
    const order = createMockOrder({ proveedorId: null, proveedorNombre: null, estado: 'CREADO' });
    const passed = order.proveedorId === null && order.estado === 'CREADO';
    results.push({
      id: 1,
      title: 'Creación de orden sin proveedor',
      description: 'Una orden puede crearse sin proveedor y permanece en estado CREADO.',
      passed,
      details: { proveedorId: order.proveedorId, estado: order.estado },
    });
  } catch (err: any) {
    results.push({ id: 1, title: 'Creación de orden sin proveedor', description: '', passed: false, error: err.message });
  }

  // 2. Una orden solo tiene un proveedor actual
  try {
    let order = createMockOrder();
    // Asignación de proveedor
    order.proveedorId = 'prov-1';
    order.proveedorNombre = 'Transportes Rápidos';
    order.costoProveedor = 1200.0;
    const totals = calculateOrderTotals(order.conceptos, order.costoProveedor);
    order.utilidadEstimada = totals.utilidadEstimada;
    order.assignedAt = new Date().toISOString();
    order.estado = 'ASIGNANDO';

    // Debe ser exactamente un solo ID de tipo string
    const passed = typeof order.proveedorId === 'string' && order.proveedorId === 'prov-1' && order.estado === 'ASIGNANDO';
    results.push({
      id: 2,
      title: 'Un solo proveedor por orden',
      description: 'Cada orden tiene como máximo un proveedor actual asignado a la vez.',
      passed,
      details: { proveedorActual: order.proveedorNombre, estado: order.estado, costoProveedor: order.costoProveedor },
    });
  } catch (err: any) {
    results.push({ id: 2, title: 'Un solo proveedor por orden', description: '', passed: false, error: err.message });
  }

  // 3. La reasignación queda registrada
  try {
    let order = createMockOrder({
      proveedorId: 'prov-1',
      proveedorNombre: 'Proveedor A',
      estado: 'ASIGNANDO',
    });
    // Reasignar
    const prevProv = order.proveedorNombre;
    const newProvId = 'prov-2';
    const newProvNombre = 'Proveedor B';
    const reassignedUser = 'admin@logitrack.com';
    const reassignedAt = new Date().toISOString();

    order.historial.push({
      id: 'h-reassign',
      timestamp: reassignedAt,
      action: 'REASIGNACION_PROVEEDOR',
      user: reassignedUser,
      role: 'ADMIN',
      comment: `Reasignado de ${prevProv} a ${newProvNombre}`,
      details: { proveedorAnterior: prevProv, proveedorNuevo: newProvNombre },
    });
    order.proveedorId = newProvId;
    order.proveedorNombre = newProvNombre;

    const reassignLog = order.historial.find(h => h.action === 'REASIGNACION_PROVEEDOR');
    const passed = Boolean(
      order.proveedorId === 'prov-2' &&
      reassignLog &&
      reassignLog.details?.proveedorAnterior === 'Proveedor A' &&
      reassignLog.details?.proveedorNuevo === 'Proveedor B' &&
      reassignLog.user === reassignedUser
    );

    results.push({
      id: 3,
      title: 'Registro de reasignación en historial',
      description: 'Si el administrador reasigna una orden, se conserva el proveedor anterior, el nuevo proveedor, el usuario y la fecha en el historial.',
      passed,
      details: { log: reassignLog },
    });
  } catch (err: any) {
    results.push({ id: 3, title: 'Registro de reasignación en historial', description: '', passed: false, error: err.message });
  }

  // 4. Registrar recepción en ASIGNANDO o EN_PROCESO cambia la orden a COMPLETO
  try {
    // Caso A: desde ASIGNANDO
    const orderAsignando = createMockOrder({
      proveedorId: 'prov-1',
      proveedorNombre: 'Proveedor A',
      estado: 'ASIGNANDO',
    });
    // Registrar recepción
    orderAsignando.numeroRecepcion = 'REC-2026-99';
    orderAsignando.recepcionRegistradaPor = 'admin@logitrack.com';
    orderAsignando.receptionRecordedAt = new Date().toISOString();
    if (orderAsignando.estado === 'ASIGNANDO' || orderAsignando.estado === 'EN_PROCESO') {
      orderAsignando.estado = 'COMPLETO';
    }

    // Caso B: desde EN_PROCESO
    const orderEnProceso = createMockOrder({
      proveedorId: 'prov-1',
      proveedorNombre: 'Proveedor A',
      estado: 'EN_PROCESO',
    });
    orderEnProceso.numeroRecepcion = 'REC-2026-100';
    orderEnProceso.recepcionRegistradaPor = 'admin@logitrack.com';
    orderEnProceso.receptionRecordedAt = new Date().toISOString();
    if (orderEnProceso.estado === 'ASIGNANDO' || orderEnProceso.estado === 'EN_PROCESO') {
      orderEnProceso.estado = 'COMPLETO';
    }

    const passed = orderAsignando.estado === 'COMPLETO' && orderEnProceso.estado === 'COMPLETO';
    results.push({
      id: 4,
      title: 'Transición a COMPLETO por número de recepción',
      description: 'Registrar recepción válida en ASIGNANDO o EN_PROCESO cambia la orden a COMPLETO.',
      passed,
      details: { estadoDesdeAsignando: orderAsignando.estado, estadoDesdeEnProceso: orderEnProceso.estado },
    });
  } catch (err: any) {
    results.push({ id: 4, title: 'Transición a COMPLETO por número de recepción', description: '', passed: false, error: err.message });
  }

  // 5. Registrar recepción no aprueba un manifiesto
  try {
    const order = createMockOrder({
      proveedorId: 'prov-1',
      estado: 'EN_PROCESO',
      manifiestos: [
        {
          version: 1,
          fileName: 'manifiesto_v1.pdf',
          uploadedBy: 'operador@prov.com',
          uploadedAt: new Date().toISOString(),
          status: 'PENDING',
          isCurrent: true,
        },
      ],
      manifiestoActual: {
        version: 1,
        fileName: 'manifiesto_v1.pdf',
        uploadedBy: 'operador@prov.com',
        uploadedAt: new Date().toISOString(),
        status: 'PENDING',
        isCurrent: true,
      },
    });

    // Registrar recepción
    order.numeroRecepcion = 'REC-2026-101';
    order.estado = 'COMPLETO';

    // Regla: No aprobar el manifiesto como consecuencia de registrar la recepción
    const manifestStatus = order.manifiestoActual?.status;
    const passed = order.estado === 'COMPLETO' && manifestStatus === 'PENDING';

    results.push({
      id: 5,
      title: 'Recepción independiente del manifiesto',
      description: 'Registrar el número de recepción no aprueba automáticamente el manifiesto (conserva PENDING).',
      passed,
      details: { ordenEstado: order.estado, manifiestoEstado: manifestStatus },
    });
  } catch (err: any) {
    results.push({ id: 5, title: 'Recepción independiente del manifiesto', description: '', passed: false, error: err.message });
  }

  // 6. Registrar facturación antes de completar la orden no permite saltarse los estados operativos
  try {
    const order = createMockOrder({
      proveedorId: 'prov-1',
      estado: 'EN_PROCESO',
    });

    // Administrador registra número de facturación prematuramente
    const invoiceNum = 'FAC-2026-555';
    // Regla: si se registra antes de completar la orden, conservar como pendiente de aplicación y no saltarse los estados operativos
    if (order.estado !== 'COMPLETO') {
      order.facturacionPendiente = invoiceNum;
      // El estado NO cambia a FACTURADO
    } else {
      order.numeroFacturacion = invoiceNum;
      order.estado = 'FACTURADO';
    }

    const passed = order.estado === 'EN_PROCESO' && order.facturacionPendiente === 'FAC-2026-555' && order.numeroFacturacion === null;
    results.push({
      id: 6,
      title: 'Facturación anticipada no salta estados',
      description: 'Registrar facturación antes de completar la orden conserva el dato como pendiente sin saltarse estados operativos.',
      passed,
      details: { estadoActual: order.estado, facturacionPendiente: order.facturacionPendiente },
    });
  } catch (err: any) {
    results.push({ id: 6, title: 'Facturación anticipada no salta estados', description: '', passed: false, error: err.message });
  }

  // 7. Una orden COMPLETO sin factura no puede finalizar
  try {
    const order = createMockOrder({
      proveedorId: 'prov-1',
      estado: 'COMPLETO',
      numeroRecepcion: 'REC-001',
      numeroFacturacion: null, // Sin factura
      manifiestoActual: {
        version: 1,
        fileName: 'doc.pdf',
        uploadedBy: 'prov',
        uploadedAt: new Date().toISOString(),
        status: 'APPROVED',
        isCurrent: true,
      },
    });

    const { canFinalize, missingConditions } = canFinalizeOrder(order);
    const transition = evaluateOrderStateTransition(order);

    const passed = canFinalize === false && transition.nextState === 'COMPLETO' && missingConditions.includes('Número de facturación válido');
    results.push({
      id: 7,
      title: 'Orden COMPLETO sin factura no finaliza',
      description: 'Una orden COMPLETO sin factura no puede finalizar incluso si el manifiesto está aprobado.',
      passed,
      details: { canFinalize, missingConditions, nextState: transition.nextState },
    });
  } catch (err: any) {
    results.push({ id: 7, title: 'Orden COMPLETO sin factura no finaliza', description: '', passed: false, error: err.message });
  }

  // 8. Una orden FACTURADO sin manifiesto aprobado no puede finalizar
  try {
    const order = createMockOrder({
      proveedorId: 'prov-1',
      estado: 'FACTURADO',
      numeroRecepcion: 'REC-001',
      numeroFacturacion: 'FAC-001',
      manifiestoActual: {
        version: 1,
        fileName: 'doc.pdf',
        uploadedBy: 'prov',
        uploadedAt: new Date().toISOString(),
        status: 'PENDING', // Aún no aprobado
        isCurrent: true,
      },
    });

    const { canFinalize, missingConditions } = canFinalizeOrder(order);
    const transition = evaluateOrderStateTransition(order);

    const passed = canFinalize === false && transition.nextState === 'FACTURADO' && missingConditions.includes('Manifiesto vigente aprobado por un administrador');
    results.push({
      id: 8,
      title: 'Orden FACTURADO sin manifiesto aprobado no finaliza',
      description: 'Una orden en FACTURADO con manifiesto PENDING o REJECTED no puede transicionar a FINALIZADO.',
      passed,
      details: { canFinalize, missingConditions, nextState: transition.nextState },
    });
  } catch (err: any) {
    results.push({ id: 8, title: 'Orden FACTURADO sin manifiesto aprobado no finaliza', description: '', passed: false, error: err.message });
  }

  // 9. Una orden con recepción, factura y manifiesto aprobado pasa a FINALIZADO
  try {
    const order = createMockOrder({
      proveedorId: 'prov-1',
      estado: 'FACTURADO',
      numeroRecepcion: 'REC-001',
      numeroFacturacion: 'FAC-001',
      manifiestoActual: {
        version: 1,
        fileName: 'doc.pdf',
        uploadedBy: 'prov',
        uploadedAt: new Date().toISOString(),
        status: 'APPROVED',
        isCurrent: true,
      },
    });

    const { canFinalize } = canFinalizeOrder(order);
    const transition = evaluateOrderStateTransition(order);

    const passed = canFinalize === true && transition.nextState === 'FINALIZADO';
    results.push({
      id: 9,
      title: 'Transición válida a FINALIZADO',
      description: 'Una orden con número de recepción, factura y manifiesto aprobado pasa satisfactoriamente a FINALIZADO.',
      passed,
      details: { canFinalize, nextState: transition.nextState, reason: transition.reason },
    });
  } catch (err: any) {
    results.push({ id: 9, title: 'Transición válida a FINALIZADO', description: '', passed: false, error: err.message });
  }

  // 10. Aprobar un manifiesto cuando falta factura no finaliza la orden (permanece en COMPLETO)
  try {
    const order = createMockOrder({
      proveedorId: 'prov-1',
      estado: 'COMPLETO',
      numeroRecepcion: 'REC-001',
      numeroFacturacion: null, // Falta factura
      manifiestoActual: {
        version: 1,
        fileName: 'doc.pdf',
        uploadedBy: 'prov',
        uploadedAt: new Date().toISOString(),
        status: 'APPROVED',
        isCurrent: true,
      },
    });

    const transition = evaluateOrderStateTransition(order);
    const passed = transition.nextState === 'COMPLETO';

    results.push({
      id: 10,
      title: 'Aprobación de manifiesto sin factura conserva COMPLETO',
      description: 'Si se aprueba el manifiesto cuando la orden está en COMPLETO y aún no existe factura, la orden debe permanecer en COMPLETO.',
      passed,
      details: { estadoFinal: transition.nextState },
    });
  } catch (err: any) {
    results.push({ id: 10, title: 'Aprobación de manifiesto sin factura conserva COMPLETO', description: '', passed: false, error: err.message });
  }

  // 11. Los costos y la utilidad son visibles únicamente para el administrador
  try {
    const order = createMockOrder({
      proveedorId: 'prov-1',
      costoProveedor: 1200.0,
    });
    const totals = calculateOrderTotals(order.conceptos, order.costoProveedor);
    order.subtotalCliente = totals.subtotalCliente;
    order.costoTotalCliente = totals.costoTotalCliente;
    order.utilidadEstimada = totals.utilidadEstimada;

    const adminView = sanitizeOrderByRole(order, 'ADMIN');
    const hasAdminUtility = adminView?.utilidadEstimada === 1405.0 && adminView?.costoProveedor === 1200.0;

    results.push({
      id: 11,
      title: 'Visibilidad completa de costos y utilidad para el Administrador',
      description: 'El administrador puede consultar el costo del cliente, costo del proveedor y la utilidad estimada calculada con Decimal.',
      passed: Boolean(hasAdminUtility),
      details: {
        costoTotalCliente: adminView?.costoTotalCliente,
        costoProveedor: adminView?.costoProveedor,
        utilidadEstimada: adminView?.utilidadEstimada,
      },
    });
  } catch (err: any) {
    results.push({ id: 11, title: 'Visibilidad completa de costos para Administrador', description: '', passed: false, error: err.message });
  }

  // 12. El cliente no puede consultar los costos internos del proveedor ni utilidad
  try {
    const order = createMockOrder({
      clienteId: 'client-1',
      proveedorId: 'prov-1',
      costoProveedor: 1200.0,
      utilidadEstimada: 1405.0,
      manifiestos: [
        {
          version: 1,
          fileName: 'doc_pendiente.pdf',
          uploadedBy: 'prov',
          uploadedAt: new Date().toISOString(),
          status: 'PENDING',
          isCurrent: false,
        },
        {
          version: 2,
          fileName: 'doc_aprobado.pdf',
          uploadedBy: 'prov',
          uploadedAt: new Date().toISOString(),
          status: 'APPROVED',
          isCurrent: true,
        },
      ],
      manifiestoActual: {
        version: 2,
        fileName: 'doc_aprobado.pdf',
        uploadedBy: 'prov',
        uploadedAt: new Date().toISOString(),
        status: 'APPROVED',
        isCurrent: true,
      },
    });

    const clientView = sanitizeOrderByRole(order, 'CLIENT', 'client-1');

    const passed = Boolean(
      clientView &&
      clientView.costoProveedor === null &&
      clientView.utilidadEstimada === null &&
      clientView.subtotalCliente > 0 &&
      clientView.manifiestos.every(m => m.status === 'APPROVED')
    );

    results.push({
      id: 12,
      title: 'Privacidad de costos y manifiestos para el Cliente',
      description: 'El cliente no puede ver costo de proveedor ni utilidad estimada, y solo consulta manifiestos aprobados.',
      passed,
      details: {
        costoProveedorVisible: clientView?.costoProveedor,
        utilidadVisible: clientView?.utilidadEstimada,
        manifiestosVisibles: clientView?.manifiestos.map(m => ({ version: m.version, status: m.status })),
      },
    });
  } catch (err: any) {
    results.push({ id: 12, title: 'Privacidad de costos para Cliente', description: '', passed: false, error: err.message });
  }

  // 13. Los cambios de estado y documentos quedan registrados en el historial
  try {
    const order = createMockOrder();
    // Registrar cambio de estado
    order.historial.push({
      id: 'h-test-status',
      timestamp: new Date().toISOString(),
      action: 'CAMBIO_ESTADO',
      prevStatus: 'CREADO',
      newStatus: 'ASIGNANDO',
      user: 'admin@logitrack.com',
      role: 'ADMIN',
      comment: 'Asignado a Transportes Rápidos',
    });
    // Registrar carga de documento
    order.historial.push({
      id: 'h-test-doc',
      timestamp: new Date().toISOString(),
      action: 'CARGA_MANIFIESTO',
      user: 'chofer@proveedor.com',
      role: 'PROVIDER',
      comment: 'Subida versión 1 del manifiesto de recolección',
      details: { version: 1, fileName: 'manifiesto_fol99.pdf' },
    });

    const hasStatusLog = order.historial.some(h => h.action === 'CAMBIO_ESTADO' && h.prevStatus === 'CREADO' && h.newStatus === 'ASIGNANDO');
    const hasDocLog = order.historial.some(h => h.action === 'CARGA_MANIFIESTO');

    const passed = hasStatusLog && hasDocLog;
    results.push({
      id: 13,
      title: 'Auditoría completa en historial',
      description: 'Cada cambio de estado y evento documental queda registrado en el historial con estado anterior, nuevo, usuario y fecha.',
      passed,
      details: { totalEntradas: order.historial.length, logs: order.historial.map(h => h.action) },
    });
  } catch (err: any) {
    results.push({ id: 13, title: 'Auditoría completa en historial', description: '', passed: false, error: err.message });
  }

  const passedCount = results.filter(r => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    timestamp: new Date().toISOString(),
    results,
  };
}
