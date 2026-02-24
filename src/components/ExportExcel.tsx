import { Atencion, KanbanColumn, TestCycle } from '@/types/qa';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Download } from 'lucide-react';

const cxPattern = /^C(\d+)$/i;

function computeCicloActual(cycles: TestCycle[]): { total: number; current: string } {
  const cxCycles = cycles
    .filter(c => cxPattern.test(c.label.trim()))
    .map(c => ({ label: c.label.trim(), num: parseInt(c.label.trim().match(cxPattern)![1]) }))
    .sort((a, b) => a.num - b.num);
  if (cxCycles.length === 0) return { total: 0, current: '—' };
  return { total: cxCycles.length, current: cxCycles[cxCycles.length - 1].label };
}

function findAnalisisCycle(cycles: TestCycle[]): TestCycle | undefined {
  return cycles.find(c => /an[áa]lisis/i.test(c.label) || /dise[ñn]o/i.test(c.label));
}

function findCurrentCxCycle(cycles: TestCycle[]): TestCycle | undefined {
  const cxCycles = cycles
    .filter(c => cxPattern.test(c.label.trim()))
    .map(c => ({ cycle: c, num: parseInt(c.label.trim().match(cxPattern)![1]) }))
    .sort((a, b) => a.num - b.num);
  return cxCycles.length > 0 ? cxCycles[cxCycles.length - 1].cycle : undefined;
}

function hasGlobalDelay(a: Atencion): boolean {
  return !!a.delayEndDate;
}

/** Consolidate atenciones: group duplicates (same sourceId) into one row with multiple QA names */
function consolidateAtenciones(atenciones: Atencion[], columns: KanbanColumn[]): { atencion: Atencion; qaNames: string[] }[] {
  const grouped = new Map<string, { atencion: Atencion; qaNames: string[] }>();

  for (const a of atenciones) {
    const key = a.sourceId || a.id; // group by sourceId if duplicated
    const colTitle = columns.find(c => c.id === a.columnId)?.title || '';

    if (grouped.has(key)) {
      const existing = grouped.get(key)!;
      if (colTitle && !existing.qaNames.includes(colTitle)) {
        existing.qaNames.push(colTitle);
      }
    } else {
      grouped.set(key, {
        atencion: a,
        qaNames: colTitle ? [colTitle] : [],
      });
    }
  }

  return Array.from(grouped.values());
}

interface Props {
  atenciones: Atencion[];
  columns: KanbanColumn[];
}

export function ExportExcel({ atenciones, columns }: Props) {
  const handleExport = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Seguimiento QA');

    // Header fills by section
    const blueFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    const purpleFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7030A0' } };
    const greenFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF375623' } };
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9, name: 'Calibri' };
    const headerAlignment: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
    const borderThin: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' },
    };

    const headers = [
      'RQ/GP/PE', 'Nombre del RQ/GP/PE', 'Aplicativo', 'Estado Jira', 'Total CPs',
      'Ciclo Actual', 'Fecha de Entrega (DESA) Planificada', 'Fecha de Entrega Real',
      'Fecha Inicio QC Planificada', 'Fecha Inicio QC Real',
      'Fecha Fin QC Planificada', 'Fecha Fin QC Real',
      'Cumplimiento de planificación', 'Estatus', 'Comentario Adicional', 'QA',
    ];

    // Column color map: 1-6 blue, 7-12 purple, 13-16 green
    const colFillMap: Record<number, ExcelJS.Fill> = {};
    for (let i = 1; i <= 6; i++) colFillMap[i] = blueFill;
    for (let i = 7; i <= 12; i++) colFillMap[i] = purpleFill;
    for (let i = 13; i <= 16; i++) colFillMap[i] = blueFill;

    // Add header row - taller for wrapped text
    const headerRow = ws.addRow(headers);
    headerRow.height = 55;
    headerRow.eachCell((cell, colNumber) => {
      cell.fill = colFillMap[colNumber] || blueFill;
      cell.font = headerFont;
      cell.alignment = headerAlignment;
      cell.border = borderThin;
    });

    // Column widths - wider for date columns and cumplimiento
    const colWidths = [14, 30, 12, 14, 8, 10, 18, 16, 18, 16, 18, 16, 20, 22, 45, 22];
    colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const bodyFont: Partial<ExcelJS.Font> = { size: 9, name: 'Calibri' };
    const bodyAlignment: Partial<ExcelJS.Alignment> = { vertical: 'top', wrapText: true };

    // Format dates as DD/MM/YYYY
    const fmtDate = (d?: string) => {
      if (!d) return '';
      const parts = d.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return d;
    };

    // Consolidate duplicates into single rows with multiple QA
    const consolidated = consolidateAtenciones(atenciones, columns);

    // Data rows
    for (const { atencion: a, qaNames } of consolidated) {
      const cycles = a.cycles ?? [];
      const ciclo = computeCicloActual(cycles);
      const analisis = findAnalisisCycle(cycles);
      const currentCx = findCurrentCxCycle(cycles);

      // DESA dates: from the "Análisis y Diseño" cycle
      // Planificada = startDate of Análisis, Real = realStartDate of Análisis
      const desaPlanificada = analisis?.startDate;
      const desaReal = analisis?.realStartDate;

      // Status text - no date, just execution + counters
      const st = a.status;
      const statusParts: string[] = [];
      statusParts.push(`Ejecución ${ciclo.current}`);
      if (st) {
        if (st.conforme != null) statusParts.push(`Conforme: ${st.conforme}`);
        if (st.enProceso != null) statusParts.push(`En proceso: ${st.enProceso}`);
        // Auto-calculate pendientes
        const computedPendientes = (a.totalCPs ?? 0) - ((st.conforme ?? 0) + (st.enProceso ?? 0) + (st.bloqueados ?? 0));
        if (a.totalCPs != null) statusParts.push(`Pendientes: ${Math.max(0, computedPendientes)}`);
        if (st.bloqueados != null) statusParts.push(`Bloqueados: ${st.bloqueados}`);
        if (st.defectos != null) statusParts.push(`Defectos: ${st.defectos}`);
      }

      // Comments - plain text (bold applied via richText below)
      const commentPlain = a.comments || '';
      const perfText = a.performanceComment || '';
      const secText = a.securityComment || '';

      const row = ws.addRow([
        a.code,
        a.description || '',
        a.aplicativo || '',
        a.estadoJira || '',
        a.totalCPs ?? '',
        ciclo.total > 0 ? ciclo.total : '',
        fmtDate(desaPlanificada),
        fmtDate(desaReal),
        fmtDate(currentCx?.startDate),
        fmtDate(currentCx?.realStartDate),
        fmtDate(currentCx?.endDate),
        fmtDate(currentCx?.realEndDate),
        '', // cumplimiento - filled with color below
        statusParts.join('\n'),
        '', // comments - set via richText below
        qaNames.join('\n'), // Multiple QA names on separate lines
      ]);

      // Dynamic row height based on status lines and QA names
      const statusLines = statusParts.length;
      const qaLines = qaNames.length;
      const maxLines = Math.max(statusLines, qaLines, 3);
      row.height = Math.max(45, maxLines * 15);
      row.eachCell((cell) => {
        cell.font = bodyFont;
        cell.alignment = bodyAlignment;
        cell.border = borderThin;
      });

      // Rich text for comments column (15) with bold labels
      const richParts: ExcelJS.RichText[] = [];
      if (commentPlain) {
        richParts.push({ text: commentPlain, font: { ...bodyFont } });
      }
      if (a.productionDate) {
        if (richParts.length > 0) richParts.push({ text: '\n', font: { ...bodyFont } });
        richParts.push({ text: 'Fecha de Pase a Producción Plan:', font: { ...bodyFont, bold: true } });
        richParts.push({ text: ` ${fmtDate(a.productionDate)}`, font: { ...bodyFont } });
      }
      if (perfText) {
        if (richParts.length > 0) richParts.push({ text: '\n', font: { ...bodyFont } });
        richParts.push({ text: 'Performance:', font: { ...bodyFont, bold: true } });
        richParts.push({ text: ` ${perfText}`, font: { ...bodyFont } });
      }
      if (secText) {
        if (richParts.length > 0) richParts.push({ text: '\n', font: { ...bodyFont } });
        richParts.push({ text: 'Seguridad:', font: { ...bodyFont, bold: true } });
        richParts.push({ text: ` ${secText}`, font: { ...bodyFont } });
      }
      if (richParts.length > 0) {
        row.getCell(15).value = { richText: richParts };
      }

      // Cumplimiento semaphore (column 13)
      const cumplCell = row.getCell(13);
      const delay = hasGlobalDelay(a);
      cumplCell.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: delay ? 'FFFF9999' : 'FF92D050' },
      };
    }

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Seguimiento_QA.xlsx');
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded hover:bg-primary/90 transition-colors"
    >
      <Download className="w-3.5 h-3.5" />
      Exportar Excel
    </button>
  );
}
