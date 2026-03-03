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
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[colNumber] = String(cell.value ?? '').trim();
      });

      // Find label-value pairs: label in col B/C, value in col D/E/F
      for (let i = 1; i <= cells.length; i++) {
        const label = (cells[i] ?? '').toLowerCase();
        // Look for value in adjacent columns
        const value = cells[i + 1] ?? cells[i + 2] ?? '';

        if (!label || !value) continue;

        if (label.includes('método http') || label === 'método') {
          criteria.method = value;
        } else if (label.includes('nombre del api') || label.includes('nombre del servicio')) {
          criteria.apiName = value;
        } else if (label.includes('endpoint') || label.includes('url')) {
          criteria.endpoint = value;
        } else if (label.includes('usuarios únicos mensuales') || label.includes('usuarios unicos mensuales')) {
          criteria.monthlyUsers = parseNum(value);
        } else if (label.includes('solicitudes promedio por día') || label.includes('solicitudes promedio por dia')) {
          criteria.avgDailyRequests = parseNum(value);
        } else if (label.includes('solicitudes pico por hora')) {
          criteria.peakHourRequests = parseNum(value);
        } else if (label.includes('solicitudes pico por minuto')) {
          criteria.peakMinuteRequests = parseNum(value);
        } else if (label.includes('aplicaciones impactadas') && label.includes('n°') || label.includes('número de aplicaciones')) {
          criteria.impactedApps = parseNum(value);
        } else if (label.includes('nombres de aplicaciones impactadas') || label.includes('nombre de aplicaciones impactadas')) {
          criteria.impactedAppNames = value;
        } else if (label.includes('horario pico')) {
          criteria.peakUsageTime = value;
        } else if (label.includes('microservicios involucrados') && (label.includes('n°') || label.includes('número'))) {
          criteria.microservices = parseNum(value);
        } else if (label.includes('parámetros de entrada') || label.includes('parametros de entrada')) {
          criteria.inputParams = parseNum(value);
        } else if (label.includes('sla') && label.includes('tiempo')) {
          criteria.slaMaxResponse = value;
        } else if (label.includes('tasa máxima de error') || label.includes('tasa maxima de error')) {
          criteria.maxErrorRate = value;
        } else if (label.includes('throughput') && label.includes('mínimo') || label.includes('throughput') && label.includes('minimo')) {
          criteria.minThroughput = value;
        } else if (label.includes('volumen de datos')) {
          criteria.dataVolume = value;
        }
      }
    });
  });

  return criteria;
}

function parseNum(val: string): number | undefined {
  const cleaned = val.replace(/[^\d.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}
