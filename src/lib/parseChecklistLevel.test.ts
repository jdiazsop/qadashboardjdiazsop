import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { detectChecklistOutcome } from '@/lib/parseChecklistLevel';

describe('detectChecklistOutcome', () => {
  it('prioriza la columna Resultado y no toma ALTA de otras celdas', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Checklist');

    ws.getCell('A1').value = 'Control';
    ws.getCell('B1').value = 'Resultado';
    ws.getCell('C1').value = 'Marca';

    ws.getCell('A2').value = 'Pruebas de rendimiento';
    ws.getCell('B2').value = 'BAJA';
    ws.getCell('C2').value = 'X';

    // Ruido que antes podía sesgar la detección
    ws.getCell('F20').value = 'ALTA';
    ws.getCell('A30').value = 'Checklist de rendimiento (Alta o Baja)';

    const detected = detectChecklistOutcome(wb);
    expect(detected.level).toBe('baja');
  });

  it('detecta selección binaria en fila ALTA/BAJA con formato visual', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Binario');

    ws.getCell('A5').value = 'Resultado final';
    ws.getCell('B5').value = 'ALTA';
    ws.getCell('C5').value = 'BAJA';

    ws.getCell('C5').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFAA00' },
    };

    const detected = detectChecklistOutcome(wb);
    expect(detected.level).toBe('baja');
  });

  it('detecta resultado inline explícito', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Inline');

    ws.getCell('A1').value = 'Resultado final de rendimiento: ALTA';

    const detected = detectChecklistOutcome(wb);
    expect(detected.level).toBe('alta');
  });

  it('detecta resultado clásico conforme/no conforme/pendiente primero', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Clasico');

    ws.getCell('B8').value = 'no conforme';

    const detected = detectChecklistOutcome(wb);
    expect(detected.result).toBe('no_conforme');
    expect(detected.level).toBeUndefined();
  });
});
