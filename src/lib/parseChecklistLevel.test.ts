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

  it('si hay columna Resultado explícita, gana sobre opciones ALTA/BAJA en otra zona', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Real');

    ws.getCell('A3').value = 'Item';
    ws.getCell('B3').value = 'Resultado';
    ws.getCell('C3').value = 'Marca';

    ws.getCell('A4').value = 'Checklist de rendimiento';
    ws.getCell('B4').value = 'BAJA';
    ws.getCell('C4').value = 'X';

    // Zona de opciones visuales que no debe dominar
    ws.getCell('H10').value = 'Resultado final';
    ws.getCell('I10').value = 'ALTA';
    ws.getCell('J10').value = 'BAJA';
    ws.getCell('I10').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00AA00' },
    };

    const detected = detectChecklistOutcome(wb);
    expect(detected.level).toBe('baja');
  });

  it('si columna Resultado tiene ALTA y BAJA con puntaje similar y sin señal fuerte, no fuerza ALTA', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Ambiguo');

    ws.getCell('A1').value = 'Item';
    ws.getCell('B1').value = 'Resultado';

    ws.getCell('A2').value = 'Fila 1';
    ws.getCell('B2').value = 'ALTA';

    ws.getCell('A3').value = 'Fila 2';
    ws.getCell('B3').value = 'BAJA';

    const detected = detectChecklistOutcome(wb);
    expect(detected.level).toBeUndefined();
  });
});
