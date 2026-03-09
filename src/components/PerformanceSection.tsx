import { useState, useRef } from 'react';
import { PerformanceData, PerfServiceData, PerfServiceCriteria, PerfLoadResult, PerfStressStep, Atencion } from '@/types/qa';
import { detectChecklistOutcome } from '@/lib/parseChecklistLevel';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Upload, FileText, CheckCircle2, XCircle,
  AlertTriangle, Users, Clock, Activity, ChevronDown, ChevronUp, Paperclip, X, Download,
} from 'lucide-react';

interface Props {
  data: PerformanceData | undefined;
  onChange: (data: PerformanceData) => void;
  atencion?: Atencion;
}

export function PerformanceSection({ data, onChange, atencion }: Props) {
  const { user } = useAuth();
  const d = data ?? {};
  const [parsingChecklist, setParsingChecklist] = useState(false);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [expandedCriteria, setExpandedCriteria] = useState(true);
  const [expandedLoad, setExpandedLoad] = useState(true);
  const [expandedStress, setExpandedStress] = useState(true);
  const checklistRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const sessionEvidenceRef = useRef<HTMLInputElement>(null);
  const additionalEvidenceRef = useRef<HTMLInputElement>(null);

  const update = (partial: Partial<PerformanceData>) => onChange({ ...d, ...partial });
  const applies = d.appliesPerformanceTests;

  const uploadFile = async (file: File, prefix: string): Promise<string | null> => {
    if (!user) return null;
    const path = `${user.id}/${prefix}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('performance-evidence').upload(path, file);
    if (error) { toast.error('Error al subir archivo'); console.error(error); return null; }
    return path;
  };

  const downloadFile = async (storagePath: string, fileName: string) => {
    const { data: blob, error } = await supabase.storage.from('performance-evidence').download(storagePath);
    if (error || !blob) { toast.error('Error al descargar'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const deleteFile = async (storagePath: string) => {
    await supabase.storage.from('performance-evidence').remove([storagePath]);
  };

  const cellText = (cell: any): string => {
    const toText = (val: any): string => {
      if (val == null) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'number' || typeof val === 'boolean') return String(val);
      if (val instanceof Date) return val.toISOString();
      if (Array.isArray(val)) return val.map(toText).join(' ');
      if (typeof val === 'object') {
        if (typeof val.text === 'string') return val.text;
        if (Array.isArray(val.richText)) return val.richText.map((r: any) => String(r?.text ?? '')).join('');
        if (val.result != null) return toText(val.result);
      }
      return String(val);
    };
    const fromCellText = toText(cell?.text);
    if (fromCellText) return fromCellText.trim();
    return toText(cell?.value ?? cell).trim();
  };

  /* ── Checklist Excel import ── */
  const handleChecklistImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsingChecklist(true);
    try {
      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      if (wb.worksheets.length === 0) throw new Error('No worksheet found');
      const { result, level } = detectChecklistOutcome(wb, cellText);
      const storagePath = await uploadFile(file, 'checklist');
      if (result) {
        update({ checklistResult: result, checklistLevel: undefined, checklistFileName: file.name, checklistStoragePath: storagePath ?? undefined });
        toast.success(`Checklist importado: ${result}`);
      } else if (level) {
        update({ checklistLevel: level, checklistResult: undefined, checklistFileName: file.name, checklistStoragePath: storagePath ?? undefined });
        toast.success(`Checklist nivel detectado: ${level.charAt(0).toUpperCase() + level.slice(1)}`);
      } else {
        update({ checklistLevel: undefined, checklistResult: undefined, checklistFileName: file.name, checklistStoragePath: storagePath ?? undefined });
        toast.warning('No se encontró un resultado claro en el checklist.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al parsear el checklist Excel');
    } finally {
      setParsingChecklist(false);
      if (checklistRef.current) checklistRef.current.value = '';
    }
  };

  /* ── PDF import ── */
  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsingPdf(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), ''));

      const { data: fnData, error } = await supabase.functions.invoke('parse-performance-pdf', {
        body: { pdfBase64: base64 },
      });

      if (error) throw error;

      console.log('[PDF RAW]', JSON.stringify(fnData));

      // Filter: only keep async services
      const allServices: PerfServiceData[] = (fnData?.services ?? []).map((svc: any) => {
        const criteria: PerfServiceCriteria = svc.criteria ?? {};
        const loadResult: PerfLoadResult | undefined = svc.loadResult ?? undefined;
        const stressSteps: PerfStressStep[] = svc.stressSteps ?? [];
        return {
          criteria,
          loadResult,
          loadAnalysis: svc.loadAnalysis ?? '',
          loadComments: svc.loadComments ?? '',
          stressSteps,
          stressSummary: svc.stressSummary ?? undefined,
          stressAnalysis: svc.stressAnalysis ?? '',
          stressComments: svc.stressComments ?? '',
        };
      });

      // Only keep Asíncrono processes
      const services = allServices.filter(svc => {
        const proc = (svc.criteria.process ?? '').toLowerCase();
        return proc.includes('asíncron') || proc.includes('asincron') || proc.includes('async');
      });

      // If none matched async filter, keep all (fallback)
      const finalServices = services.length > 0 ? services : allServices;

      const storagePath = await uploadFile(file, 'pdf-informe');
      update({ services: finalServices, pdfFileName: file.name, pdfStoragePath: storagePath ?? undefined });
      toast.success(`${finalServices.length} servicio(s) extraído(s) del informe`);
    } catch (err) {
      console.error(err);
      toast.error('Error al procesar el PDF');
    } finally {
      setParsingPdf(false);
      if (pdfRef.current) pdfRef.current.value = '';
    }
  };

  /* ── Service data updater ── */
  const updateService = (idx: number, partial: Partial<PerfServiceData>) => {
    const services = [...(d.services ?? [])];
    services[idx] = { ...services[idx], ...partial };
    update({ services });
  };

  /* ── Compute UVC Esperado ── */
  const computeUvc = (criteria: PerfServiceCriteria): number | undefined => {
    if (criteria.trxHrPrdPico && criteria.responseTimeMaxMin) {
      return Math.round((criteria.trxHrPrdPico * criteria.responseTimeMaxMin / 60) * 100) / 100;
    }
    return undefined;
  };

  /* ── Render helpers ── */
  const renderFileAttachment = (fileName: string | undefined, storagePath: string | undefined, onDelete: () => void) => {
    if (!fileName) return null;
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 border border-border rounded-md min-w-0 overflow-hidden">
        <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="text-[10px] text-foreground truncate">{fileName}</span>
        <button onClick={() => storagePath ? downloadFile(storagePath, fileName) : toast.info('Reemplace para habilitar descarga')}
          className="text-primary hover:text-primary/80 transition-colors shrink-0" title="Descargar">
          <Download className="w-3 h-3" />
        </button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  };

  const cellClass = "py-1.5 px-2 text-[10px] text-foreground border-b border-border/30";
  const headerCellClass = "py-1.5 px-2 text-[8px] uppercase text-muted-foreground font-medium border-b border-border whitespace-nowrap";

  const formatResponseMetric = (minutesValue: unknown, secRaw?: unknown): string => {
    const rawText = String(secRaw ?? '').trim();
    // Preferimos el valor RAW en segundos (texto exacto del informe) para evitar pérdidas (p.ej. 7.40→7.38)
    if (rawText && rawText !== 'N/D' && rawText !== '—') {
      const cleaned = rawText.replace(',', '.');
      return `${cleaned} seg`;
    }

    if (minutesValue == null || minutesValue === '') return '—';
    const n = typeof minutesValue === 'number' ? minutesValue : Number(String(minutesValue).replace(',', '.'));
    if (!Number.isFinite(n)) return String(minutesValue);

    // Guardamos en MINUTOS, pero el informe suele mostrarse en SEGUNDOS.
    // Si es < 1 minuto, mostramos en segundos con alta precisión.
    if (Math.abs(n) < 1) {
      const sec = n * 60;
      return `${sec.toFixed(5).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')} seg`;
    }

    return `${n.toFixed(3).replace(/\.000$/, '').replace(/(\.\d*[1-9])0+$/, '$1')} min`;
  };

  /* ── Criteria as compact table (read-only) ── */
  const renderCriteriaTable = (svc: PerfServiceData) => {
    const c = svc.criteria;
    const uvc = computeUvc(c);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr>
              <th className={headerCellClass}>Proceso</th>
              <th className={headerCellClass}>Path</th>
              <th className={headerCellClass}>Tiempo Respuesta</th>
              <th className={`${headerCellClass} text-right`}>T. Rpta Max (min)</th>
              <th className={`${headerCellClass} text-right`}>User x hr PRD</th>
              <th className={`${headerCellClass} text-right`}>Trx x día PRD</th>
              <th className={`${headerCellClass} text-right`}>Trx x hr PRD - Pico</th>
              <th className={`${headerCellClass} text-right`}>% Error</th>
              <th className={`${headerCellClass} text-right`}>UVC Esperado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={cellClass}>{c.process ?? '—'}</td>
              <td className={`${cellClass} font-mono text-[9px]`}>{c.path ?? '—'}</td>
              <td className={`${cellClass} max-w-[200px]`}>{c.responseTimeDesc ?? '—'}</td>
              <td className={`${cellClass} text-right`}>{c.responseTimeMaxMin ?? '—'}</td>
              <td className={`${cellClass} text-right`}>{c.userHrPrdNormal ?? '—'}</td>
              <td className={`${cellClass} text-right`}>{c.trxDayPrdNormal ?? '—'}</td>
              <td className={`${cellClass} text-right`}>{c.trxHrPrdPico ?? '—'}</td>
              <td className={`${cellClass} text-right`}>{c.maxErrorRate ?? '—'}</td>
              <td className={`${cellClass} text-right font-semibold text-primary`}>{uvc ?? '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  /* ── Load results table (read-only) ── */
  const renderLoadTable = (svc: PerfServiceData) => {
    const r = svc.loadResult;
    if (!r) return <p className="text-[10px] text-muted-foreground italic">Sin resultados de carga</p>;

    const getSecRaw = (key: 'tProm' | 'tMin' | 'tMax') => {
      const k = `${key}SecRaw` as const;
      const v = (r as any)?.[k];
      return typeof v === 'string' ? v : undefined;
    };

    const cols: { label: string; key: keyof PerfLoadResult; align?: string }[] = [
      { label: 'Proceso', key: 'process' },
      { label: 'Fecha', key: 'date' },
      { label: 'Duración', key: 'duration' },
      { label: 'UVC', key: 'uvc', align: 'right' },
      { label: 'TRX', key: 'trx', align: 'right' },
      { label: 'Asegurados', key: 'asegurados', align: 'right' },
      { label: 'T. Prom', key: 'tProm', align: 'right' },
      { label: 'T. Min', key: 'tMin', align: 'right' },
      { label: 'T. Max', key: 'tMax', align: 'right' },
      { label: '% Error', key: 'errorRate', align: 'right' },
      { label: 'Errores', key: 'errors', align: 'right' },
      { label: 'TPS', key: 'tps', align: 'right' },
    ];
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.key} className={`${headerCellClass} ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {cols.map(c => {
                const isResponseMetric = c.key === 'tProm' || c.key === 'tMin' || c.key === 'tMax';
                const value = r[c.key];
                const secRaw = isResponseMetric ? getSecRaw(c.key as any) : undefined;
                return (
                  <td key={c.key} className={`${cellClass} ${c.align === 'right' ? 'text-right' : ''}`}>
                    {isResponseMetric ? formatResponseMetric(value, secRaw) : (value ?? '—')}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  /* ── Stress results table (read-only) ── */
  const renderStressTable = (svc: PerfServiceData) => {
    const steps = svc.stressSteps ?? [];
    if (steps.length === 0) return <p className="text-[10px] text-muted-foreground italic">Sin resultados de estrés</p>;
    const stressCols: { label: string; key: keyof PerfStressStep; align?: string }[] = [
      { label: 'Minutos', key: 'minutesRange', align: 'left' },
      { label: 'UVC', key: 'uvc', align: 'right' },
      { label: 'TRX', key: 'trx', align: 'right' },
      { label: 'Errores', key: 'errors', align: 'right' },
      { label: '% Error', key: 'errorRate', align: 'right' },
      { label: 'T. Prom', key: 'tProm', align: 'right' },
      { label: 'T. Min', key: 'tMin', align: 'right' },
      { label: 'T. Max', key: 'tMax', align: 'right' },
      { label: 'TPS', key: 'tps', align: 'right' },
      { label: 'Estado', key: 'status', align: 'left' },
    ];
    const summary = svc.stressSummary;
    const hasSummaryData = summary && ['minutesRange', 'uvc', 'trx', 'errors', 'errorRate', 'tps', 'tProm', 'tMin', 'tMax', 'status'].some((k) => {
      const v = (summary as any)[k];
      return v !== undefined && v !== null && v !== '';
    });

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr>
              {stressCols.map(c => (
                <th
                  key={String(c.key)}
                  className={`${headerCellClass} ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {steps.map((step, stepIdx) => (
              <tr key={stepIdx} className="hover:bg-surface-1/50">
                {stressCols.map(c => {
                  const isResponseMetric = c.key === 'tProm' || c.key === 'tMin' || c.key === 'tMax';
                  const value = step[c.key];
                  return (
                    <td key={String(c.key)} className={`${cellClass} ${c.align === 'right' ? 'text-right' : ''}`}> 
                      {isResponseMetric ? formatResponseMetric(value) : (value ?? '—')}
                    </td>
                  );
                })}
              </tr>
            ))}
            {hasSummaryData && (
              <>
                <tr className="border-t-2 border-primary/40 bg-primary/5 font-semibold">
                  {stressCols.map(c => {
                    const isResponseMetric = c.key === 'tProm' || c.key === 'tMin' || c.key === 'tMax';
                    const value = (summary as any)?.[c.key];
                    return (
                      <td key={String(c.key)} className={`py-1.5 px-2 text-[10px] text-primary ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                        {isResponseMetric ? formatResponseMetric(value) : (value ?? '—')}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td colSpan={stressCols.length} className="text-right text-[9px] text-muted-foreground py-0.5 px-2">Total</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex gap-3">
      {/* ── LEFT COLUMN: Config sections ── */}
      <div className="w-1/3 min-w-[280px] space-y-3 shrink-0">
        {/* ── 0. Detalle Funcional + Tipo de Atención ── */}
        {atencion && (
          <div className="bg-surface-0 border border-border rounded-lg p-3 space-y-2">
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Detalle Funcional</h4>
              <p className="text-xs text-foreground bg-surface-1 border border-border rounded px-2 py-1.5 min-h-[28px]">
                {atencion.detalleFuncional || <span className="text-muted-foreground italic">Sin detalle funcional</span>}
              </p>
            </div>
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Tipo de Atención</h4>
              <p className="text-xs text-foreground bg-surface-1 border border-border rounded px-2 py-1.5 min-h-[28px]">
                {atencion.tipoAtencion === 'mejora' ? 'Mejora' : atencion.tipoAtencion === 'nueva_funcionalidad' ? 'Nueva Funcionalidad' : <span className="text-muted-foreground italic">Sin tipo definido</span>}
              </p>
            </div>
          </div>
        )}

        {/* ── 1. Checklist Result ── */}
        <div className="bg-surface-0 border border-border rounded-lg p-3">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
              Checklist de Rendimiento
            </h4>
            {d.checklistLevel ? (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-md border shrink-0
                ${d.checklistLevel === 'alta'
                  ? 'bg-green-500/20 border-green-500 text-green-400'
                  : 'bg-orange-500/20 border-orange-500 text-orange-400'
                }`}>
                {d.checklistLevel === 'alta' ? '🟢 ALTA' : '🟠 BAJA'}
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground italic">Sin checklist</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => checklistRef.current?.click()}
              disabled={parsingChecklist}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-md border border-primary/50 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 shrink-0 whitespace-nowrap"
            >
              <Upload className="w-3 h-3" />
              {parsingChecklist ? 'Procesando...' : 'Importar Checklist'}
            </button>
            <input ref={checklistRef} type="file" accept=".xlsx,.xls" onChange={handleChecklistImport} className="hidden" />
            {renderFileAttachment(d.checklistFileName, d.checklistStoragePath, async () => {
              if (d.checklistStoragePath) await deleteFile(d.checklistStoragePath);
              update({ checklistFileName: undefined, checklistStoragePath: undefined, checklistLevel: undefined, checklistResult: undefined });
            })}
          </div>
        </div>

        {/* ── 2. Understanding Session ── */}
        <div className="bg-surface-0 border border-border rounded-lg p-3">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 shrink-0">
              <Users className="w-3.5 h-3.5 text-primary" />
              Sesión de Entendimiento
            </h4>
            <div className="flex gap-1.5">
              {(['true', 'pending', 'na'] as const).map(val => {
                const isActive = val === 'true' ? d.hadUnderstandingSession === true
                  : val === 'pending' ? d.hadUnderstandingSession === 'pending'
                  : (d.hadUnderstandingSession as any) === 'na';
                const labels = { true: 'Sí', pending: 'Pendiente', na: 'No Aplica' };
                const colors = {
                  true: isActive ? 'bg-green-500/20 border-green-500 text-green-400' : 'border-border text-muted-foreground hover:border-primary/50',
                  pending: isActive ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'border-border text-muted-foreground hover:border-primary/50',
                  na: isActive ? 'bg-muted border-muted-foreground text-muted-foreground' : 'border-border text-muted-foreground hover:border-primary/50',
                };
                return (
                  <button key={val}
                    onClick={() => update({ hadUnderstandingSession: val === 'true' ? true : val as any })}
                    className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors ${colors[val]}`}>
                    {labels[val]}
                  </button>
                );
              })}
            </div>
          </div>
          {((d.hadUnderstandingSession as any) === 'pending' || (d.hadUnderstandingSession as any) === 'na') && (
            <textarea
              placeholder={(d.hadUnderstandingSession as any) === 'pending' ? "Comentarios sobre la sesión pendiente..." : "Comentarios sobre por qué no aplica..."}
              value={(d as any).understandingSessionComment ?? ''}
              onChange={e => update({ understandingSessionComment: e.target.value } as any)}
              className="w-full min-h-[60px] mt-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
          )}
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => sessionEvidenceRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-md border border-primary/50 text-primary hover:bg-primary/10 transition-colors shrink-0 whitespace-nowrap">
              <Paperclip className="w-3 h-3" /> Adjuntar sustento
            </button>
            <input ref={sessionEvidenceRef} type="file" accept=".pdf,.xlsx,.xls,.msg,.eml,.png,.jpg,.jpeg,.docx"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const path = await uploadFile(file, 'session');
                  update({ sessionEvidenceFileName: file.name, sessionEvidenceStoragePath: path ?? undefined, evidenceFileName: file.name, notApplicableEmailAttached: true });
                  toast.success(`Sustento adjuntado: ${file.name}`);
                }
                if (sessionEvidenceRef.current) sessionEvidenceRef.current.value = '';
              }}
              className="hidden"
            />
            {d.sessionEvidenceFileName ? renderFileAttachment(d.sessionEvidenceFileName, d.sessionEvidenceStoragePath, async () => {
              if (d.sessionEvidenceStoragePath) await deleteFile(d.sessionEvidenceStoragePath);
              update({ sessionEvidenceFileName: undefined, sessionEvidenceStoragePath: undefined, evidenceFileName: undefined, notApplicableEmailAttached: false });
            }) : <span className="text-[10px] text-muted-foreground italic">Sin sustento adjuntado</span>}
          </div>
        </div>

        {/* ── 3. Applies Performance Tests? ── */}
        <div className="bg-surface-0 border border-border rounded-lg p-3">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 shrink-0">
              <Activity className="w-3.5 h-3.5 text-primary" />
              ¿Aplica Pruebas de Rendimiento?
            </h4>
            <div className="flex gap-1.5">
              <button onClick={() => update({ appliesPerformanceTests: true })}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors ${applies === true ? 'bg-green-500/20 border-green-500 text-green-400' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                Sí
              </button>
              <button onClick={() => update({ appliesPerformanceTests: false })}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors ${applies === false ? 'bg-red-500/20 border-red-500 text-red-400' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                No
              </button>
            </div>
          </div>
          {applies === false && (
            <div className="mt-3 p-3 bg-yellow-500/5 border border-yellow-500/30 rounded-md space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-yellow-400">Todos los campos de rendimiento serán marcados como N/A.</p>
              </div>
              <textarea value={d.notApplicableReason ?? ''} onChange={e => update({ notApplicableReason: e.target.value })}
                placeholder="Motivo por el cual no aplica..." rows={2}
                className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => additionalEvidenceRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-md border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 transition-colors shrink-0 whitespace-nowrap">
                  <Paperclip className="w-3 h-3" /> + Sustento adicional
                </button>
                {(d.additionalEvidenceFiles ?? []).map((f, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 border border-border rounded-md min-w-0 overflow-hidden">
                    <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] text-foreground truncate">{f.name}</span>
                    <button onClick={() => downloadFile(f.storagePath, f.name)} className="text-primary hover:text-primary/80 transition-colors shrink-0"><Download className="w-3 h-3" /></button>
                    <button onClick={async () => { await deleteFile(f.storagePath); update({ additionalEvidenceFiles: (d.additionalEvidenceFiles ?? []).filter((_, i) => i !== idx) }); }}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                <input ref={additionalEvidenceRef} type="file" accept=".pdf,.xlsx,.xls,.msg,.eml,.png,.jpg,.jpeg,.docx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const path = await uploadFile(file, 'additional');
                      if (path) { update({ additionalEvidenceFiles: [...(d.additionalEvidenceFiles ?? []), { name: file.name, storagePath: path }] }); toast.success(`Sustento adicional adjuntado: ${file.name}`); }
                    }
                    if (additionalEvidenceRef.current) additionalEvidenceRef.current.value = '';
                  }} className="hidden" />
              </div>
            </div>
          )}
      </div>

        {/* ── 4. Atenciones Dependientes ── */}
        <div className="bg-surface-0 border border-border rounded-lg p-3">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 shrink-0">
              <FileText className="w-3.5 h-3.5 text-primary" />
              Atenciones Dependientes
            </h4>
            <div className="flex gap-1.5">
              {(['si', 'na'] as const).map(val => {
                const isActive = d.dependentRq === val;
                const labels = { si: 'Sí', na: 'No Aplica' };
                const colors = {
                  si: isActive ? 'bg-green-500/20 border-green-500 text-green-400' : 'border-border text-muted-foreground hover:border-primary/50',
                  na: isActive ? 'bg-muted border-muted-foreground text-muted-foreground' : 'border-border text-muted-foreground hover:border-primary/50',
                };
                return (
                  <button key={val}
                    onClick={() => update({ dependentRq: val })}
                    className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors ${colors[val]}`}>
                    {labels[val]}
                  </button>
                );
              })}
            </div>
          </div>
          {d.dependentRq === 'si' && (
            <div className="mt-2 space-y-2">
              <div>
                <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Atención</label>
                <input
                  type="text"
                  placeholder="Ej: RQ2025-310, GP2025-220..."
                  value={d.dependentRqName ?? ''}
                  onChange={e => update({ dependentRqName: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Motivo</label>
                <textarea
                  placeholder="Indique el motivo de la dependencia..."
                  value={d.dependentRqComment ?? ''}
                  onChange={e => update({ dependentRqComment: e.target.value })}
                  className="w-full min-h-[60px] rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── 5. Servicios Relacionados ── */}
        <div className="bg-surface-0 border border-border rounded-lg p-3">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 shrink-0">
              <FileText className="w-3.5 h-3.5 text-primary" />
              Servicios Relacionados
            </h4>
            <div className="flex gap-1.5">
              {(['si', 'na'] as const).map(val => {
                const isActive = d.serviciosRelacionadosApplies === val;
                const labels = { si: 'Sí', na: 'No Aplica' };
                const colors = {
                  si: isActive ? 'bg-green-500/20 border-green-500 text-green-400' : 'border-border text-muted-foreground hover:border-primary/50',
                  na: isActive ? 'bg-muted border-muted-foreground text-muted-foreground' : 'border-border text-muted-foreground hover:border-primary/50',
                };
                return (
                  <button key={val}
                    onClick={() => update({ serviciosRelacionadosApplies: val })}
                    className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors ${colors[val]}`}>
                    {labels[val]}
                  </button>
                );
              })}
            </div>
          </div>
          {d.serviciosRelacionadosApplies === 'si' && (
            <textarea
              placeholder="Indique los servicios relacionados..."
              value={d.serviciosRelacionados ?? ''}
              onChange={e => update({ serviciosRelacionados: e.target.value })}
              className="w-full min-h-[60px] rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
          )}
        </div>
      </div>

      {/* ── RIGHT COLUMN: PDF data ── */}
      <div className="flex-1 space-y-3 min-w-0">
        {applies === true ? (
          <>
            {/* Import PDF button */}
            <div className="bg-surface-0 border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => pdfRef.current?.click()} disabled={parsingPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-md border border-primary/50 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 shrink-0">
                  <Upload className="w-3 h-3" />
                  {parsingPdf ? 'Procesando PDF...' : 'Importar Informe PDF'}
                </button>
                <input ref={pdfRef} type="file" accept=".pdf" onChange={handlePdfImport} className="hidden" />
                {renderFileAttachment(d.pdfFileName, d.pdfStoragePath, async () => {
                  if (d.pdfStoragePath) await deleteFile(d.pdfStoragePath);
                  update({ pdfFileName: undefined, pdfStoragePath: undefined, services: undefined });
                })}
              </div>
            </div>

            {(d.services ?? []).length > 0 ? (
              (d.services ?? []).map((svc, svcIdx) => (
                <div key={svcIdx} className="space-y-3">
                  {/* Service header */}
                  {(d.services ?? []).length > 1 && (
                    <div className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5">
                      <span className="text-[10px] font-bold text-primary uppercase">
                        Servicio {svcIdx + 1}: {svc.criteria.process} — {svc.criteria.path ?? 'Sin path'}
                      </span>
                    </div>
                  )}

                  {/* Criteria (compact table, read-only) */}
                  <div className="bg-surface-0 border border-border rounded-lg p-3">
                    <button onClick={() => setExpandedCriteria(!expandedCriteria)} className="w-full flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-primary" /> Criterios de Aceptación
                      </h4>
                      {expandedCriteria ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                    {expandedCriteria && renderCriteriaTable(svc)}
                  </div>

                  {/* Load Results (read-only table + editable analysis/comments) */}
                  <div className="bg-surface-0 border border-border rounded-lg p-3">
                    <button onClick={() => setExpandedLoad(!expandedLoad)} className="w-full flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-green-400" /> Pruebas de Carga
                      </h4>
                      {expandedLoad ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                    {expandedLoad && (
                      <>
                        {renderLoadTable(svc)}
                        <div className="mt-3">
                          <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Análisis</label>
                          <textarea value={svc.loadAnalysis ?? ''} onChange={e => updateService(svcIdx, { loadAnalysis: e.target.value })}
                            rows={10} className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                            placeholder="Análisis de las pruebas de carga..." />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Stress Results — ocultar si es falso positivo (resumen idéntico a carga) */}
                  {(() => {
                    const steps = svc.stressSteps ?? [];
                    if (steps.length === 0) return false;

                    const summary = svc.stressSummary ?? steps[steps.length - 1];
                    const load = svc.loadResult;
                    if (!summary || !load) return true;

                    const toNum = (v: unknown) => {
                      if (typeof v === 'number') return v;
                      const n = Number(String(v ?? '').replace(',', '.'));
                      return Number.isFinite(n) ? n : NaN;
                    };

                    const fields: Array<keyof PerfStressStep> = ['uvc', 'trx', 'asegurados', 'tProm', 'tMin', 'tMax'];
                    const comparable = fields
                      .map((field) => {
                        const s = toNum(summary[field]);
                        const l = toNum((load as any)[field]);
                        return Number.isFinite(s) && Number.isFinite(l) ? Math.abs(s - l) <= 0.01 : null;
                      })
                      .filter((v): v is boolean => v !== null);

                    return !(comparable.length >= 4 && comparable.every(Boolean));
                  })() && (
                  <div className="bg-surface-0 border border-border rounded-lg p-3">
                    <button onClick={() => setExpandedStress(!expandedStress)} className="w-full flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-400" /> Pruebas de Estrés
                      </h4>
                      {expandedStress ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>
                    {expandedStress && (
                      <>
                        {renderStressTable(svc)}
                        <div className="mt-3">
                          <div>
                            <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">Análisis</label>
                            <textarea value={svc.stressAnalysis ?? ''} onChange={e => updateService(svcIdx, { stressAnalysis: e.target.value })}
                              rows={6} className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                              placeholder="Análisis de las pruebas de estrés..." />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  )}
                </div>
              ))
            ) : (
              <div className="bg-surface-0 border border-border rounded-lg p-3 flex items-center justify-center h-32">
                <p className="text-[10px] text-muted-foreground italic">Importe un informe PDF para ver criterios y resultados</p>
              </div>
            )}
          </>
        ) : applies === false ? (
          <div className="bg-surface-0 border border-border rounded-lg p-3 opacity-50 h-full flex items-center justify-center">
            <p className="text-[10px] text-muted-foreground text-center">
              Criterios y Resultados: <span className="font-bold">N/A</span>
            </p>
          </div>
        ) : (
          <div className="bg-surface-0 border border-border rounded-lg p-3 h-full flex items-center justify-center">
            <p className="text-[10px] text-muted-foreground text-center italic">
              Seleccione si aplica pruebas de rendimiento para ver criterios y resultados
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
