/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Order, Provider, Client, Role, CatalogConcept } from './types.ts';
import { Navbar } from './components/Navbar.tsx';
import { AdminPortal } from './components/AdminPortal.tsx';
import { ProviderPortal } from './components/ProviderPortal.tsx';
import { ClientPortal } from './components/ClientPortal.tsx';
import { OrderDetailModal } from './components/OrderDetailModal.tsx';
import { NewOrderModal } from './components/NewOrderModal.tsx';
import { AcceptanceTestsModal } from './components/AcceptanceTestsModal.tsx';
import { ProviderCrudModal } from './components/ProviderCrudModal.tsx';
import { ConceptCatalogModal } from './components/ConceptCatalogModal.tsx';

export default function App() {
  const [currentRole, setCurrentRole] = useState<Role>('ADMIN');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [catalogConcepts, setCatalogConcepts] = useState<CatalogConcept[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string>('prov-1');
  const [activeClientId, setActiveClientId] = useState<string>('client-1');

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState<boolean>(false);
  const [isAcceptanceTestsOpen, setIsAcceptanceTestsOpen] = useState<boolean>(false);
  const [isProviderCrudOpen, setIsProviderCrudOpen] = useState<boolean>(false);
  const [isConceptCatalogOpen, setIsConceptCatalogOpen] = useState<boolean>(false);

  // Load config (providers, clients, catalog concepts)
  const loadConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
        setClients(data.clients || []);
        setCatalogConcepts(data.catalogConcepts || []);
        if (data.providers?.length > 0 && !activeProviderId) {
          setActiveProviderId(data.providers[0].id);
        }
        if (data.clients?.length > 0 && !activeClientId) {
          setActiveClientId(data.clients[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading config:', err);
    }
  };

  // Load orders sanitized for current role
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const entityId =
        currentRole === 'PROVIDER' ? activeProviderId : currentRole === 'CLIENT' ? activeClientId : '';
      const query = new URLSearchParams({
        role: currentRole,
        ...(entityId ? { entityId } : {}),
      });

      const res = await fetch(`/api/orders?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);

        // Keep selectedOrder in sync if currently open
        if (selectedOrder) {
          const updatedSelected = data.find((o: Order) => o.id === selectedOrder.id);
          if (updatedSelected) {
            setSelectedOrder(updatedSelected);
          }
        }
      }
    } catch (err) {
      console.error('Error loading orders:', err);
    } finally {
      setLoading(false);
    }
  }, [currentRole, activeProviderId, activeClientId, selectedOrder?.id]);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [currentRole, activeProviderId, activeClientId]);

  const handleResetData = async () => {
    if (window.confirm('¿Desea reiniciar todos los datos a los valores de prueba originales?')) {
      try {
        const res = await fetch('/api/reset-data', { method: 'POST' });
        if (res.ok) {
          await loadConfig();
          await loadOrders();
        }
      } catch (err) {
        console.error('Error resetting data:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">
      {/* Top Navbar with Role Switching */}
      <Navbar
        currentRole={currentRole}
        onChangeRole={(role) => {
          setCurrentRole(role);
          setSelectedOrder(null);
        }}
        onOpenAcceptanceTests={() => setIsAcceptanceTestsOpen(true)}
        onResetData={handleResetData}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading && orders.length === 0 ? (
          <div className="py-24 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent mb-3" />
            <p className="text-sm font-semibold text-slate-600">Cargando datos del sistema...</p>
          </div>
        ) : (
          <>
            {currentRole === 'ADMIN' && (
              <AdminPortal
                orders={orders}
                providers={providers}
                clients={clients}
                onOpenNewOrder={() => setIsNewOrderOpen(true)}
                onSelectOrder={(order) => setSelectedOrder(order)}
                onOpenAcceptanceTests={() => setIsAcceptanceTestsOpen(true)}
                onOpenProviderCrud={() => setIsProviderCrudOpen(true)}
                onOpenConceptCatalog={() => setIsConceptCatalogOpen(true)}
              />
            )}

            {currentRole === 'PROVIDER' && (
              <ProviderPortal
                orders={orders}
                providers={providers}
                activeProviderId={activeProviderId}
                onSelectProvider={(id) => setActiveProviderId(id)}
                onOrderUpdated={loadOrders}
                onSelectOrder={(order) => setSelectedOrder(order)}
              />
            )}

            {currentRole === 'CLIENT' && (
              <ClientPortal
                orders={orders}
                clients={clients}
                activeClientId={activeClientId}
                onSelectClient={(id) => setActiveClientId(id)}
                onSelectOrder={(order) => setSelectedOrder(order)}
              />
            )}
          </>
        )}
      </main>

      {/* Order Detail & Actions Modal */}
      <OrderDetailModal
        order={selectedOrder}
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        currentUserRole={currentRole}
        providers={providers}
        clients={clients}
        onOrderUpdated={loadOrders}
      />

      {/* New Order Creation Modal */}
      <NewOrderModal
        isOpen={isNewOrderOpen}
        onClose={() => setIsNewOrderOpen(false)}
        clients={clients}
        providers={providers}
        catalogConcepts={catalogConcepts}
        onOpenCatalogManager={() => setIsConceptCatalogOpen(true)}
        onOrderCreated={loadOrders}
      />

      {/* Provider CRUD Management Modal */}
      <ProviderCrudModal
        isOpen={isProviderCrudOpen}
        onClose={() => setIsProviderCrudOpen(false)}
        providers={providers}
        onProvidersChanged={async () => {
          await loadConfig();
          await loadOrders();
        }}
      />

      {/* Concept Catalog CRUD Modal */}
      <ConceptCatalogModal
        isOpen={isConceptCatalogOpen}
        onClose={() => setIsConceptCatalogOpen(false)}
        concepts={catalogConcepts}
        onConceptsChanged={async () => {
          await loadConfig();
        }}
      />

      {/* Acceptance Tests Modal */}
      <AcceptanceTestsModal
        isOpen={isAcceptanceTestsOpen}
        onClose={() => setIsAcceptanceTestsOpen(false)}
        onRefreshData={loadOrders}
      />
    </div>
  );
}
