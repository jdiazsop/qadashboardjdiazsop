import { useState, useEffect, useCallback } from 'react';
import { Atencion, PerformanceData, PerfServiceData } from '@/types/qa';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Download, FileSpreadsheet, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  atenciones: Atencion[];
}

const FIELD_GROUPS = [
  {
    group: 'Datos Generales',
    fields: [
      { key: 'code', label: 'Código de Atención' },
      { key: 'detalleFuncional', label: 'Detalle Funcional' },
      { key: 'tipoAtencion', label: 'Tipo de Atención' },
    ],
  },
  {
    group: 'Estado de Rendimiento',
    fields: [
      { key: 'checklistLevel', label: 'Checklist (Alta/Baja)' },
      { key: 'hadUnderstandingSession', label: 'Sesión de Entendimiento' },
      { key: 'appliesPerformanceTests', label: '¿Aplica Pruebas?' },
      { key: 'dependentRq', label: 'Atenciones Dependientes' },
      { key: 'dependentRqName', label: 'Atención Dependiente (nombre)' },
      { key: 'dependentRqComment', label: 'Motivo Dependencia' },
      { key: 'serviciosRelacionadosApplies', label: 'Servicios Relacionados (estado)' },
      { key: 'serviciosRelacionados', label: 'Servicios Relacionados (detalle)' },
    ],
  },
  {
    group: 'Criterios de Aceptación',
    fields: [
      { key: 'criteria.process', label: 'Proceso' },
      { key: 'criteria.path', label: 'Path' },
      { key: 'criteria.responseTimeDesc', label: 'Tiempo de Respuesta' },
      { key: 'criteria.responseTimeMaxMin', label: 'T. Rpta Max (min)' },
      { key: 'criteria.userHrPrdNormal', label: 'User x hr PRD' },
      { key: 'criteria.trxDayPrdNormal', label: 'Trx x día PRD' },
      { key: 'criteria.trxHrPrdPico', label: 'Trx x hr PRD - Pico' },
      { key: 'criteria.maxErrorRate', label: '% Error Máx' },
    ],
  },
  {
    group: 'Pruebas de Carga',
    fields: [
      { key: 'load.uvc', label: 'UVC' },
      { key: 'load.trx', label: 'TRX' },
      { key: 'load.asegurados', label: 'Asegurados' },
      { key: 'load.tProm', label: 'T. Prom' },
      { key: 'load.tMin', label: 'T. Min' },
      { key: 'load.tMax', label: 'T. Max' },
      { key: 'load.errorRate', label: '% Error' },
      { key: 'load.errors', label: 'Errores' },
      { key: 'load.tps', label: 'TPS' },
      { key: 'loadAnalysis', label: 'Análisis de Carga' },
    ],
  },
  {
    group: 'Pruebas de Estrés',
    fields: [
      { key: 'stressSteps', label: 'Tramos de Estrés' },
      { key: 'stressAnalysis', label: 'Análisis de Estrés' },
    ],
  },
] as const;

type FieldKey = (typeof FIELD_GROUPS)[number]['fields'][number]['key'];

export function ExportPerformance({ atenciones }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedAtenciones, setSelectedAtenciones] = useState<Set<string>>(new Set());
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(FIELD_GROUPS.flatMap(g => g.fields.map(f => f.key)))
  );

  const toggleAtencion = (id: string) => {
    setSelectedAtenciones(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllAtenciones = () => {
    if (selectedAtenciones.size === atenciones.length) {
      setSelectedAtenciones(new Set());
    } else {
      setSelectedAtenciones(new Set(atenciones.map(a => a.id)));
    }
  };

  const toggleField = (key: string) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleGroup = (group: typeof FIELD_GROUPS[number]) => {
    const keys = group.fields.map(f => f.key);
    const allSelected = keys.every(k => selectedFields.has(k));
    setSelectedFields(prev => {
      const next = new Set(prev);
      keys.forEach(k => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  };

  const has = (key: string) => selectedFields.has(key);

  const formatValue = (val: any): string => {
    if (val == null) return '—';
    if (typeof val === 'boolean') return val ? 'Sí' : 'No';
    if (val === 'pending') return 'Pendiente';
    if (val === 'na') return 'No Aplica';
    if (val === 'si') return 'Sí';
    if (val === 'mejora') return 'Mejora';
    if (val === 'nueva_funcionalidad') return 'Nueva Funcionalidad';
    if (val === 'alta') return 'Alta';
    if (val === 'baja') return 'Baja';
    if (val === 'conforme') return 'Conforme';
    if (val === 'no_conforme') return 'No Conforme';
    return String(val);
  };

  const handleExport = async () => {
    const chosen = atenciones.filter(a => selectedAtenciones.has(a.id));
    if (chosen.length === 0) { toast.error('Selecciona al menos una atención'); return; }
    if (selectedFields.size === 0) { toast.error('Selecciona al menos un campo'); return; }

    try {
      const ExcelJS = await import('exceljs');
      const { saveAs } = await import('file-saver');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Rendimiento');

      // Build columns dynamically
      const columns: { header: string; key: string; width: number }[] = [];
      const fieldGetters: ((a: Atencion, svc?: PerfServiceData) => string)[] = [];

      const addCol = (header: string, width: number, getter: (a: Atencion, svc?: PerfServiceData) => string) => {
        const key = `col_${columns.length}`;
        columns.push({ header, key, width });
        fieldGetters.push(getter);
      };

      // General fields
      if (has('code')) addCol('Código', 18, a => a.code);
      if (has('detalleFuncional')) addCol('Detalle Funcional', 35, a => a.detalleFuncional ?? '—');
      if (has('tipoAtencion')) addCol('Tipo de Atención', 20, a => formatValue(a.tipoAtencion));

      // Performance status
      const d = (a: Atencion) => a.performanceData ?? {};
      if (has('checklistLevel')) addCol('Checklist', 12, a => formatValue(d(a).checklistLevel));
      if (has('hadUnderstandingSession')) addCol('Sesión Entendimiento', 18, a => formatValue(d(a).hadUnderstandingSession));
      if (has('appliesPerformanceTests')) addCol('¿Aplica Pruebas?', 15, a => formatValue(d(a).appliesPerformanceTests));
      if (has('dependentRq')) addCol('Dep. Estado', 12, a => formatValue(d(a).dependentRq));
      if (has('dependentRqName')) addCol('Dep. Atención', 18, a => d(a).dependentRqName ?? '—');
      if (has('dependentRqComment')) addCol('Dep. Motivo', 30, a => d(a).dependentRqComment ?? '—');
      if (has('serviciosRelacionadosApplies')) addCol('Serv. Rel. Estado', 15, a => formatValue(d(a).serviciosRelacionadosApplies));
      if (has('serviciosRelacionados')) addCol('Serv. Relacionados', 30, a => d(a).serviciosRelacionados ?? '—');

      // Criteria fields
      if (has('criteria.process')) addCol('Proceso', 20, (_, svc) => svc?.criteria.process ?? '—');
      if (has('criteria.path')) addCol('Path', 30, (_, svc) => svc?.criteria.path ?? '—');
      if (has('criteria.responseTimeDesc')) addCol('Tiempo Respuesta', 25, (_, svc) => svc?.criteria.responseTimeDesc ?? '—');
      if (has('criteria.responseTimeMaxMin')) addCol('T. Rpta Max (min)', 15, (_, svc) => String(svc?.criteria.responseTimeMaxMin ?? '—'));
      if (has('criteria.userHrPrdNormal')) addCol('User x hr PRD', 13, (_, svc) => String(svc?.criteria.userHrPrdNormal ?? '—'));
      if (has('criteria.trxDayPrdNormal')) addCol('Trx x día PRD', 13, (_, svc) => String(svc?.criteria.trxDayPrdNormal ?? '—'));
      if (has('criteria.trxHrPrdPico')) addCol('Trx x hr Pico', 13, (_, svc) => String(svc?.criteria.trxHrPrdPico ?? '—'));
      if (has('criteria.maxErrorRate')) addCol('% Error Máx', 10, (_, svc) => String(svc?.criteria.maxErrorRate ?? '—'));

      // Load fields
      if (has('load.uvc')) addCol('Carga UVC', 10, (_, svc) => String(svc?.loadResult?.uvc ?? '—'));
      if (has('load.trx')) addCol('Carga TRX', 10, (_, svc) => String(svc?.loadResult?.trx ?? '—'));
      if (has('load.asegurados')) addCol('Carga Aseg.', 10, (_, svc) => String(svc?.loadResult?.asegurados ?? '—'));
      if (has('load.tProm')) addCol('Carga T.Prom', 10, (_, svc) => String(svc?.loadResult?.tProm ?? '—'));
      if (has('load.tMin')) addCol('Carga T.Min', 10, (_, svc) => String(svc?.loadResult?.tMin ?? '—'));
      if (has('load.tMax')) addCol('Carga T.Max', 10, (_, svc) => String(svc?.loadResult?.tMax ?? '—'));
      if (has('load.errorRate')) addCol('Carga %Error', 10, (_, svc) => String(svc?.loadResult?.errorRate ?? '—'));
      if (has('load.errors')) addCol('Carga Errores', 10, (_, svc) => String(svc?.loadResult?.errors ?? '—'));
      if (has('load.tps')) addCol('Carga TPS', 10, (_, svc) => String(svc?.loadResult?.tps ?? '—'));
      if (has('loadAnalysis')) addCol('Análisis Carga', 40, (_, svc) => svc?.loadAnalysis ?? '—');

      // Stress
      if (has('stressSteps')) addCol('Estrés (resumen)', 40, (_, svc) => {
        const s = svc?.stressSummary;
        if (!s) return '—';
        return `UVC:${s.uvc ?? '-'} TRX:${s.trx ?? '-'} TProm:${s.tProm ?? '-'} TMax:${s.tMax ?? '-'}`;
      });
      if (has('stressAnalysis')) addCol('Análisis Estrés', 40, (_, svc) => svc?.stressAnalysis ?? '—');

      ws.columns = columns;

      // Style header
      const headerRow = ws.getRow(1);
      headerRow.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 28;

      // Data rows — one row per service per atencion
      const hasSvcFields = FIELD_GROUPS.slice(2).some(g => g.fields.some(f => selectedFields.has(f.key)));

      for (const a of chosen) {
        const services = a.performanceData?.services ?? [];
        if (hasSvcFields && services.length > 0) {
          for (const svc of services) {
            const row: Record<string, string> = {};
            columns.forEach((col, idx) => { row[col.key] = fieldGetters[idx](a, svc); });
            const r = ws.addRow(row);
            r.font = { name: 'Calibri', size: 9 };
            r.alignment = { vertical: 'top', wrapText: true };
          }
        } else {
          const row: Record<string, string> = {};
          columns.forEach((col, idx) => { row[col.key] = fieldGetters[idx](a); });
          const r = ws.addRow(row);
          r.font = { name: 'Calibri', size: 9 };
          r.alignment = { vertical: 'top', wrapText: true };
        }
      }

      const buf = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buf]), 'Rendimiento_QA.xlsx');
      toast.success('Excel exportado correctamente');
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Error al exportar');
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setSelectedAtenciones(new Set(atenciones.map(a => a.id)));
          setOpen(true);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-md border border-primary/50 text-primary hover:bg-primary/10 transition-colors"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        Exportar Rendimiento
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Exportar Rendimiento a Excel
            </DialogTitle>
            <DialogDescription>Selecciona las atenciones y los campos que deseas incluir en el reporte.</DialogDescription>
          </DialogHeader>

          {/* Atencion selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Atenciones</h3>
              <button onClick={toggleAllAtenciones} className="text-[10px] text-primary hover:underline">
                {selectedAtenciones.size === atenciones.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-[150px] overflow-y-auto border border-border rounded-md p-2 bg-surface-0">
              {atenciones.map(a => (
                <label key={a.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 rounded px-1.5 py-1">
                  <div
                    onClick={() => toggleAtencion(a.id)}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer
                      ${selectedAtenciones.has(a.id)
                        ? 'bg-primary border-primary'
                        : 'border-border hover:border-primary/50'
                      }`}
                  >
                    {selectedAtenciones.has(a.id) && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <span className="text-xs text-foreground truncate">{a.code}{a.aplicativo ? ` — ${a.aplicativo}` : ''}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Field selector */}
          <div className="space-y-3 mt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Campos a Exportar</h3>
            {FIELD_GROUPS.map(g => {
              const keys = g.fields.map(f => f.key);
              const allSelected = keys.every(k => selectedFields.has(k));
              const someSelected = keys.some(k => selectedFields.has(k));
              return (
                <div key={g.group} className="border border-border rounded-md p-2 bg-surface-0">
                  <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                    <div
                      onClick={() => toggleGroup(g)}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer
                        ${allSelected ? 'bg-primary border-primary' : someSelected ? 'bg-primary/40 border-primary' : 'border-border hover:border-primary/50'}`}
                    >
                      {allSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <span className="text-[11px] font-semibold text-foreground">{g.group}</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1 pl-6">
                    {g.fields.map(f => (
                      <label key={f.key} className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 rounded px-1 py-0.5">
                        <div
                          onClick={() => toggleField(f.key)}
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer
                            ${selectedFields.has(f.key) ? 'bg-primary border-primary' : 'border-border hover:border-primary/50'}`}
                        >
                          {selectedFields.has(f.key) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        <span className="text-[10px] text-foreground">{f.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Export button */}
          <div className="flex justify-end mt-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar ({selectedAtenciones.size} atención{selectedAtenciones.size !== 1 ? 'es' : ''})
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
