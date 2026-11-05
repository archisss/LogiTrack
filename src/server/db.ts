import pg from 'pg';
import type { Provider, Client, CatalogConcept, Order, OrderStatus } from '../types.ts';

const { Pool } = pg;

export interface DbStatus {
  connected: boolean;
  type: string;
  version?: string;
  database?: string;
  host?: string;
  error?: string;
}

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:iCAJY8QYtJOAe9hawjT8UEqP1ir6dGTPTfAiPQgHrjUXWb00E7ckgQdoW2Ugr6gH@167.86.69.219:15432/postgres';

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let dbStatus: DbStatus = {
  connected: false,
  type: 'PostgreSQL 18',
};

export async function getDbStatus(): Promise<DbStatus> {
  try {
    const res = await pool.query('SELECT version(), current_database() as db;');
    dbStatus = {
      connected: true,
      type: 'PostgreSQL 18',
      version: res.rows[0]?.version,
      database: res.rows[0]?.db,
      host: '167.86.69.219:15432 (Coolify)',
    };
  } catch (err: any) {
    dbStatus = {
      connected: false,
      type: 'PostgreSQL 18',
      error: err.message,
    };
  }
  return dbStatus;
}

export async function initDatabase(initialSeed: {
  providers: Provider[];
  clients: Client[];
  catalogConcepts: CatalogConcept[];
  orders: Order[];
}): Promise<void> {
  console.log('[DB] Inicializando tablas en PostgreSQL...');

  const client = await pool.connect();
  try {
    // 1. Providers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS providers (
        id VARCHAR(100) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        rfc VARCHAR(50) NOT NULL UNIQUE,
        activo BOOLEAN NOT NULL DEFAULT true,
        telefono VARCHAR(100) DEFAULT '',
        email VARCHAR(255) DEFAULT '',
        direccion JSONB,
        autorizacion_documento JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Clients table
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id VARCHAR(100) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        rfc VARCHAR(50) NOT NULL,
        email VARCHAR(255) DEFAULT '',
        telefono VARCHAR(100) DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3. Catalog concepts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS catalog_concepts (
        id VARCHAR(100) PRIMARY KEY,
        item VARCHAR(100) DEFAULT '',
        unidad VARCHAR(50) NOT NULL DEFAULT 'ST',
        descripcion TEXT NOT NULL,
        precio_unitario NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 4. Orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(100) PRIMARY KEY,
        numero_pedido VARCHAR(100),
        folio VARCHAR(100) NOT NULL UNIQUE,
        cliente_id VARCHAR(100) NOT NULL REFERENCES clients(id),
        cliente_nombre VARCHAR(255) NOT NULL,
        proveedor_id VARCHAR(100) REFERENCES providers(id) ON DELETE SET NULL,
        proveedor_nombre VARCHAR(255),
        fecha_orden TIMESTAMPTZ NOT NULL,
        conceptos JSONB NOT NULL DEFAULT '[]'::jsonb,
        subtotal_cliente NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
        costo_total_cliente NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
        costo_proveedor NUMERIC(14, 2),
        utilidad_estimada NUMERIC(14, 2),
        estado VARCHAR(50) NOT NULL DEFAULT 'CREADO',
        numero_recepcion VARCHAR(100),
        recepcion_registrada_por VARCHAR(255),
        numero_facturacion VARCHAR(100),
        facturacion_registrada_por VARCHAR(255),
        facturacion_pendiente VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        assigned_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ,
        reception_recorded_at TIMESTAMPTZ,
        manifest_uploaded_at TIMESTAMPTZ,
        manifest_reviewed_at TIMESTAMPTZ,
        invoiced_at TIMESTAMPTZ,
        finalized_at TIMESTAMPTZ,
        manifiestos JSONB NOT NULL DEFAULT '[]'::jsonb,
        manifiesto_actual JSONB,
        historial JSONB NOT NULL DEFAULT '[]'::jsonb
      );
    `);

    // Ensure numero_pedido column exists for existing tables
    await client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS numero_pedido VARCHAR(100);');

    console.log('[DB] Tablas verificadas exitosamente.');

    // Seed providers if empty
    const provCountRes = await client.query('SELECT COUNT(*) FROM providers;');
    if (parseInt(provCountRes.rows[0].count, 10) === 0) {
      console.log('[DB] Sembrando transportistas iniciales...');
      for (const p of initialSeed.providers) {
        await client.query(
          `INSERT INTO providers (id, nombre, rfc, activo, telefono, email, direccion, autorizacion_documento)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING;`,
          [
            p.id,
            p.nombre,
            p.rfc,
            p.activo,
            p.telefono || '',
            p.email || '',
            JSON.stringify(p.direccion || null),
            JSON.stringify(p.autorizacionDocumento || null),
          ]
        );
      }
    }

    // Seed clients if empty
    const clientCountRes = await client.query('SELECT COUNT(*) FROM clients;');
    if (parseInt(clientCountRes.rows[0].count, 10) === 0) {
      console.log('[DB] Sembrando clientes iniciales...');
      for (const c of initialSeed.clients) {
        await client.query(
          `INSERT INTO clients (id, nombre, rfc, email, telefono)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO NOTHING;`,
          [c.id, c.nombre, c.rfc, c.email || '', c.telefono || '']
        );
      }
    }

    // Seed catalog concepts if empty
    const catCountRes = await client.query('SELECT COUNT(*) FROM catalog_concepts;');
    if (parseInt(catCountRes.rows[0].count, 10) === 0) {
      console.log('[DB] Sembrando conceptos de catálogo...');
      for (const cat of initialSeed.catalogConcepts) {
        await client.query(
          `INSERT INTO catalog_concepts (id, item, unidad, descripcion, precio_unitario)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO NOTHING;`,
          [cat.id, cat.item || '', cat.unidad, cat.descripcion, cat.precioUnitario]
        );
      }
    }

    // Seed orders if empty
    const orderCountRes = await client.query('SELECT COUNT(*) FROM orders;');
    if (parseInt(orderCountRes.rows[0].count, 10) === 0) {
      console.log('[DB] Sembrando órdenes benchmark iniciales...');
      for (const ord of initialSeed.orders) {
        await client.query(
          `INSERT INTO orders (
            id, folio, cliente_id, cliente_nombre, proveedor_id, proveedor_nombre,
            fecha_orden, conceptos, subtotal_cliente, costo_total_cliente, costo_proveedor,
            utilidad_estimada, estado, numero_recepcion, recepcion_registrada_por,
            numero_facturacion, facturacion_registrada_por, facturacion_pendiente,
            created_at, assigned_at, started_at, reception_recorded_at,
            manifest_uploaded_at, manifest_reviewed_at, invoiced_at, finalized_at,
            manifiestos, manifiesto_actual, historial
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14, $15,
            $16, $17, $18,
            $19, $20, $21, $22,
            $23, $24, $25, $26,
            $27, $28, $29
          ) ON CONFLICT (id) DO NOTHING;`,
          [
            ord.id,
            ord.folio,
            ord.clienteId,
            ord.clienteNombre,
            ord.proveedorId || null,
            ord.proveedorNombre || null,
            ord.fechaOrden,
            JSON.stringify(ord.conceptos || []),
            ord.subtotalCliente,
            ord.costoTotalCliente,
            ord.costoProveedor ?? null,
            ord.utilidadEstimada ?? null,
            ord.estado,
            ord.numeroRecepcion || null,
            ord.recepcionRegistradaPor || null,
            ord.numeroFacturacion || null,
            ord.facturacionRegistradaPor || null,
            ord.facturacionPendiente || null,
            ord.createdAt,
            ord.assignedAt || null,
            ord.startedAt || null,
            ord.receptionRecordedAt || null,
            ord.manifestUploadedAt || null,
            ord.manifestReviewedAt || null,
            ord.invoicedAt || null,
            ord.finalizedAt || null,
            JSON.stringify(ord.manifiestos || []),
            JSON.stringify(ord.manifiestoActual || null),
            JSON.stringify(ord.historial || []),
          ]
        );
      }
    }

    console.log('[DB] Base de datos PostgreSQL inicializada con éxito.');
  } finally {
    client.release();
  }
}

// Map database row to Provider object
function mapRowToProvider(row: any): Provider {
  return {
    id: row.id,
    nombre: row.nombre,
    rfc: row.rfc,
    activo: Boolean(row.activo),
    telefono: row.telefono || '',
    email: row.email || '',
    direccion: row.direccion || undefined,
    autorizacionDocumento: row.autorizacion_documento || undefined,
  };
}

// Map database row to Client object
function mapRowToClient(row: any): Client {
  return {
    id: row.id,
    nombre: row.nombre,
    rfc: row.rfc,
    email: row.email || '',
    telefono: row.telefono || '',
  };
}

// Map database row to CatalogConcept object
function mapRowToCatalogConcept(row: any): CatalogConcept {
  return {
    id: row.id,
    item: row.item || '',
    unidad: row.unidad,
    descripcion: row.descripcion,
    precioUnitario: Number(row.precio_unitario) || 0,
  };
}

// Map database row to Order object
function mapRowToOrder(row: any): Order {
  return {
    id: row.id,
    numeroPedido: row.numero_pedido || row.folio,
    folio: row.folio,
    clienteId: row.cliente_id,
    clienteNombre: row.cliente_nombre,
    proveedorId: row.proveedor_id || null,
    proveedorNombre: row.proveedor_nombre || null,
    fechaOrden: row.fecha_orden instanceof Date ? row.fecha_orden.toISOString() : row.fecha_orden,
    conceptos: Array.isArray(row.conceptos) ? row.conceptos : JSON.parse(row.conceptos || '[]'),
    subtotalCliente: Number(row.subtotal_cliente) || 0,
    costoTotalCliente: Number(row.costo_total_cliente) || 0,
    costoProveedor: row.costo_proveedor !== null && row.costo_proveedor !== undefined ? Number(row.costo_proveedor) : null,
    utilidadEstimada: row.utilidad_estimada !== null && row.utilidad_estimada !== undefined ? Number(row.utilidad_estimada) : null,
    estado: row.estado as OrderStatus,
    numeroRecepcion: row.numero_recepcion || null,
    recepcionRegistradaPor: row.recepcion_registrada_por || null,
    numeroFacturacion: row.numero_facturacion || null,
    facturacionRegistradaPor: row.facturacion_registrada_por || null,
    facturacionPendiente: row.facturacion_pendiente || null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    assignedAt: row.assigned_at ? (row.assigned_at instanceof Date ? row.assigned_at.toISOString() : row.assigned_at) : null,
    startedAt: row.started_at ? (row.started_at instanceof Date ? row.started_at.toISOString() : row.started_at) : null,
    receptionRecordedAt: row.reception_recorded_at ? (row.reception_recorded_at instanceof Date ? row.reception_recorded_at.toISOString() : row.reception_recorded_at) : null,
    manifestUploadedAt: row.manifest_uploaded_at ? (row.manifest_uploaded_at instanceof Date ? row.manifest_uploaded_at.toISOString() : row.manifest_uploaded_at) : null,
    manifestReviewedAt: row.manifest_reviewed_at ? (row.manifest_reviewed_at instanceof Date ? row.manifest_reviewed_at.toISOString() : row.manifest_reviewed_at) : null,
    invoicedAt: row.invoiced_at ? (row.invoiced_at instanceof Date ? row.invoiced_at.toISOString() : row.invoiced_at) : null,
    finalizedAt: row.finalized_at ? (row.finalized_at instanceof Date ? row.finalized_at.toISOString() : row.finalized_at) : null,
    manifiestos: Array.isArray(row.manifiestos) ? row.manifiestos : JSON.parse(row.manifiestos || '[]'),
    manifiestoActual: row.manifiesto_actual ? (typeof row.manifiesto_actual === 'object' ? row.manifiesto_actual : JSON.parse(row.manifiesto_actual)) : null,
    historial: Array.isArray(row.historial) ? row.historial : JSON.parse(row.historial || '[]'),
  };
}

// --- PROVIDERS REPOSITORY ---
export async function dbGetProviders(): Promise<Provider[]> {
  const res = await pool.query('SELECT * FROM providers ORDER BY nombre ASC;');
  return res.rows.map(mapRowToProvider);
}

export async function dbGetProviderById(id: string): Promise<Provider | null> {
  const res = await pool.query('SELECT * FROM providers WHERE id = $1;', [id]);
  if (res.rows.length === 0) return null;
  return mapRowToProvider(res.rows[0]);
}

export async function dbCreateProvider(provider: Provider): Promise<Provider> {
  await pool.query(
    `INSERT INTO providers (id, nombre, rfc, activo, telefono, email, direccion, autorizacion_documento)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
    [
      provider.id,
      provider.nombre,
      provider.rfc,
      provider.activo,
      provider.telefono || '',
      provider.email || '',
      JSON.stringify(provider.direccion || null),
      JSON.stringify(provider.autorizacionDocumento || null),
    ]
  );
  return provider;
}

export async function dbUpdateProvider(id: string, updates: Partial<Provider>): Promise<Provider | null> {
  const existing = await dbGetProviderById(id);
  if (!existing) return null;

  const merged: Provider = {
    ...existing,
    ...updates,
    direccion: updates.direccion !== undefined ? updates.direccion : existing.direccion,
    autorizacionDocumento: updates.autorizacionDocumento !== undefined ? updates.autorizacionDocumento : existing.autorizacionDocumento,
  };

  await pool.query(
    `UPDATE providers
     SET nombre = $1, rfc = $2, activo = $3, telefono = $4, email = $5,
         direccion = $6, autorizacion_documento = $7, updated_at = NOW()
     WHERE id = $8;`,
    [
      merged.nombre,
      merged.rfc,
      merged.activo,
      merged.telefono || '',
      merged.email || '',
      JSON.stringify(merged.direccion || null),
      JSON.stringify(merged.autorizacionDocumento || null),
      id,
    ]
  );

  return merged;
}

export async function dbDeleteProvider(id: string): Promise<boolean> {
  const res = await pool.query('DELETE FROM providers WHERE id = $1;', [id]);
  return (res.rowCount ?? 0) > 0;
}

// --- CLIENTS REPOSITORY ---
export async function dbGetClients(): Promise<Client[]> {
  const res = await pool.query('SELECT * FROM clients ORDER BY nombre ASC;');
  return res.rows.map(mapRowToClient);
}

export async function dbGetClientById(id: string): Promise<Client | null> {
  const res = await pool.query('SELECT * FROM clients WHERE id = $1;', [id]);
  if (res.rows.length === 0) return null;
  return mapRowToClient(res.rows[0]);
}

// --- CATALOG CONCEPTS REPOSITORY ---
export async function dbGetCatalogConcepts(): Promise<CatalogConcept[]> {
  const res = await pool.query('SELECT * FROM catalog_concepts ORDER BY descripcion ASC;');
  return res.rows.map(mapRowToCatalogConcept);
}

export async function dbGetCatalogConceptById(id: string): Promise<CatalogConcept | null> {
  const res = await pool.query('SELECT * FROM catalog_concepts WHERE id = $1;', [id]);
  if (res.rows.length === 0) return null;
  return mapRowToCatalogConcept(res.rows[0]);
}

export async function dbCreateCatalogConcept(concept: CatalogConcept): Promise<CatalogConcept> {
  await pool.query(
    `INSERT INTO catalog_concepts (id, item, unidad, descripcion, precio_unitario)
     VALUES ($1, $2, $3, $4, $5);`,
    [concept.id, concept.item || '', concept.unidad, concept.descripcion, concept.precioUnitario]
  );
  return concept;
}

export async function dbUpdateCatalogConcept(id: string, updates: Partial<CatalogConcept>): Promise<CatalogConcept | null> {
  const existing = await dbGetCatalogConceptById(id);
  if (!existing) return null;

  const merged: CatalogConcept = {
    ...existing,
    ...updates,
  };

  await pool.query(
    `UPDATE catalog_concepts
     SET item = $1, unidad = $2, descripcion = $3, precio_unitario = $4, updated_at = NOW()
     WHERE id = $5;`,
    [merged.item || '', merged.unidad, merged.descripcion, merged.precioUnitario, id]
  );

  return merged;
}

export async function dbDeleteCatalogConcept(id: string): Promise<boolean> {
  const res = await pool.query('DELETE FROM catalog_concepts WHERE id = $1;', [id]);
  return (res.rowCount ?? 0) > 0;
}

// --- ORDERS REPOSITORY ---
export async function dbGetOrders(): Promise<Order[]> {
  const res = await pool.query('SELECT * FROM orders ORDER BY fecha_orden DESC, id DESC;');
  return res.rows.map(mapRowToOrder);
}

export async function dbGetOrderById(id: string): Promise<Order | null> {
  const res = await pool.query('SELECT * FROM orders WHERE id = $1;', [id]);
  if (res.rows.length === 0) return null;
  return mapRowToOrder(res.rows[0]);
}

export async function dbCreateOrder(order: Order): Promise<Order> {
  await pool.query(
    `INSERT INTO orders (
      id, numero_pedido, folio, cliente_id, cliente_nombre, proveedor_id, proveedor_nombre,
      fecha_orden, conceptos, subtotal_cliente, costo_total_cliente, costo_proveedor,
      utilidad_estimada, estado, numero_recepcion, recepcion_registrada_por,
      numero_facturacion, facturacion_registrada_por, facturacion_pendiente,
      created_at, assigned_at, started_at, reception_recorded_at,
      manifest_uploaded_at, manifest_reviewed_at, invoiced_at, finalized_at,
      manifiestos, manifiesto_actual, historial
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12,
      $13, $14, $15, $16,
      $17, $18, $19,
      $20, $21, $22, $23,
      $24, $25, $26, $27,
      $28, $29, $30
    );`,
    [
      order.id,
      order.numeroPedido || order.folio,
      order.folio,
      order.clienteId,
      order.clienteNombre,
      order.proveedorId || null,
      order.proveedorNombre || null,
      order.fechaOrden,
      JSON.stringify(order.conceptos || []),
      order.subtotalCliente,
      order.costoTotalCliente,
      order.costoProveedor ?? null,
      order.utilidadEstimada ?? null,
      order.estado,
      order.numeroRecepcion || null,
      order.recepcionRegistradaPor || null,
      order.numeroFacturacion || null,
      order.facturacionRegistradaPor || null,
      order.facturacionPendiente || null,
      order.createdAt,
      order.assignedAt || null,
      order.startedAt || null,
      order.receptionRecordedAt || null,
      order.manifestUploadedAt || null,
      order.manifestReviewedAt || null,
      order.invoicedAt || null,
      order.finalizedAt || null,
      JSON.stringify(order.manifiestos || []),
      JSON.stringify(order.manifiestoActual || null),
      JSON.stringify(order.historial || []),
    ]
  );
  return order;
}

export async function dbUpdateOrder(order: Order): Promise<Order> {
  await pool.query(
    `UPDATE orders
     SET
       numero_pedido = $2,
       folio = $3,
       cliente_id = $4,
       cliente_nombre = $5,
       proveedor_id = $6,
       proveedor_nombre = $7,
       fecha_orden = $8,
       conceptos = $9,
       subtotal_cliente = $10,
       costo_total_cliente = $11,
       costo_proveedor = $12,
       utilidad_estimada = $13,
       estado = $14,
       numero_recepcion = $15,
       recepcion_registrada_por = $16,
       numero_facturacion = $17,
       facturacion_registrada_por = $18,
       facturacion_pendiente = $19,
       assigned_at = $20,
       started_at = $21,
       reception_recorded_at = $22,
       manifest_uploaded_at = $23,
       manifest_reviewed_at = $24,
       invoiced_at = $25,
       finalized_at = $26,
       manifiestos = $27,
       manifiesto_actual = $28,
       historial = $29
     WHERE id = $1;`,
    [
      order.id,
      order.numeroPedido || order.folio,
      order.folio,
      order.clienteId,
      order.clienteNombre,
      order.proveedorId || null,
      order.proveedorNombre || null,
      order.fechaOrden,
      JSON.stringify(order.conceptos || []),
      order.subtotalCliente,
      order.costoTotalCliente,
      order.costoProveedor ?? null,
      order.utilidadEstimada ?? null,
      order.estado,
      order.numeroRecepcion || null,
      order.recepcionRegistradaPor || null,
      order.numeroFacturacion || null,
      order.facturacionRegistradaPor || null,
      order.facturacionPendiente || null,
      order.assignedAt || null,
      order.startedAt || null,
      order.receptionRecordedAt || null,
      order.manifestUploadedAt || null,
      order.manifestReviewedAt || null,
      order.invoicedAt || null,
      order.finalizedAt || null,
      JSON.stringify(order.manifiestos || []),
      JSON.stringify(order.manifiestoActual || null),
      JSON.stringify(order.historial || []),
    ]
  );
  return order;
}

export async function dbResetData(seed: {
  providers: Provider[];
  clients: Client[];
  catalogConcepts: CatalogConcept[];
  orders: Order[];
}): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    await client.query('DELETE FROM orders;');
    await client.query('DELETE FROM catalog_concepts;');
    await client.query('DELETE FROM clients;');
    await client.query('DELETE FROM providers;');

    for (const p of seed.providers) {
      await client.query(
        `INSERT INTO providers (id, nombre, rfc, activo, telefono, email, direccion, autorizacion_documento)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [p.id, p.nombre, p.rfc, p.activo, p.telefono || '', p.email || '', JSON.stringify(p.direccion || null), JSON.stringify(p.autorizacionDocumento || null)]
      );
    }

    for (const c of seed.clients) {
      await client.query(
        `INSERT INTO clients (id, nombre, rfc, email, telefono)
         VALUES ($1, $2, $3, $4, $5);`,
        [c.id, c.nombre, c.rfc, c.email || '', c.telefono || '']
      );
    }

    for (const cat of seed.catalogConcepts) {
      await client.query(
        `INSERT INTO catalog_concepts (id, item, unidad, descripcion, precio_unitario)
         VALUES ($1, $2, $3, $4, $5);`,
        [cat.id, cat.item || '', cat.unidad, cat.descripcion, cat.precioUnitario]
      );
    }

    for (const ord of seed.orders) {
      await client.query(
        `INSERT INTO orders (
          id, numero_pedido, folio, cliente_id, cliente_nombre, proveedor_id, proveedor_nombre,
          fecha_orden, conceptos, subtotal_cliente, costo_total_cliente, costo_proveedor,
          utilidad_estimada, estado, numero_recepcion, recepcion_registrada_por,
          numero_facturacion, facturacion_registrada_por, facturacion_pendiente,
          created_at, assigned_at, started_at, reception_recorded_at,
          manifest_uploaded_at, manifest_reviewed_at, invoiced_at, finalized_at,
          manifiestos, manifiesto_actual, historial
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19,
          $20, $21, $22, $23,
          $24, $25, $26, $27,
          $28, $29, $30
        );`,
        [
          ord.id,
          ord.numeroPedido || ord.folio,
          ord.folio,
          ord.clienteId,
          ord.clienteNombre,
          ord.proveedorId || null,
          ord.proveedorNombre || null,
          ord.fechaOrden,
          JSON.stringify(ord.conceptos || []),
          ord.subtotalCliente,
          ord.costoTotalCliente,
          ord.costoProveedor ?? null,
          ord.utilidadEstimada ?? null,
          ord.estado,
          ord.numeroRecepcion || null,
          ord.recepcionRegistradaPor || null,
          ord.numeroFacturacion || null,
          ord.facturacionRegistradaPor || null,
          ord.facturacionPendiente || null,
          ord.createdAt,
          ord.assignedAt || null,
          ord.startedAt || null,
          ord.receptionRecordedAt || null,
          ord.manifestUploadedAt || null,
          ord.manifestReviewedAt || null,
          ord.invoicedAt || null,
          ord.finalizedAt || null,
          JSON.stringify(ord.manifiestos || []),
          JSON.stringify(ord.manifiestoActual || null),
          JSON.stringify(ord.historial || []),
        ]
      );
    }

    await client.query('COMMIT;');
  } catch (e) {
    await client.query('ROLLBACK;');
    throw e;
  } finally {
    client.release();
  }
}
