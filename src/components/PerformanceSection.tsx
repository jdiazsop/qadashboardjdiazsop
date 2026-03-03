import { useState, useRef } from 'react';
import { PerformanceData, PerformanceTestResult, PerformanceAcceptanceCriteria } from '@/types/qa';
import { parsePerformanceExcel } from '@/lib/parsePerformanceExcel';
import { detectChecklistOutcome } from '@/lib/parseChecklistLevel';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Upload, FileSpreadsheet, FileText, CheckCircle2, XCircle,
  AlertTriangle, Users, Clock, Activity, ChevronDown, ChevronUp, Paperclip, X, Download,
} from 'lucide-react';

interface Props {
  data: PerformanceData | undefined;
  onChange: (data: PerformanceData) => void;
}

export function PerformanceSection({ data, onChange }: Props) {
  const { user } = useAuth();
  const d = data ?? {};
  const [parsingChecklist, setParsingChecklist] = useState(false);
  const [parsingExcel, setParsingExcel] = useState(false);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [expandedCriteria, setExpandedCriteria] = useState(true);
  const [expandedResults, setExpandedResults] = useState(true);
  const checklistRef = useRef<HTMLInputElement>(null);
  const excelRef = useRef<HTMLInputElement>(null);
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


  /* ── Helper robusto para extraer texto de celdas ExcelJS ── */
  const cellText = (cell: any): string => {
    const toText = (val: any): string => {
      if (val == null) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'number' || typeof val === 'boolean') return String(val);
      if (val instanceof Date) return val.toISOString();
      if (Array.isArray(val)) return val.map(toText).join(' ');
      if (typeof val === 'object') {
        if (typeof val.text === 'string') return val.text;
        if (Array.isArray(val.richText)) {
          return val.richText.map((r: any) => String(r?.text ?? '')).join('');
        }
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
        update({
          checklistResult: result,
          checklistLevel: undefined,
          checklistFileName: file.name,
          checklistStoragePath: storagePath ?? undefined,
        });
        toast.success(`Checklist importado: ${result}`);
      } else if (level) {
        update({
          checklistLevel: level,
          checklistResult: undefined,
          checklistFileName: file.name,
          checklistStoragePath: storagePath ?? undefined,
        });
        toast.success(`Checklist nivel detectado: ${level.charAt(0).toUpperCase() + level.slice(1)}`);
      } else {
        toast.warning('No se encontró un resultado claro en el checklist. Selecciónelo manualmente.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al parsear el checklist Excel');
    } finally {
      setParsingChecklist(false);
      if (checklistRef.current) checklistRef.current.value = '';
    }
  };

  /* ── Matriz Excel import ── */
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsingExcel(true);
    try {
      const criteria = await parsePerformanceExcel(file);
      update({ acceptanceCriteria: criteria });
      toast.success('Matriz de relevamiento importada');
    } catch (err) {
      console.error(err);
      toast.error('Error al parsear el Excel');
    } finally {
      setParsingExcel(false);
      if (excelRef.current) excelRef.current.value = '';
    }
  };

  /* ── PDF import ── */
  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsingPdf(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), '')
      );

      const { data: fnData, error } = await supabase.functions.invoke('parse-performance-pdf', {
        body: { pdfBase64: base64 },
      });

      if (error) throw error;

      const results: PerformanceTestResult[] = (fnData?.results ?? []).map(
        (r: any, i: number) => ({
          id: `perf-${Date.now()}-${i}`,
          type: r.type ?? '',
          startDate: r.startDate ?? undefined,
          trx: r.trx ?? undefined,
          simulatedUsers: r.simulatedUsers ?? undefined,
          duration: r.duration ?? undefined,
          errors: r.errors ?? undefined,
          errorRate: r.errorRate ?? undefined,
          responseTimeAvg: r.responseTimeAvg ?? undefined,
          responseTimeMin: r.responseTimeMin ?? undefined,
          responseTimeMax: r.responseTimeMax ?? undefined,
          tps: r.tps ?? undefined,
          status: r.status ?? undefined,
        })
      );

      update({ testResults: results });
      toast.success(`${results.length} resultado(s) extraído(s) del informe`);
    } catch (err) {
      console.error(err);
      toast.error('Error al procesar el PDF');
    } finally {
      setParsingPdf(false);
      if (pdfRef.current) pdfRef.current.value = '';
    }
  };

  /* ── Criteria field updater ── */
  const updateCriteria = (field: keyof PerformanceAcceptanceCriteria, value: string) => {
    const prev = d.acceptanceCriteria ?? {};
    const numFields = ['monthlyUsers', 'avgDailyRequests', 'peakHourRequests', 'peakMinuteRequests', 'impactedApps', 'microservices', 'inputParams'];
    const parsed = numFields.includes(field) ? (value ? Number(value) : undefined) : (value || undefined);
    update({ acceptanceCriteria: { ...prev, [field]: parsed } });
  };

  /* ── Test result updater ── */
  const updateResult = (id: string, field: keyof PerformanceTestResult, value: string) => {
    const results = (d.testResults ?? []).map(r => {
      if (r.id !== id) return r;
      const numFields = ['trx', 'errors', 'responseTimeAvg', 'responseTimeMin', 'responseTimeMax', 'tps'];
      const parsed = numFields.includes(field) ? (value ? Number(value) : undefined) : (value || undefined);
      return { ...r, [field]: parsed };
    });
    update({ testResults: results });
  };

  const addEmptyResult = () => {
    const results = [...(d.testResults ?? []), {
      id: `perf-${Date.now()}`,
      type: '',
    }];
    update({ testResults: results });
  };

  const removeResult = (id: string) => {
    update({ testResults: (d.testResults ?? []).filter(r => r.id !== id) });
  };

  const criteriaFields: { key: keyof PerformanceAcceptanceCriteria; label: string; type?: string }[] = [
    { key: 'method', label: 'Método HTTP' },
    { key: 'apiName', label: 'Nombre del API' },
    { key: 'endpoint', label: 'Endpoint / URL' },
    { key: 'monthlyUsers', label: 'N° usuarios únicos mensuales', type: 'number' },
    { key: 'avgDailyRequests', label: 'Solicitudes promedio por día', type: 'number' },
    { key: 'peakHourRequests', label: 'Solicitudes pico por hora', type: 'number' },
    { key: 'peakMinuteRequests', label: 'Solicitudes pico por minuto', type: 'number' },
    { key: 'impactedApps', label: 'N° de aplicaciones impactadas', type: 'number' },
    { key: 'impactedAppNames', label: 'Nombres de aplicaciones impactadas' },
    { key: 'peakUsageTime', label: 'Horario pico de uso' },
    { key: 'microservices', label: 'N° de microservicios involucrados', type: 'number' },
    { key: 'inputParams', label: 'N° de parámetros de entrada', type: 'number' },
    { key: 'slaMaxResponse', label: 'SLA - Tiempo máximo de respuesta' },
    { key: 'maxErrorRate', label: 'Tasa máxima de error aceptada' },
    { key: 'minThroughput', label: 'Throughput mínimo aceptable' },
    { key: 'dataVolume', label: 'Volumen de datos' },
  ];

  return (
    <div className="flex gap-3">
      {/* ── LEFT COLUMN: Config sections ── */}
      <div className="w-1/3 min-w-[280px] space-y-3 shrink-0">
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
                }`}
              >
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
            {d.checklistFileName && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 border border-border rounded-md min-w-0 overflow-hidden">
                <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[10px] text-foreground truncate">{d.checklistFileName}</span>
                <button
                  onClick={() => d.checklistStoragePath ? downloadFile(d.checklistStoragePath, d.checklistFileName!) : toast.info('Reemplace el archivo para habilitar descarga')}
                  className="text-primary hover:text-primary/80 transition-colors shrink-0" title="Descargar"
                >
                  <Download className="w-3 h-3" />
                </button>
                <button
                  onClick={async () => {
                    if (d.checklistStoragePath) await deleteFile(d.checklistStoragePath);
                    update({ checklistFileName: undefined, checklistStoragePath: undefined, checklistLevel: undefined, checklistResult: undefined });
                  }}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
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
              <button
                onClick={() => update({ hadUnderstandingSession: true })}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors
                  ${d.hadUnderstandingSession === true
                    ? 'bg-green-500/20 border-green-500 text-green-400'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
              >
                Sí
              </button>
              <button
                onClick={() => update({ hadUnderstandingSession: 'pending' as any })}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors
                  ${d.hadUnderstandingSession === 'pending'
                    ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
              >
                Pendiente
              </button>
              <button
                onClick={() => update({ hadUnderstandingSession: 'na' as any })}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors
                  ${(d.hadUnderstandingSession as any) === 'na'
                    ? 'bg-muted border-muted-foreground text-muted-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
              >
                No Aplica
              </button>
            </div>
          </div>
          {((d.hadUnderstandingSession as any) === 'pending' || (d.hadUnderstandingSession as any) === 'na') && (
            <div className="mt-2">
              <textarea
                placeholder={(d.hadUnderstandingSession as any) === 'pending' ? "Comentarios sobre la sesión pendiente..." : "Comentarios sobre por qué no aplica..."}
                value={(d as any).understandingSessionComment ?? ''}
                onChange={(e) => update({ understandingSessionComment: e.target.value } as any)}
                className="w-full min-h-[60px] rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              />
            </div>
          )}
          {/* Evidence upload for session */}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => sessionEvidenceRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-md border border-primary/50 text-primary hover:bg-primary/10 transition-colors shrink-0 whitespace-nowrap"
            >
              <Paperclip className="w-3 h-3" />
              Adjuntar sustento
            </button>
            <input
              ref={sessionEvidenceRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.msg,.eml,.png,.jpg,.jpeg,.docx"
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
            {d.sessionEvidenceFileName ? (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 border border-border rounded-md min-w-0 overflow-hidden">
                <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[10px] text-foreground truncate">{d.sessionEvidenceFileName}</span>
                <button
                  onClick={() => d.sessionEvidenceStoragePath ? downloadFile(d.sessionEvidenceStoragePath, d.sessionEvidenceFileName!) : toast.info('Archivo no disponible para descarga, reemplácelo para habilitar')}
                  className="text-primary hover:text-primary/80 transition-colors shrink-0"
                  title="Descargar"
                >
                  <Download className="w-3 h-3" />
                </button>
                <button
                  onClick={async () => {
                    if (d.sessionEvidenceStoragePath) await deleteFile(d.sessionEvidenceStoragePath);
                    update({ sessionEvidenceFileName: undefined, sessionEvidenceStoragePath: undefined, evidenceFileName: undefined, notApplicableEmailAttached: false });
                  }}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground italic">Sin sustento adjuntado</span>
            )}
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
              <button
                onClick={() => update({ appliesPerformanceTests: true })}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors
                  ${applies === true
                    ? 'bg-green-500/20 border-green-500 text-green-400'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
              >
                Sí
              </button>
              <button
                onClick={() => update({ appliesPerformanceTests: false })}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors
                  ${applies === false
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
              >
                No
              </button>
            </div>
          </div>

          {applies === false && (
            <div className="mt-3 p-3 bg-yellow-500/5 border border-yellow-500/30 rounded-md space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-yellow-400">
                  Todos los campos de rendimiento serán marcados como N/A. Indique el motivo y adjunte sustento.
                </p>
              </div>
              <textarea
                value={d.notApplicableReason ?? ''}
                onChange={e => update({ notApplicableReason: e.target.value })}
                placeholder="Motivo por el cual no aplica pruebas de rendimiento..."
                rows={2}
                className="w-full bg-surface-0 border border-border rounded px-2 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => additionalEvidenceRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-md border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 transition-colors shrink-0 whitespace-nowrap"
                >
                  <Paperclip className="w-3 h-3" />
                  + Sustento adicional
                </button>
                {d.sessionEvidenceFileName ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 border border-border rounded-md min-w-0 overflow-hidden">
                    <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] text-foreground truncate">{d.sessionEvidenceFileName}</span>
                    <button
                      onClick={() => d.sessionEvidenceStoragePath ? downloadFile(d.sessionEvidenceStoragePath, d.sessionEvidenceFileName!) : toast.info('Reemplace el archivo para habilitar descarga')}
                      className="text-primary hover:text-primary/80 transition-colors shrink-0" title="Descargar"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-yellow-400" />
                    <span className="text-[10px] text-yellow-400 italic">Adjunte sustento en Sesión de Entendimiento</span>
                  </div>
                )}
                {(d.additionalEvidenceFiles ?? []).map((f, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 border border-border rounded-md min-w-0 overflow-hidden">
                    <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] text-foreground truncate">{f.name}</span>
                    <button onClick={() => downloadFile(f.storagePath, f.name)} className="text-primary hover:text-primary/80 transition-colors shrink-0">
                      <Download className="w-3 h-3" />
                    </button>
                    <button
                      onClick={async () => {
                        await deleteFile(f.storagePath);
                        update({ additionalEvidenceFiles: (d.additionalEvidenceFiles ?? []).filter((_, i) => i !== idx) });
                      }}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <input
                  ref={additionalEvidenceRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.msg,.eml,.png,.jpg,.jpeg,.docx"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const path = await uploadFile(file, 'additional');
                      if (path) {
                        update({ additionalEvidenceFiles: [...(d.additionalEvidenceFiles ?? []), { name: file.name, storagePath: path }] });
                        toast.success(`Sustento adicional adjuntado: ${file.name}`);
                      }
                    }
                    if (additionalEvidenceRef.current) additionalEvidenceRef.current.value = '';
                  }}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT COLUMN: Criteria + Results ── */}
      <div className="flex-1 space-y-3">
        {applies === true ? (
          <>
            {/* ── 4. Acceptance Criteria ── */}
            <div className="bg-surface-0 border border-border rounded-lg p-3">
              <button
                onClick={() => setExpandedCriteria(!expandedCriteria)}
                className="w-full flex items-center justify-between mb-2"
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
                  Criterios de Aceptación
                </h4>
                {expandedCriteria ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>

              {expandedCriteria && (
                <>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => excelRef.current?.click()}
                      disabled={parsingExcel}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-md border border-primary/50 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      <Upload className="w-3 h-3" />
                      {parsingExcel ? 'Procesando...' : 'Importar Matriz de Relevamiento'}
                    </button>
                    <input ref={excelRef} type="file" accept=".xlsx,.xls" onChange={handleExcelImport} className="hidden" />
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {criteriaFields.map(f => (
                      <div key={f.key}>
                        <label className="block text-[8px] uppercase text-muted-foreground mb-0.5">{f.label}</label>
                        <input
                          type={f.type ?? 'text'}
                          value={d.acceptanceCriteria?.[f.key] ?? ''}
                          onChange={e => updateCriteria(f.key, e.target.value)}
                          className="w-full bg-surface-0 border border-border rounded px-1.5 py-1 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ── 5. Test Results ── */}
            <div className="bg-surface-0 border border-border rounded-lg p-3">
              <button
                onClick={() => setExpandedResults(!expandedResults)}
                className="w-full flex items-center justify-between mb-2"
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Resultados de Pruebas
                </h4>
                {expandedResults ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>

              {expandedResults && (
                <>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => pdfRef.current?.click()}
                      disabled={parsingPdf}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-md border border-primary/50 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      <Upload className="w-3 h-3" />
                      {parsingPdf ? 'Procesando PDF...' : 'Importar Informe PDF'}
                    </button>
                    <input ref={pdfRef} type="file" accept=".pdf" onChange={handlePdfImport} className="hidden" />
                    <button
                      onClick={addEmptyResult}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-md border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                    >
                      + Agregar manual
                    </button>
                  </div>

                  {(d.testResults ?? []).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground">
                            <th className="text-left py-1 px-1 font-medium">Tipo</th>
                            <th className="text-left py-1 px-1 font-medium">Fecha</th>
                            <th className="text-left py-1 px-1 font-medium">Usuarios</th>
                            <th className="text-left py-1 px-1 font-medium">Duración</th>
                            <th className="text-right py-1 px-1 font-medium">TRX</th>
                            <th className="text-right py-1 px-1 font-medium">Error</th>
                            <th className="text-right py-1 px-1 font-medium">% Error</th>
                            <th className="text-right py-1 px-1 font-medium">T. Prom</th>
                            <th className="text-right py-1 px-1 font-medium">T. Min</th>
                            <th className="text-right py-1 px-1 font-medium">T. Max</th>
                            <th className="text-right py-1 px-1 font-medium">TPS</th>
                            <th className="text-center py-1 px-1 font-medium">Estado</th>
                            <th className="py-1 px-1"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(d.testResults ?? []).map(r => (
                            <tr key={r.id} className="border-b border-border/50 hover:bg-surface-1/50">
                              <td className="py-1 px-1">
                                <input value={r.type ?? ''} onChange={e => updateResult(r.id, 'type', e.target.value)}
                                  className="w-16 bg-transparent border-b border-border/50 focus:border-primary outline-none px-0.5" placeholder="Carga" />
                              </td>
                              <td className="py-1 px-1">
                                <input type="date" value={r.startDate ?? ''} onChange={e => updateResult(r.id, 'startDate', e.target.value)}
                                  className="w-24 bg-transparent border-b border-border/50 focus:border-primary outline-none px-0.5" />
                              </td>
                              <td className="py-1 px-1">
                                <input value={r.simulatedUsers ?? ''} onChange={e => updateResult(r.id, 'simulatedUsers', e.target.value)}
                                  className="w-20 bg-transparent border-b border-border/50 focus:border-primary outline-none px-0.5" />
                              </td>
                              <td className="py-1 px-1">
                                <input value={r.duration ?? ''} onChange={e => updateResult(r.id, 'duration', e.target.value)}
                                  className="w-16 bg-transparent border-b border-border/50 focus:border-primary outline-none px-0.5" />
                              </td>
                              <td className="py-1 px-1 text-right">
                                <input type="number" value={r.trx ?? ''} onChange={e => updateResult(r.id, 'trx', e.target.value)}
                                  className="w-14 bg-transparent border-b border-border/50 focus:border-primary outline-none text-right px-0.5" />
                              </td>
                              <td className="py-1 px-1 text-right">
                                <input type="number" value={r.errors ?? ''} onChange={e => updateResult(r.id, 'errors', e.target.value)}
                                  className="w-10 bg-transparent border-b border-border/50 focus:border-primary outline-none text-right px-0.5" />
                              </td>
                              <td className="py-1 px-1 text-right">
                                <input value={r.errorRate ?? ''} onChange={e => updateResult(r.id, 'errorRate', e.target.value)}
                                  className="w-12 bg-transparent border-b border-border/50 focus:border-primary outline-none text-right px-0.5" />
                              </td>
                              <td className="py-1 px-1 text-right">
                                <input type="number" step="0.001" value={r.responseTimeAvg ?? ''} onChange={e => updateResult(r.id, 'responseTimeAvg', e.target.value)}
                                  className="w-14 bg-transparent border-b border-border/50 focus:border-primary outline-none text-right px-0.5" />
                              </td>
                              <td className="py-1 px-1 text-right">
                                <input type="number" step="0.001" value={r.responseTimeMin ?? ''} onChange={e => updateResult(r.id, 'responseTimeMin', e.target.value)}
                                  className="w-14 bg-transparent border-b border-border/50 focus:border-primary outline-none text-right px-0.5" />
                              </td>
                              <td className="py-1 px-1 text-right">
                                <input type="number" step="0.001" value={r.responseTimeMax ?? ''} onChange={e => updateResult(r.id, 'responseTimeMax', e.target.value)}
                                  className="w-14 bg-transparent border-b border-border/50 focus:border-primary outline-none text-right px-0.5" />
                              </td>
                              <td className="py-1 px-1 text-right">
                                <input type="number" step="0.01" value={r.tps ?? ''} onChange={e => updateResult(r.id, 'tps', e.target.value)}
                                  className="w-12 bg-transparent border-b border-border/50 focus:border-primary outline-none text-right px-0.5" />
                              </td>
                              <td className="py-1 px-1 text-center">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold
                                  ${(r.status ?? '').toUpperCase().includes('CONFORME')
                                    ? 'bg-green-500/20 text-green-400'
                                    : r.status ? 'bg-red-500/20 text-red-400' : 'text-muted-foreground'
                                  }`}>
                                  {r.status || '—'}
                                </span>
                              </td>
                              <td className="py-1 px-1">
                                <button onClick={() => removeResult(r.id)}
                                  className="text-muted-foreground hover:text-destructive transition-colors">
                                  <XCircle className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground italic">No hay resultados. Importe un informe PDF o agregue manualmente.</p>
                  )}
                </>
              )}
            </div>
          </>
        ) : applies === false ? (
          <div className="bg-surface-0 border border-border rounded-lg p-3 opacity-50 h-full flex items-center justify-center">
            <p className="text-[10px] text-muted-foreground text-center">
              Criterios de Aceptación y Resultados: <span className="font-bold">N/A</span>
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
