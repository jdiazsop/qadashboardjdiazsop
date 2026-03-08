import { useState, useEffect, useCallback } from 'react';
import { Atencion, PerformanceData, PerfServiceData } from '@/types/qa';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Download, FileSpreadsheet, Check, Save, Trash2, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  atenciones: Atencion[];
}

const FIELD_GROUPS = [
  {
    group: 'Datos Generales',
    fields: [
      { key: 'code', label: 'Código de Atención' },
      { key: 'description', label: 'Descripción' },
      { key: 'detalleFuncional', label: 'Detalle Funcional' },
      { key: 'tipoAtencion', label: 'Tipo de Atención' },
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
      { key: 'criteria.uvcEsperado', label: 'UVC Esperado' },
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

const ALL_FIELD_KEYS = FIELD_GROUPS.flatMap(g => g.fields.map(f => f.key));
const TEMPLATES_KEY = 'perf-export-templates';

interface ExportTemplate {
  name: string;
  fields: string[];
  atencionIds: string[];
}

function loadTemplates(): ExportTemplate[] {
  try {
    const saved = localStorage.getItem(TEMPLATES_KEY);
    if (saved) {
      const arr = JSON.parse(saved) as ExportTemplate[];
      if (Array.isArray(arr)) return arr;
    }
  } catch {}
  return [];
}

function saveTemplates(templates: ExportTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export function ExportPerformance({ atenciones }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedAtenciones, setSelectedAtenciones] = useState<Set<string>>(new Set());
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(ALL_FIELD_KEYS));
  const [templates, setTemplates] = useState<ExportTemplate[]>(loadTemplates);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

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

  const saveTemplate = () => {
    const name = newTemplateName.trim();
    if (!name) { toast.error('Escribe un nombre para la plantilla'); return; }
    const tpl: ExportTemplate = { name, fields: [...selectedFields], atencionIds: [...selectedAtenciones] };
    const updated = [...templates.filter(t => t.name !== name), tpl];
    setTemplates(updated);
    saveTemplates(updated);
    setNewTemplateName('');
    setShowSaveInput(false);
    toast.success(`Plantilla "${name}" guardada`);
  };

  const loadTemplate = (tpl: ExportTemplate) => {
    setSelectedFields(new Set(tpl.fields));
    // Only restore atenciones that still exist
    setSelectedAtenciones(new Set(tpl.atencionIds.filter(id => atenciones.some(a => a.id === id))));
    toast.success(`Plantilla "${tpl.name}" cargada`);
  };

  const deleteTemplate = (name: string) => {
    const updated = templates.filter(t => t.name !== name);
    setTemplates(updated);
    saveTemplates(updated);
    toast.success(`Plantilla "${name}" eliminada`);
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

  const hasRealStressData = (svc?: PerfServiceData): boolean => {
    if (!svc) return false;
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

    const fields: Array<keyof NonNullable<PerfServiceData['stressSummary']>> = ['uvc', 'trx', 'asegurados', 'tProm', 'tMin', 'tMax'];
    const comparable = fields
      .map((field) => {
        const s = toNum(summary[field]);
        const l = toNum((load as any)[field]);
        return Number.isFinite(s) && Number.isFinite(l) ? Math.abs(s - l) <= 0.01 : null;
      })
      .filter((v): v is boolean => v !== null);

    return !(comparable.length >= 4 && comparable.every(Boolean));
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

      const pd = (a: Atencion) => a.performanceData ?? {};

      // ── Define column groups with section colors ──
      type ColDef = { header: string; width: number; getter: (a: Atencion, svc?: PerfServiceData) => string | number | undefined };
      type Section = { name: string; color: string; textColor: string; cols: ColDef[] };

      const sections: Section[] = [];

      // General (includes former "Estado de Rendimiento" fields)
      const generalCols: ColDef[] = [];
      if (has('code')) generalCols.push({ header: 'Código', width: 18, getter: a => a.code });
      if (has('description')) generalCols.push({ header: 'Descripción', width: 40, getter: a => a.description ?? '—' });
      if (has('detalleFuncional')) generalCols.push({ header: 'Detalle Funcional', width: 35, getter: a => a.detalleFuncional ?? '—' });
      if (has('tipoAtencion')) generalCols.push({ header: 'Tipo de Atención', width: 20, getter: a => formatValue(a.tipoAtencion) });
      if (has('checklistLevel')) generalCols.push({ header: 'Checklist', width: 12, getter: a => formatValue(pd(a).checklistLevel) });
      if (has('hadUnderstandingSession')) generalCols.push({ header: 'Sesión Entendimiento', width: 20, getter: a => formatValue(pd(a).hadUnderstandingSession) });
      if (has('appliesPerformanceTests')) generalCols.push({ header: '¿Aplica Pruebas?', width: 15, getter: a => formatValue(pd(a).appliesPerformanceTests) });
      if (has('dependentRq')) generalCols.push({ header: 'Dep. Estado', width: 12, getter: a => formatValue(pd(a).dependentRq) });
      if (has('dependentRqName')) generalCols.push({ header: 'Dep. Atención', width: 18, getter: a => pd(a).dependentRqName ?? '—' });
      if (has('dependentRqComment')) generalCols.push({ header: 'Dep. Motivo', width: 30, getter: a => pd(a).dependentRqComment ?? '—' });
      if (has('serviciosRelacionadosApplies')) generalCols.push({ header: 'Serv. Rel. Estado', width: 15, getter: a => formatValue(pd(a).serviciosRelacionadosApplies) });
      if (has('serviciosRelacionados')) generalCols.push({ header: 'Serv. Relacionados', width: 30, getter: a => pd(a).serviciosRelacionados ?? '—' });
      if (generalCols.length > 0) sections.push({ name: 'DATOS GENERALES', color: 'FF1E3A5F', textColor: 'FFFFFFFF', cols: generalCols });

      // Criteria
      const critCols: ColDef[] = [];
      if (has('criteria.process')) critCols.push({ header: 'Proceso', width: 20, getter: (_, s) => s?.criteria.process ?? '—' });
      if (has('criteria.path')) critCols.push({ header: 'Path', width: 35, getter: (_, s) => s?.criteria.path ?? '—' });
      if (has('criteria.responseTimeDesc')) critCols.push({ header: 'Tiempo Respuesta', width: 30, getter: (_, s) => s?.criteria.responseTimeDesc ?? '—' });
      if (has('criteria.responseTimeMaxMin')) critCols.push({ header: 'T. Rpta Max (min)', width: 16, getter: (_, s) => s?.criteria.responseTimeMaxMin ?? '—' });
      if (has('criteria.userHrPrdNormal')) critCols.push({ header: 'User x hr PRD', width: 14, getter: (_, s) => s?.criteria.userHrPrdNormal ?? '—' });
      if (has('criteria.trxDayPrdNormal')) critCols.push({ header: 'Trx x día PRD', width: 14, getter: (_, s) => s?.criteria.trxDayPrdNormal ?? '—' });
      if (has('criteria.trxHrPrdPico')) critCols.push({ header: 'Trx x hr Pico', width: 14, getter: (_, s) => s?.criteria.trxHrPrdPico ?? '—' });
      if (has('criteria.maxErrorRate')) critCols.push({ header: '% Error Máx', width: 12, getter: (_, s) => s?.criteria.maxErrorRate ?? '—' });
      if (has('criteria.uvcEsperado')) critCols.push({ header: 'UVC Esperado', width: 14, getter: (_, s) => {
        const pico = s?.criteria.trxHrPrdPico;
        const tMax = s?.criteria.responseTimeMaxMin;
        if (pico != null && tMax != null) return Math.round((pico * tMax) / 60);
        return '—';
      }});
      if (critCols.length > 0) sections.push({ name: 'CRITERIOS DE ACEPTACIÓN', color: 'FF5F3A1E', textColor: 'FFFFFFFF', cols: critCols });

      // Load
      const loadCols: ColDef[] = [];
      if (has('load.uvc')) loadCols.push({ header: 'UVC', width: 10, getter: (_, s) => s?.loadResult?.uvc ?? '—' });
      if (has('load.trx')) loadCols.push({ header: 'TRX', width: 10, getter: (_, s) => s?.loadResult?.trx ?? '—' });
      if (has('load.asegurados')) loadCols.push({ header: 'Asegurados', width: 12, getter: (_, s) => s?.loadResult?.asegurados ?? '—' });
      if (has('load.tProm')) loadCols.push({ header: 'T. Prom', width: 10, getter: (_, s) => s?.loadResult?.tProm ?? '—' });
      if (has('load.tMin')) loadCols.push({ header: 'T. Min', width: 10, getter: (_, s) => s?.loadResult?.tMin ?? '—' });
      if (has('load.tMax')) loadCols.push({ header: 'T. Max', width: 10, getter: (_, s) => s?.loadResult?.tMax ?? '—' });
      if (has('load.errorRate')) loadCols.push({ header: '% Error', width: 10, getter: (_, s) => s?.loadResult?.errorRate ?? '—' });
      if (has('load.errors')) loadCols.push({ header: 'Errores', width: 10, getter: (_, s) => s?.loadResult?.errors ?? '—' });
      if (has('load.tps')) loadCols.push({ header: 'TPS', width: 10, getter: (_, s) => s?.loadResult?.tps ?? '—' });
      if (has('loadAnalysis')) loadCols.push({ header: 'Análisis Carga', width: 50, getter: (_, s) => s?.loadAnalysis ?? '—' });
      if (loadCols.length > 0) sections.push({ name: 'PRUEBAS DE CARGA', color: 'FF1E4D5F', textColor: 'FFFFFFFF', cols: loadCols });

      // Stress columns — only include if at least one chosen atencion has stress data real
      const chosenForCheck = atenciones.filter(a => selectedAtenciones.has(a.id));
      const anyHasStress = chosenForCheck.some(a =>
        (a.performanceData?.services ?? []).some(s => hasRealStressData(s))
      );

      const stressCols: ColDef[] = [];
      if (has('stressSteps') && anyHasStress) {
        stressCols.push({ header: 'Tramo', width: 8, getter: () => '' });
        stressCols.push({ header: 'UVC', width: 10, getter: () => '' });
        stressCols.push({ header: 'TRX', width: 10, getter: () => '' });
        stressCols.push({ header: 'Asegurados', width: 12, getter: () => '' });
        stressCols.push({ header: 'T. Prom', width: 10, getter: () => '' });
        stressCols.push({ header: 'T. Min', width: 10, getter: () => '' });
        stressCols.push({ header: 'T. Max', width: 10, getter: () => '' });
      }
      if (has('stressAnalysis') && anyHasStress) stressCols.push({ header: 'Análisis Estrés', width: 50, getter: (_, s) => s?.stressAnalysis ?? '—' });
      if (stressCols.length > 0) sections.push({ name: 'PRUEBAS DE ESTRÉS', color: 'FF5F1E3A', textColor: 'FFFFFFFF', cols: stressCols });

      // Flatten all columns
      const allCols = sections.flatMap(s => s.cols);
      const totalCols = allCols.length;
      if (totalCols === 0) { toast.error('No hay columnas seleccionadas'); return; }

      // ── Row 1: Section header (merged cells per section) ──
      const sectionRow = ws.getRow(1);
      sectionRow.height = 22;
      let colOffset = 1;
      for (const section of sections) {
        const count = section.cols.length;
        if (count > 1) {
          ws.mergeCells(1, colOffset, 1, colOffset + count - 1);
        }
        const cell = ws.getCell(1, colOffset);
        cell.value = section.name;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: section.textColor } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: section.color } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        // Apply fill to all cells in merge
        for (let c = colOffset; c < colOffset + count; c++) {
          const mc = ws.getCell(1, c);
          mc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: section.color } };
        }
        colOffset += count;
      }

      // ── Row 2: Column headers ──
      const headerRow = ws.getRow(2);
      headerRow.height = 24;
      allCols.forEach((col, idx) => {
        const cell = ws.getCell(2, idx + 1);
        cell.value = col.header;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FF95A5A6' } } };
      });

      // Set column widths
      allCols.forEach((col, idx) => {
        ws.getColumn(idx + 1).width = col.width;
      });

      // ── Helper: find column index for a section ──
      const sectionStartCol = (sectionName: string) => {
        let start = 0;
        for (const s of sections) {
          if (s.name === sectionName) return start;
          start += s.cols.length;
        }
        return start;
      };

      // ── Data rows ──
      const hasSvcFields = ['CRITERIOS DE ACEPTACIÓN', 'PRUEBAS DE CARGA', 'PRUEBAS DE ESTRÉS'].some(
        n => sections.some(s => s.name === n)
      );
      const hasStressStepCols = has('stressSteps');

      const centerAlign = { vertical: 'middle' as const, horizontal: 'center' as const, wrapText: true };
      const leftAlign = { vertical: 'middle' as const, horizontal: 'left' as const, wrapText: true };

      for (const a of chosen) {
        const services = a.performanceData?.services ?? [];
        const svcsToExport = hasSvcFields && services.length > 0 ? services : [undefined];

        for (const svc of svcsToExport) {
          // Determine how many rows this entry needs (max of 1 data row + stress steps)
          const steps = svc?.stressSteps ?? [];
          const maxStressRows = hasStressStepCols ? Math.max(steps.length + 1, 1) : 1; // +1 for summary

          // First row: general + status + criteria + load + first stress step
          const baseRowNum = ws.rowCount + 1;
          const baseRow = ws.addRow([]);
          baseRow.height = 20;

          // Fill general + status columns
          let ci = 0;
          for (const section of sections) {
            if (['PRUEBAS DE ESTRÉS'].includes(section.name)) {
              ci += section.cols.length;
              continue;
            }
            for (const col of section.cols) {
              const cell = ws.getCell(baseRowNum, ci + 1);
              const val = col.getter(a, svc);
              cell.value = val == null ? '—' : val;
              // Use left align for long text fields
              const isLong = col.width >= 30;
              cell.alignment = isLong ? leftAlign : centerAlign;
              cell.font = { name: 'Calibri', size: 9 };
              ci++;
            }
          }

          // Fill stress steps as rows
          if (hasStressStepCols) {
            const stressStartCol = sectionStartCol('PRUEBAS DE ESTRÉS');
            const stressAnalysisIncluded = has('stressAnalysis');

            // Write each step
            for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
              const step = steps[stepIdx];
              const rowNum = stepIdx === 0 ? baseRowNum : ws.rowCount + 1;
              const row = stepIdx === 0 ? baseRow : ws.addRow([]);
              row.height = 18;

              const vals = [stepIdx + 1, step.uvc ?? '—', step.trx ?? '—', step.asegurados ?? '—', step.tProm ?? '—', step.tMin ?? '—', step.tMax ?? '—'];
              vals.forEach((v, vi) => {
                const cell = ws.getCell(rowNum, stressStartCol + vi + 1);
                cell.value = v;
                cell.alignment = centerAlign;
                cell.font = { name: 'Calibri', size: 9 };
              });
            }

            // Summary/Total row
            const summary = svc?.stressSummary;
            if (summary) {
              const sumRowNum = ws.rowCount + 1;
              const sumRow = ws.addRow([]);
              sumRow.height = 20;
              const sumVals = ['Total', summary.uvc ?? '—', summary.trx ?? '—', summary.asegurados ?? '—', summary.tProm ?? '—', summary.tMin ?? '—', summary.tMax ?? '—'];
              sumVals.forEach((v, vi) => {
                const cell = ws.getCell(sumRowNum, stressStartCol + vi + 1);
                cell.value = v;
                cell.alignment = centerAlign;
                cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E3A5F' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2F8' } };
              });
            }

            // Stress analysis in first stress row
            if (stressAnalysisIncluded) {
              const analCol = stressStartCol + (has('stressSteps') ? 7 : 0) + 1;
              const cell = ws.getCell(baseRowNum, analCol);
              cell.value = svc?.stressAnalysis ?? '—';
              cell.alignment = leftAlign;
              cell.font = { name: 'Calibri', size: 9 };
              // Merge analysis cell across stress rows
              const lastStressRow = ws.rowCount;
              if (lastStressRow > baseRowNum) {
                ws.mergeCells(baseRowNum, analCol, lastStressRow, analCol);
              }
            }

            // Merge general/status/criteria/load cells across stress rows
            const lastStressRow = ws.rowCount;
            if (lastStressRow > baseRowNum) {
              let mergeCI = 0;
              for (const section of sections) {
                if (section.name === 'PRUEBAS DE ESTRÉS') { mergeCI += section.cols.length; continue; }
                for (const col of section.cols) {
                  ws.mergeCells(baseRowNum, mergeCI + 1, lastStressRow, mergeCI + 1);
                  mergeCI++;
                }
              }
            }
          }

          // Add thin bottom border to last row of this atencion block
          const lastRow = ws.rowCount;
          for (let c = 1; c <= totalCols; c++) {
            ws.getCell(lastRow, c).border = { bottom: { style: 'thin', color: { argb: 'FFBDC3C7' } } };
          }
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
          if (selectedAtenciones.size === 0) {
            setSelectedAtenciones(new Set(atenciones.map(a => a.id)));
          }
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

          {/* Templates */}
          <div className="space-y-2 mt-3 border-t border-border pt-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Plantillas</h3>
            {templates.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {templates.map(tpl => (
                  <div key={tpl.name} className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1 border border-border">
                    <button onClick={() => loadTemplate(tpl)} className="text-[10px] text-foreground hover:text-primary transition-colors flex items-center gap-1">
                      <FolderOpen className="w-3 h-3" />
                      {tpl.name}
                    </button>
                    <button onClick={() => deleteTemplate(tpl.name)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {showSaveInput ? (
              <div className="flex items-center gap-2">
                <input
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveTemplate()}
                  placeholder="Nombre de plantilla..."
                  className="flex-1 text-xs px-2 py-1.5 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
                <button onClick={saveTemplate} className="text-[10px] px-2 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                  Guardar
                </button>
                <button onClick={() => { setShowSaveInput(false); setNewTemplateName(''); }} className="text-[10px] px-2 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground">
                  Cancelar
                </button>
              </div>
            ) : (
              <button onClick={() => setShowSaveInput(true)} className="flex items-center gap-1.5 text-[10px] text-primary hover:underline">
                <Save className="w-3 h-3" />
                Guardar selección como plantilla
              </button>
            )}
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
