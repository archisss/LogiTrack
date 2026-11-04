import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Play, RefreshCw, AlertTriangle, ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react';
import type { AcceptanceSuiteResult, TestCaseResult } from '../domain/acceptanceTests.ts';

interface AcceptanceTestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

export const AcceptanceTestsModal: React.FC<AcceptanceTestsModalProps> = ({
  isOpen,
  onClose,
  onRefreshData,
}) => {
  const [suiteResult, setSuiteResult] = useState<AcceptanceSuiteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const runTests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/acceptance-tests');
      if (res.ok) {
        const data = await res.json();
        setSuiteResult(data);
      }
    } catch (err) {
      console.error('Error running tests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !suiteResult) {
      runTests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/30 rounded-lg border border-indigo-500/40 text-indigo-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Suite Oficial de Pruebas de Aceptación (Sección 8)
              </h2>
              <p className="text-xs text-slate-400">
                Validación estricta de las 13 reglas definitivas de negocio del MVP
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runTests}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Ejecutando...' : 'Re-ejecutar Pruebas'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Score Banner */}
        {suiteResult && (
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900">{suiteResult.passed}</span>
                <span className="text-sm font-semibold text-slate-500">/ {suiteResult.total} pruebas superadas</span>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  suiteResult.failed === 0
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-red-100 text-red-800 border border-red-300'
                }`}
              >
                {suiteResult.failed === 0 ? '✓ 100% CUMPLIMIENTO REGLAMENTARIO' : `⚠ ${suiteResult.failed} FALLOS`}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              Última ejecución: {new Date(suiteResult.timestamp).toLocaleTimeString('es-MX', { hour12: false })}
            </div>
          </div>
        )}

        {/* Test List */}
        <div className="p-6 overflow-y-auto flex-1 divide-y divide-slate-100 space-y-2">
          {loading && !suiteResult ? (
            <div className="py-16 text-center">
              <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-600 font-medium">Ejecutando suite de pruebas de aceptación...</p>
            </div>
          ) : (
            suiteResult?.results.map((test) => {
              const isExpanded = expandedId === test.id;
              return (
                <div
                  key={test.id}
                  className={`rounded-xl border transition-all ${
                    test.passed
                      ? 'border-slate-200 bg-white hover:border-emerald-300'
                      : 'border-red-300 bg-red-50/40'
                  }`}
                >
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : test.id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      {test.passed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            #{test.id}
                          </span>
                          <span className="text-sm font-bold text-slate-800">{test.title}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{test.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          test.passed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-100 text-red-700 border border-red-200'
                        }`}
                      >
                        {test.passed ? 'PASÓ' : 'FALLÓ'}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50/50 rounded-b-xl text-xs space-y-2">
                      {test.error && (
                        <div className="p-2.5 bg-red-100/70 border border-red-200 text-red-800 rounded-lg">
                          <strong>Error:</strong> {test.error}
                        </div>
                      )}
                      {test.details && (
                        <div>
                          <span className="font-semibold text-slate-700">Detalles de verificación del motor:</span>
                          <pre className="mt-1 p-2 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-[11px] font-mono">
                            {JSON.stringify(test.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>Las pruebas validan transiciones atómicas, Decimal.js, semáforo SLA en America/Mexico_City y privacidad RBAC.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
