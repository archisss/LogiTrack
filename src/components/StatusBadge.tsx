import React from 'react';
import type { OrderStatus, ManifestStatus, SlaColor } from '../types.ts';

interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-semibold',
    lg: 'px-3 py-1.5 text-sm font-bold',
  }[size];

  const styles: Record<OrderStatus, { bg: string; text: string; border: string; dot: string }> = {
    CREADO: {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-300',
      dot: 'bg-slate-400',
    },
    ASIGNANDO: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-300',
      dot: 'bg-blue-500',
    },
    EN_PROCESO: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-300',
      dot: 'bg-indigo-500 animate-pulse',
    },
    COMPLETO: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-300',
      dot: 'bg-amber-500',
    },
    FACTURADO: {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-300',
      dot: 'bg-purple-500',
    },
    FINALIZADO: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-300',
      dot: 'bg-emerald-600',
    },
  };

  const style = styles[status] || styles.CREADO;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeClasses}`}>
      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
};

interface ManifestBadgeProps {
  status: ManifestStatus | null | undefined;
  version?: number;
}

export const ManifestBadge: React.FC<ManifestBadgeProps> = ({ status, version }) => {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
        Sin manifiesto
      </span>
    );
  }

  const styles: Record<ManifestStatus, { bg: string; text: string; label: string; border: string }> = {
    PENDING: {
      bg: 'bg-yellow-50',
      text: 'text-yellow-800',
      border: 'border-yellow-300',
      label: 'PENDIENTE DE REVISIÓN',
    },
    APPROVED: {
      bg: 'bg-green-50',
      text: 'text-green-800',
      border: 'border-green-300',
      label: 'APROBADO',
    },
    REJECTED: {
      bg: 'bg-red-50',
      text: 'text-red-800',
      border: 'border-red-300',
      label: 'RECHAZADO',
    },
  };

  const current = styles[status];

  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${current.bg} ${current.text} ${current.border}`}>
      {version !== undefined && <span className="font-semibold opacity-75">v{version}:</span>}
      {current.label}
    </span>
  );
};

interface SlaBadgeProps {
  days: number;
  color: SlaColor;
  label: string;
  isFinalized?: boolean;
}

export const SlaBadge: React.FC<SlaBadgeProps> = ({ days, color, label, isFinalized }) => {
  const colorMap: Record<SlaColor, { bg: string; text: string; border: string; circle: string }> = {
    gray: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', circle: 'bg-slate-400' },
    green: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300', circle: 'bg-emerald-500' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-300', circle: 'bg-yellow-500' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-300', circle: 'bg-orange-500' },
    red: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-300', circle: 'bg-red-600 animate-pulse' },
  };

  const style = colorMap[color];

  return (
    <div className="flex flex-col">
      <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text} ${style.border}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${style.circle}`} />
        <span>{days === 1 ? '1 día' : `${days} días`}</span>
      </div>
      {isFinalized && (
        <span className="text-[10px] text-slate-500 text-center font-medium mt-0.5">
          (Finalizada - Tiempo congelado)
        </span>
      )}
    </div>
  );
};
