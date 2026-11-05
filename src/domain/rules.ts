import Decimal from 'decimal.js';
import type { Order, OrderStatus, SlaInfo, SlaColor, Role, ItemConcept } from '../types.ts';

// Configurar precisión de Decimal
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Calcula de manera estricta los importes de los conceptos y el subtotal con Decimal
 */
export function calculateItemImporte(cantidad: number, precioUnitario: number): number {
  const dQty = new Decimal(cantidad || 0);
  const dPrice = new Decimal(precioUnitario || 0);
  return dQty.times(dPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function calculateOrderTotals(conceptos: ItemConcept[], costoProveedor: number | null = null): {
  subtotalCliente: number;
  costoTotalCliente: number;
  costoProveedor: number | null;
  utilidadEstimada: number | null;
} {
  let subtotal = new Decimal(0);
  for (const item of conceptos) {
    const qty = item.cantidadOrdenada !== undefined && item.cantidadOrdenada !== null ? item.cantidadOrdenada : item.cantidad;
    const itemImporte = new Decimal(calculateItemImporte(qty, item.precioUnitario));
    subtotal = subtotal.plus(itemImporte);
  }
  const subtotalNumber = subtotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  const costoTotalCliente = subtotalNumber; // En MVP es igual al subtotal

  let utilidadEstimada: number | null = null;
  let provCostNumber: number | null = null;

  if (costoProveedor !== null && costoProveedor !== undefined) {
    const provCost = new Decimal(costoProveedor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    provCostNumber = provCost.toNumber();
    utilidadEstimada = new Decimal(costoTotalCliente).minus(provCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  return {
    subtotalCliente: subtotalNumber,
    costoTotalCliente,
    costoProveedor: provCostNumber,
    utilidadEstimada,
  };
}

/**
 * Obtiene la fecha en formato YYYY-MM-DD en la zona horaria America/Mexico_City
 */
export function getMexicoCityDateString(isoString: string): string {
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Calcula los días calendario transcurridos en America/Mexico_City
 * - Para órdenes asignadas: desde assignedAt
 * - Para órdenes no asignadas: desde fechaOrden
 * - En órdenes finalizadas: conserva el tiempo transcurrido hasta finalizedAt
 */
export function calculateSla(order: Pick<Order, 'estado' | 'assignedAt' | 'fechaOrden' | 'finalizedAt'>): SlaInfo {
  const isFinalized = order.estado === 'FINALIZADO';
  const startIso = order.assignedAt || order.fechaOrden;
  const endIso = isFinalized && order.finalizedAt ? order.finalizedAt : new Date().toISOString();

  const startDateStr = getMexicoCityDateString(startIso);
  const endDateStr = getMexicoCityDateString(endIso);

  const [y1, m1, d1] = startDateStr.split('-').map(Number);
  const [y2, m2, d2] = endDateStr.split('-').map(Number);

  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);

  const diffTime = utc2 - utc1;
  const days = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  let color: SlaColor = 'gray';
  let label = '0 días';

  if (days === 0) {
    color = 'gray';
    label = '0 días';
  } else if (days >= 1 && days <= 5) {
    color = 'green';
    label = `${days} ${days === 1 ? 'día' : 'días'}`;
  } else if (days >= 6 && days <= 8) {
    color = 'yellow';
    label = `${days} días`;
  } else if (days >= 9 && days <= 10) {
    color = 'orange';
    label = `${days} días`;
  } else {
    color = 'red';
    label = `${days} días`;
  }

  return {
    days,
    color,
    label,
    referenceDate: startIso,
    endDate: endIso,
    isFinalized,
  };
}

/**
 * Función central de dominio para evaluar y determinar si una orden puede pasar a FINALIZADO
 * Requiere simultáneamente:
 * 1. Número de recepción válido
 * 2. Número de facturación válido
 * 3. Manifiesto vigente aprobado por un administrador
 */
export function canFinalizeOrder(order: Pick<Order, 'numeroRecepcion' | 'numeroFacturacion' | 'manifiestoActual' | 'facturacionPendiente'>): {
  canFinalize: boolean;
  missingConditions: string[];
} {
  const missing: string[] = [];

  const hasReception = Boolean(order.numeroRecepcion && order.numeroRecepcion.trim().length > 0);
  if (!hasReception) {
    missing.push('Número de recepción válido');
  }

  const invoiceNum = order.numeroFacturacion || order.facturacionPendiente;
  const hasInvoice = Boolean(invoiceNum && invoiceNum.trim().length > 0);
  if (!hasInvoice) {
    missing.push('Número de facturación válido');
  }

  const hasApprovedManifest = Boolean(order.manifiestoActual && order.manifiestoActual.status === 'APPROVED');
  if (!hasApprovedManifest) {
    missing.push('Manifiesto vigente aprobado por un administrador');
  }

  return {
    canFinalize: missing.length === 0,
    missingConditions: missing,
  };
}

/**
 * Evalúa las transiciones oficiales de estado según las reglas de negocio
 */
export function evaluateOrderStateTransition(order: Order): {
  nextState: OrderStatus;
  changed: boolean;
  reason?: string;
} {
  // Una orden finalizada no cambia automáticamente
  if (order.estado === 'FINALIZADO') {
    return { nextState: 'FINALIZADO', changed: false };
  }

  // Si tiene recepción, factura y manifiesto aprobado -> FINALIZADO
  const { canFinalize } = canFinalizeOrder(order);
  if (canFinalize && (order.estado === 'COMPLETO' || order.estado === 'FACTURADO')) {
    return {
      nextState: 'FINALIZADO',
      changed: true,
      reason: 'Se cumplieron todas las condiciones: recepción válida, facturación válida y manifiesto aprobado.',
    };
  }

  // Si la orden está en COMPLETO y tiene número de facturación pero aún no aprueba manifiesto -> FACTURADO
  const hasInvoice = Boolean(order.numeroFacturacion && order.numeroFacturacion.trim().length > 0);
  if (order.estado === 'COMPLETO' && hasInvoice) {
    return {
      nextState: 'FACTURADO',
      changed: true,
      reason: 'Número de facturación registrado. En espera de aprobación final del manifiesto.',
    };
  }

  return { nextState: order.estado, changed: false };
}

/**
 * Sanitiza los datos de la orden según el rol del usuario para proteger información confidencial:
 * - Admin: ve todos los costos y la utilidad estimada.
 * - Provider: ve solo datos operativos necesarios, estado de manifiesto. NUNCA ve costoTotalCliente, subtotalCliente ni utilidad estimada.
 * - Client: ve sus importes de cliente (subtotal, total). NUNCA ve costoProveedor ni utilidad estimada. Solo ve manifiestos aprobados.
 */
export function sanitizeOrderByRole(order: Order, role: Role, currentEntityId?: string): Order | null {
  if (role === 'ADMIN') {
    return order;
  }

  if (role === 'PROVIDER') {
    // El proveedor solo puede ver órdenes que le han sido asignadas
    if (order.proveedorId !== currentEntityId) {
      return null;
    }
    return {
      ...order,
      // Ocultar importes cobrados al cliente y utilidad del negocio
      subtotalCliente: 0,
      costoTotalCliente: 0,
      utilidadEstimada: null,
      conceptos: order.conceptos.map(c => ({
        ...c,
        precioUnitario: 0,
        importe: 0,
      })),
      // Solo ve su costo asignado (lo que él cobra)
    };
  }

  if (role === 'CLIENT') {
    // El cliente solo puede ver sus órdenes
    if (order.clienteId !== currentEntityId) {
      return null;
    }
    // El cliente nunca debe visualizar el costo interno del proveedor ni la utilidad estimada
    return {
      ...order,
      costoProveedor: null,
      utilidadEstimada: null,
      // Solo puede consultar manifiestos APROBADOS
      manifiestos: order.manifiestos.filter(m => m.status === 'APPROVED'),
      manifiestoActual: order.manifiestoActual?.status === 'APPROVED' ? order.manifiestoActual : null,
    };
  }

  return order;
}
