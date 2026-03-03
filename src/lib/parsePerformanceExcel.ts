import ExcelJS from 'exceljs';
import type { PerformanceAcceptanceCriteria } from '@/types/qa';

/**
 * Parse the performance relevamiento Excel matrix
 * and extract acceptance criteria fields.
 */
export async function parsePerformanceExcel(file: File): Promise<PerformanceAcceptanceCriteria> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const criteria: PerformanceAcceptanceCriteria = {};

  // Search all worksheets for known labels
  workbook.eachSheet((sheet) => {
    const columnHints = detectColumnHints(sheet);

    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[colNumber] = String(cell.value ?? '').trim();
      });

      for (let i = 1; i <= cells.length; i++) {
        const label = (cells[i] ?? '').toLowerCase();
        if (!label) continue;

        if (label.includes('método http') || label.includes('metodo http') || label === 'método' || label === 'metodo') {
          const value = pickBestValue(cells, i, columnHints, false);
          if (value) criteria.method = value;
        } else if (label.includes('nombre del api') || label.includes('nombre del servicio')) {
          const value = pickBestValue(cells, i, columnHints, false);
          if (value) criteria.apiName = value;
        } else if (label.includes('endpoint') || label.includes('url')) {
          const value = pickBestValue(cells, i, columnHints, false);
          if (value) criteria.endpoint = value;
        } else if (label.includes('usuarios únicos mensuales') || label.includes('usuarios unicos mensuales')) {
          const value = pickBestValue(cells, i, columnHints, true);
          criteria.monthlyUsers = parseNum(value);
        } else if (label.includes('solicitudes promedio por día') || label.includes('solicitudes promedio por dia')) {
          const value = pickBestValue(cells, i, columnHints, true);
          criteria.avgDailyRequests = parseNum(value);
        } else if (label.includes('solicitudes pico por hora')) {
          const value = pickBestValue(cells, i, columnHints, true);
          criteria.peakHourRequests = parseNum(value);
        } else if (label.includes('solicitudes pico por minuto')) {
          const value = pickBestValue(cells, i, columnHints, true);
          criteria.peakMinuteRequests = parseNum(value);
        } else if ((label.includes('aplicaciones impactadas') && (label.includes('n°') || label.includes('número') || label.includes('numero'))) || label.includes('número de aplicaciones')) {
          const value = pickBestValue(cells, i, columnHints, true);
          criteria.impactedApps = parseNum(value);
        } else if (label.includes('nombres de aplicaciones impactadas') || label.includes('nombre de aplicaciones impactadas')) {
          const value = pickBestValue(cells, i, columnHints, false);
          if (value) criteria.impactedAppNames = value;
        } else if (label.includes('horario pico')) {
          const value = pickBestValue(cells, i, columnHints, false);
          if (value) criteria.peakUsageTime = value;
        } else if (label.includes('microservicios involucrados') && (label.includes('n°') || label.includes('número') || label.includes('numero'))) {
          const value = pickBestValue(cells, i, columnHints, true);
          criteria.microservices = parseNum(value);
        } else if (label.includes('parámetros de entrada') || label.includes('parametros de entrada')) {
          const value = pickBestValue(cells, i, columnHints, true);
          criteria.inputParams = parseNum(value);
        } else if (label.includes('sla') && label.includes('tiempo')) {
          const value = pickBestValue(cells, i, columnHints, false);
          if (value) criteria.slaMaxResponse = value;
        } else if (label.includes('tasa máxima de error') || label.includes('tasa maxima de error')) {
          const value = pickBestValue(cells, i, columnHints, false);
          if (value) criteria.maxErrorRate = value;
        } else if (label.includes('throughput') && (label.includes('mínimo') || label.includes('minimo'))) {
          const value = pickBestValue(cells, i, columnHints, false);
          if (value) criteria.minThroughput = value;
        } else if (label.includes('volumen de datos')) {
          const value = pickBestValue(cells, i, columnHints, false);
          if (value) criteria.dataVolume = value;
        }
      }
    });
  });

  return criteria;
}

type ColumnHints = {
  descriptionCol?: number;
  referenceCol?: number;
};

function detectColumnHints(sheet: ExcelJS.Worksheet): ColumnHints {
  let descriptionCol: number | undefined;
  let referenceCol: number | undefined;

  sheet.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const text = normalizeText(String(cell.value ?? ''));
      if (!text) return;

      if (!descriptionCol && text.includes('descripcion')) {
        descriptionCol = colNumber;
      }

      if (!referenceCol && (text.includes('ejemplo de referencia') || text === 'referencia')) {
        referenceCol = colNumber;
      }
    });
  });

  return { descriptionCol, referenceCol };
}

function pickBestValue(cells: string[], labelCol: number, hints: ColumnHints, preferNumeric: boolean): string {
  const candidates: Array<{ col: number; value: string }> = [];

  if (hints.referenceCol && hints.referenceCol !== labelCol) {
    candidates.push({ col: hints.referenceCol, value: (cells[hints.referenceCol] ?? '').trim() });
  }

  for (const offset of [1, 2, 3]) {
    const col = labelCol + offset;
    if (!col) continue;
    candidates.push({ col, value: (cells[col] ?? '').trim() });
  }

  const uniqueCandidates = candidates
    .filter((c, idx, arr) => arr.findIndex((x) => x.col === c.col) === idx)
    .filter((c) => c.value.length > 0);

  if (uniqueCandidates.length === 0) return '';

  if (preferNumeric) {
    const numericCandidate = uniqueCandidates.find((c) => parseNum(c.value) !== undefined);
    if (numericCandidate) return numericCandidate.value;
  }

  const filtered = uniqueCandidates.filter((c) => {
    if (hints.descriptionCol && c.col === hints.descriptionCol && uniqueCandidates.length > 1) return false;
    return !isLikelyDescription(c.value, preferNumeric) || uniqueCandidates.length === 1;
  });

  return (filtered[0] ?? uniqueCandidates[0]).value;
}

function isLikelyDescription(value: string, preferNumeric: boolean): boolean {
  const text = normalizeText(value);
  if (!text) return true;

  if (preferNumeric) {
    return parseNum(value) === undefined;
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hasDigits = /\d/.test(text);
  const descriptionHints = [
    'tipo de',
    'direccion completa',
    'total de',
    'cantidad',
    'porcentaje',
    'franja',
    'numero de',
    'lista de',
    'estructura',
    'componentes',
    'contacto',
    'ambiente',
    'limite',
  ];

  return wordCount >= 6 && !hasDigits && descriptionHints.some((hint) => text.includes(hint));
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNum(val: string): number | undefined {
  const token = val.replace(/[^\d.,-]/g, '').match(/-?\d[\d.,]*/)?.[0];
  if (!token) return undefined;

  let normalized = token;
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = normalized.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      normalized = normalized.replace(/,/g, '');
    } else {
      normalized = normalized.replace(',', '.');
    }
  } else if (hasDot) {
    const parts = normalized.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      normalized = normalized.replace(/\./g, '');
    }
  }

  const num = parseFloat(normalized);
  return isNaN(num) ? undefined : num;
}

