/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import type {
  Order,
  Provider,
  Client,
  Role,
  CatalogConcept,
  DatabaseStatus,
  ServiceLocation,
  AppUser,
} from './types.ts';
import { apiFetch, getAuthToken, setAuthToken, setOnUnauthorized } from './utils/api.ts';
import { LoginScreen } from './components/LoginScreen.tsx';
import { Navbar } from './components/Navbar.tsx';
import { AdminPortal } from './components/AdminPortal.tsx';
import { ProviderPortal } from './components/ProviderPortal.tsx';
import { ClientPortal } from './components/ClientPortal.tsx';
import { OrderDetailModal } from './components/OrderDetailModal.tsx';
import { NewOrderModal } from './components/NewOrderModal.tsx';
import { AcceptanceTestsModal } from './components/AcceptanceTestsModal.tsx';
import { ProviderCrudModal } from './components/ProviderCrudModal.tsx';
import { ConceptCatalogModal } from './components/ConceptCatalogModal.tsx';
import { ServiceLocationModal } from './components/ServiceLocationModal.tsx';
import { UsersModal } from './components/UsersModal.tsx';
import { ReportsModal } from './components/ReportsModal.tsx';

export default function App() {
  const [loggedInUser, setLoggedInUser] = useState<AppUser | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [currentRole, setCurrentRole] = useState<Role>('ADMIN');

  const [providers, setProviders] = useState<Provider[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [catalogConcepts, setCatalogConcepts] = useState<CatalogConcept[]>([]);
  const [serviceLocations, setServiceLocations] = useState<ServiceLocation[]>([]);
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [activeProviderId, setActiveProviderId] = useState<string>('prov-1');
  const [activeClientId, setActiveClientId] = useState<string>('client-1');

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState<boolean>(false);
  const [isAcceptanceTestsOpen, setIsAcceptanceTestsOpen] = useState<boolean>(false);
  const [isProviderCrudOpen, setIsProviderCrudOpen] = useState<boolean>(false);
  const [isConceptCatalogOpen, setIsConceptCatalogOpen] = useState<boolean>(false);
  const [isServiceLocationsOpen, setIsServiceLocationsOpen] = useState<boolean>(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState<boolean>(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState<boolean>(false);

  const resetSessionState = useCallback(() => {
    setAuthToken(null);
    setLoggedInUser(null);
    setOrders([]);
    setSelectedOrder(null);
    setIsNewOrderOpen(false);
    setIsAcceptanceTestsOpen(false);
    setIsProviderCrudOpen(false);
    setIsConceptCatalogOpen(false);
    setIsServiceLocationsOpen(false);
    setIsUsersModalOpen(false);
    setIsReportsModalOpen(false);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      resetSessionState();
    });
    return () => setOnUnauthorized(null);
  }, [resetSessionState]);

  const applyAuthenticatedUser = useCallback((user: AppUser) => {
    setLoggedInUser(user);
    setCurrentRole(user.role);
    if (user.role === 'PROVIDER' && user.entityId) {
      setActiveProviderId(user.entityId);
    }
    if (user.role === 'CLIENT' && user.entityId) {
      setActiveClientId(user.entityId);
    }
  }, []);

  // Check existing token on mount
  useEffect(() => {
    const verifyToken = async () => {
      const token = getAuthToken();
      if (!token) {
        setAuthChecking(false);
        return;
      }
      try {
        const res = await apiFetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            applyAuthenticatedUser(data.user);
          } else {
            resetSessionState();
          }
        } else {
          resetSessionState();
        }
      } catch {
        resetSessionState();
      } finally {
        setAuthChecking(false);
      }
    };
    verifyToken();
  }, [applyAuthenticatedUser, resetSessionState]);

  // Load config (providers, clients, catalog concepts, service locations, db status)
  const loadConfig = useCallback(async () => {
    if (!loggedInUser) return;
    try {
      const res = await apiFetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
        setClients(data.clients || []);
        setCatalogConcepts(data.catalogConcepts || []);
        setServiceLocations(data.serviceLocations || []);
        setDbStatus(data.database || null);

        if (loggedInUser.role === 'ADMIN') {
          if (data.providers?.length > 0 && !activeProviderId) {
            setActiveProviderId(data.providers[0].id);
          }
          if (data.clients?.length > 0 && !activeClientId) {
            setActiveClientId(data.clients[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Error loading config:', err);
    }
  }, [loggedInUser, activeProviderId, activeClientId]);

  // Load orders sanitized for current role
  const loadOrders = useCallback(async () => {
    if (!loggedInUser) return;
    setLoading(true);
    try {
      const effectiveRole = loggedInUser.role === 'ADMIN' ? currentRole : loggedInUser.role;
      const entityId =
        effectiveRole === 'PROVIDER'
          ? loggedInUser.role === 'PROVIDER'
            ? loggedInUser.entityId || activeProviderId
            : activeProviderId
          : effectiveRole === 'CLIENT'
          ? loggedInUser.role === 'CLIENT'
            ? loggedInUser.entityId || activeClientId
            : activeClientId
          : '';

      const query = new URLSearchParams({
        role: effectiveRole,
        ...(entityId ? { entityId } : {}),
      });

      const res = await apiFetch(`/api/orders?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);

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
  }, [loggedInUser, currentRole, activeProviderId, activeClientId, selectedOrder?.id]);

  useEffect(() => {
    if (loggedInUser) {
      loadConfig();
    }
  }, [loggedInUser]);

  useEffect(() => {
    if (loggedInUser) {
      loadOrders();
    }
  }, [loggedInUser, currentRole, activeProviderId, activeClientId]);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      resetSessionState();
    }
  };

  const handleResetData = async () => {
    if (loggedInUser?.role !== 'ADMIN') return;
    if (window.confirm('¿Desea reiniciar todos los datos a los valores de prueba originales?')) {
      try {
        const res = await apiFetch('/api/reset-data', { method: 'POST' });
        if (res.ok) {
          await loadConfig();
          await loadOrders();
        }
      } catch (err) {
        console.error('Error resetting data:', err);
      }
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent mb-3" />
          <p className="text-sm font-semibold text-slate-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!loggedInUser) {
    return <LoginScreen onLoginSuccess={applyAuthenticatedUser} />;
  }

  const isAdmin = loggedInUser.role === 'ADMIN';
  const effectiveRole: Role = isAdmin ? currentRole : loggedInUser.role;
  const isUserRole = loggedInUser.role === 'USER';
  const canUseAdminPortal = effectiveRole === 'ADMIN' || effectiveRole === 'USER';

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        loggedInUser={loggedInUser}
        currentRole={effectiveRole}
        onChangeRole={(role) => {
          if (!isAdmin) return;
          setCurrentRole(role);
          setSelectedOrder(null);
        }}
        onOpenAcceptanceTests={() => isAdmin && setIsAcceptanceTestsOpen(true)}
        onResetData={handleResetData}
        onLogout={handleLogout}
        dbStatus={isAdmin ? dbStatus : null}
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
            {canUseAdminPortal && (
              <AdminPortal
                loggedInRole={loggedInUser.role}
                orders={orders}
                providers={providers}
                clients={clients}
                serviceLocations={serviceLocations}
                onOpenNewOrder={() => setIsNewOrderOpen(true)}
                onSelectOrder={(order) => setSelectedOrder(order)}
                onOpenAcceptanceTests={() => isAdmin && setIsAcceptanceTestsOpen(true)}
                onOpenProviderCrud={() => setIsProviderCrudOpen(true)}
                onOpenConceptCatalog={() => setIsConceptCatalogOpen(true)}
                onOpenServiceLocations={() => setIsServiceLocationsOpen(true)}
                onOpenReports={() => setIsReportsModalOpen(true)}
                onOpenUsers={() => isAdmin && setIsUsersModalOpen(true)}
              />
            )}

            {effectiveRole === 'PROVIDER' && (
              <ProviderPortal
                orders={orders}
                providers={providers}
                activeProviderId={activeProviderId}
                onSelectProvider={(id) => isAdmin && setActiveProviderId(id)}
                onOrderUpdated={loadOrders}
                onSelectOrder={(order) => setSelectedOrder(order)}
                isAdminPreview={isAdmin}
              />
            )}

            {effectiveRole === 'CLIENT' && (
              <ClientPortal
                orders={orders}
                clients={clients}
                providers={providers}
                activeClientId={activeClientId}
                onSelectClient={(id) => isAdmin && setActiveClientId(id)}
                onSelectOrder={(order) => setSelectedOrder(order)}
                isAdminPreview={isAdmin}
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
        currentUserRole={effectiveRole}
        providers={providers}
        clients={clients}
        onOrderUpdated={loadOrders}
      />

      {/* New Order Creation Modal (Admin or User) */}
      {(isAdmin || isUserRole) && (
        <NewOrderModal
          isOpen={isNewOrderOpen}
          onClose={() => setIsNewOrderOpen(false)}
          clients={clients}
          providers={providers}
          serviceLocations={serviceLocations}
          catalogConcepts={catalogConcepts}
          onOpenCatalogManager={() => setIsConceptCatalogOpen(true)}
          onOrderCreated={loadOrders}
        />
      )}

      {/* Provider CRUD Management Modal (Admin or User) */}
      {(isAdmin || isUserRole) && (
        <ProviderCrudModal
          isOpen={isProviderCrudOpen}
          onClose={() => setIsProviderCrudOpen(false)}
          providers={providers}
          onProvidersChanged={async () => {
            await loadConfig();
            await loadOrders();
          }}
        />
      )}

      {/* Service Locations CRUD Modal (Admin or User) */}
      {(isAdmin || isUserRole) && (
        <ServiceLocationModal
          isOpen={isServiceLocationsOpen}
          onClose={() => setIsServiceLocationsOpen(false)}
          serviceLocations={serviceLocations}
          onLocationsChanged={async () => {
            await loadConfig();
          }}
        />
      )}

      {/* Concept Catalog CRUD Modal (Admin or User) */}
      {(isAdmin || isUserRole) && (
        <ConceptCatalogModal
          isOpen={isConceptCatalogOpen}
          onClose={() => setIsConceptCatalogOpen(false)}
          concepts={catalogConcepts}
          onConceptsChanged={async () => {
            await loadConfig();
          }}
        />
      )}

      {/* Reports Modal (Admin or User) */}
      {(isAdmin || isUserRole) && (
        <ReportsModal
          isOpen={isReportsModalOpen}
          onClose={() => setIsReportsModalOpen(false)}
          orders={orders}
          providers={providers}
          clients={clients}
          serviceLocations={serviceLocations}
          userRole={loggedInUser.role}
        />
      )}

      {/* Users CRUD Modal (Admin Only) */}
      {isAdmin && (
        <UsersModal
          isOpen={isUsersModalOpen}
          onClose={() => setIsUsersModalOpen(false)}
          currentUserId={loggedInUser.id}
          providers={providers}
          clients={clients}
        />
      )}

      {/* Acceptance Tests Modal (Admin Only) */}
      {isAdmin && (
        <AcceptanceTestsModal
          isOpen={isAcceptanceTestsOpen}
          onClose={() => setIsAcceptanceTestsOpen(false)}
          onRefreshData={loadOrders}
        />
      )}
    </div>
  );
}
