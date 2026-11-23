import React, { useState } from 'react';
import {
  Truck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Shield,
  ClipboardList,
  Building2,
  ArrowRight,
} from 'lucide-react';
import type { AppUser } from '../types.ts';
import { setAuthToken } from '../utils/api.ts';

interface LoginScreenProps {
  onLoginSuccess: (user: AppUser) => void;
}

interface QuickAccount {
  label: string;
  roleDesc: string;
  email: string;
  password: string;
  icon: React.ReactNode;
  accent: string;
}

const DEMO_ACCOUNTS: QuickAccount[] = [
  {
    label: 'Administrador',
    roleDesc: 'Acceso total, costos, utilidad y subsistemas',
    email: 'admin@logitrack.com',
    password: 'Admin2026!',
    icon: <Shield className="h-4 w-4 text-indigo-600" />,
    accent: 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50',
  },
  {
    label: 'Usuario',
    roleDesc: 'Operación completa y reportes (sin KPIs globales)',
    email: 'usuario@logitrack.com',
    password: 'User2026!',
    icon: <ClipboardList className="h-4 w-4 text-sky-600" />,
    accent: 'border-sky-200 hover:border-sky-400 hover:bg-sky-50/50',
  },
  {
    label: 'Proveedor',
    roleDesc: 'Transportes Ecológicos del Centro',
    email: 'contacto@tecolgicos.mx',
    password: 'Prov2026!',
    icon: <Truck className="h-4 w-4 text-blue-600" />,
    accent: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50/50',
  },
  {
    label: 'Cliente',
    roleDesc: 'Bimbo México SA de CV',
    email: 'logistica@bimbo.com',
    password: 'Client2026!',
    icon: <Building2 className="h-4 w-4 text-emerald-600" />,
    accent: 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50',
  },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No fue posible iniciar sesión');
      }
      setAuthToken(data.token);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Error de conexión al servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Ingrese su correo electrónico y contraseña.');
      return;
    }
    performLogin(email, password);
  };

  const handleQuickFill = (acc: QuickAccount) => {
    setEmail(acc.email);
    setPassword(acc.password);
    performLogin(acc.email, acc.password);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Left Panel: Brand & Credentials Showcase */}
        <div className="lg:col-span-5 bg-slate-900 text-white p-7 sm:p-8 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md border border-indigo-400/30">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-black text-lg tracking-tight text-white">LogiTrack</h1>
                <p className="text-[11px] text-slate-400">
                  Control Operativo de Órdenes y Servicios
                </p>
              </div>
            </div>

            <div className="mt-7 space-y-2">
              <h2 className="text-sm font-bold text-slate-100">
                Acceso por Perfil Operativo
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cada cuenta inicia sesión directamente en su portal autorizado con aislamiento estricto de datos e información financiera.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Cuentas de Acceso Rápido
            </div>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickFill(acc)}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-400/60 transition flex items-center justify-between gap-2 group disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-white/95 shrink-0">
                      {acc.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{acc.label}</span>
                        <span className="font-mono text-[10px] font-normal text-slate-400 truncate">
                          {acc.email}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {acc.roleDesc}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-300 shrink-0 transition" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Login Form */}
        <div className="lg:col-span-7 p-7 sm:p-10 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Iniciar Sesión
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Ingrese sus credenciales registradas para acceder a LogiTrack.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="usuario@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 pl-10 pr-3.5 py-2.5 bg-slate-50/50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 pl-10 pr-10 py-2.5 bg-slate-50/50 focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                    Verificando credenciales...
                  </>
                ) : (
                  <>
                    Entrar al Sistema
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
              <div className="font-semibold text-slate-700">Resumen de permisos por perfil:</div>
              <ul className="space-y-0.5 text-[11px]">
                <li>&bull; <strong>Administrador:</strong> Control total, métricas financieras, usuarios y pruebas.</li>
                <li>&bull; <strong>Usuario:</strong> Gestión operativa, órdenes, reportes y costos por orden (sin totales globales ni pruebas).</li>
                <li>&bull; <strong>Proveedor / Cliente:</strong> Acceso exclusivo a las órdenes asignadas a su empresa.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
