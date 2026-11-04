import React from 'react';
import { Shield, Truck, Building2, CheckCircle2, RotateCcw, Clock } from 'lucide-react';
import type { Role } from '../types.ts';

interface NavbarProps {
  currentRole: Role;
  onChangeRole: (role: Role) => void;
  onOpenAcceptanceTests: () => void;
  onResetData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onChangeRole,
  onOpenAcceptanceTests,
  onResetData,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md border border-indigo-400/30">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base tracking-tight text-white">LogiTrack</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                  MVP Definitivo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5">
                Control Operativo de Órdenes, Utilidad & Manifiestos
              </p>
            </div>
          </div>

          {/* Role Navigation Pills */}
          <div className="hidden md:flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs font-bold">
            <button
              onClick={() => onChangeRole('ADMIN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                currentRole === 'ADMIN'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              Administrador
            </button>

            <button
              onClick={() => onChangeRole('PROVIDER')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                currentRole === 'PROVIDER'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Truck className="h-3.5 w-3.5" />
              Proveedor
            </button>

            <button
              onClick={() => onChangeRole('CLIENT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                currentRole === 'CLIENT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Cliente
            </button>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-2.5">
            {/* Timezone badge */}
            <div className="hidden lg:flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/50 px-2.5 py-1 rounded-lg border border-slate-700/50 font-mono">
              <Clock className="h-3 w-3 text-slate-400" />
              <span>America/Mexico_City</span>
            </div>

            {/* Test Suite button */}
            <button
              onClick={onOpenAcceptanceTests}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition shadow-xs"
              title="Ejecutar suite de 13 pruebas de aceptación"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Pruebas (13)</span>
            </button>

            {/* Reset Data button */}
            <button
              onClick={onResetData}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Reiniciar datos de prueba al benchmark inicial"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mobile role switcher */}
        <div className="flex md:hidden py-2 border-t border-slate-800 gap-1 text-xs">
          <button
            onClick={() => onChangeRole('ADMIN')}
            className={`flex-1 py-1 text-center font-bold rounded-lg ${
              currentRole === 'ADMIN' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Admin
          </button>
          <button
            onClick={() => onChangeRole('PROVIDER')}
            className={`flex-1 py-1 text-center font-bold rounded-lg ${
              currentRole === 'PROVIDER' ? 'bg-blue-600 text-white' : 'text-slate-400'
            }`}
          >
            Proveedor
          </button>
          <button
            onClick={() => onChangeRole('CLIENT')}
            className={`flex-1 py-1 text-center font-bold rounded-lg ${
              currentRole === 'CLIENT' ? 'bg-emerald-600 text-white' : 'text-slate-400'
            }`}
          >
            Cliente
          </button>
        </div>
      </div>
    </header>
  );
};
