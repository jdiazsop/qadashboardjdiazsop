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

interface Props {
  atenciones: Atencion[];
  columns: KanbanColumn[];
}

export function ExportExcel({ atenciones, columns }: Props) {
  const handleExport = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Seguimiento QA');

    // Header style
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
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

    // Add header row
    const headerRow = ws.addRow(headers);
    headerRow.height = 40;
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = headerAlignment;
      cell.border = borderThin;
    });

    // Column widths
    const colWidths = [14, 30, 12, 14, 8, 10, 16, 16, 16, 16, 16, 16, 12, 22, 45, 20];
    colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const bodyFont: Partial<ExcelJS.Font> = { size: 9, name: 'Calibri' };
    const bodyAlignment: Partial<ExcelJS.Alignment> = { vertical: 'top', wrapText: true };

    // Data rows
    for (const a of atenciones) {
      const cycles = a.cycles ?? [];
      const ciclo = computeCicloActual(cycles);
      const analisis = findAnalisisCycle(cycles);
      const currentCx = findCurrentCxCycle(cycles);
      const colTitle = columns.find(c => c.id === a.columnId)?.title || '';

      // Status text
      const st = a.status;
      const statusParts: string[] = [];
      // Add date info from current cycle
      if (currentCx?.startDate) {
        const d = new Date(currentCx.startDate);
        statusParts.push(d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }));
      }
      statusParts.push(`Ejecución ${ciclo.current}`);
      if (st) {
        if (st.conforme != null) statusParts.push(`Conforme: ${st.conforme}`);
        if (st.enProceso != null) statusParts.push(`En proceso: ${st.enProceso}`);
        if (st.pendientes != null) statusParts.push(`Pendientes: ${st.pendientes}`);
        if (st.bloqueados != null) statusParts.push(`Bloqueados: ${st.bloqueados ?? 0}`);
        if (st.defectos != null) statusParts.push(`Defectos: ${st.defectos}`);
      }

      // Comments
      const commentParts: string[] = [];
      if (a.comments) commentParts.push(a.comments);
      if (a.performanceComment) commentParts.push(`\nPerformance: ${a.performanceComment}`);
      if (a.securityComment) commentParts.push(`\nSeguridad: ${a.securityComment}`);

      const row = ws.addRow([
        a.code,
        a.description || '',
        a.aplicativo || '',
        a.estadoJira || '',
        a.totalCPs ?? '',
        ciclo.total > 0 ? ciclo.total : '',
        analisis?.startDate || '',
        analisis?.realStartDate || '',
        currentCx?.startDate || '',
        currentCx?.realStartDate || '',
        currentCx?.endDate || '',
        currentCx?.realEndDate || '',
        '', // cumplimiento - filled with color below
        statusParts.join('\n'),
        commentParts.join(''),
        colTitle,
      ]);

      row.height = 60;
      row.eachCell((cell) => {
        cell.font = bodyFont;
        cell.alignment = bodyAlignment;
        cell.border = borderThin;
      });

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