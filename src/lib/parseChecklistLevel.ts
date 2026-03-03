export type ChecklistClassicResult = 'conforme' | 'no_conforme' | 'pendiente';
export type ChecklistLevel = 'alta' | 'baja';

export interface ChecklistDetection {
  result?: ChecklistClassicResult;
  level?: ChecklistLevel;
}

type Candidate = { level: ChecklistLevel; score: number; source: string; strongSignal?: boolean };
type HeaderMap = { row: number; resultCol: number; confidence: number };

const MARKER_REGEX = /^(x|✓|✔|si|sí|s|1|true|ok|v)$/i;
const RESULT_COLUMN_ALIASES = [
  'resultado',
  'resultado final',
  'resultado checklist',
  'prioridad',
  'prioridad rendimiento',
  'nivel',
  'nivel rendimiento',
];
const SUPPORTING_HEADER_ALIASES = ['pregunta', 'control', 'item', 'descripcion', 'criterio', 'estado'];

const normalizeText = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, ' ')
    .trim()
    .toLowerCase();

const defaultCellText = (cell: any): string => {
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
      if (typeof val.formula === 'string' && val.result != null) return toText(val.result);
    }
    return String(val);
  };

  const fromCellText = toText(cell?.text);
  if (fromCellText) return fromCellText.trim();

  const mergedMaster = cell?.isMerged ? cell?.master : undefined;
  const fromValue = toText(cell?.value ?? cell).trim();
  if (fromValue) return fromValue;
  if (mergedMaster) return toText(mergedMaster?.value ?? mergedMaster).trim();

  return '';
};

const extractUniqueLevel = (rawText: string): ChecklistLevel | undefined => {
  const normalized = normalizeText(rawText);
  if (!normalized) return undefined;
  if (normalized === 'alta' || normalized === 'baja') return normalized;

  const matches = (normalized.match(/\b(alta|baja)\b/g) ?? []) as ChecklistLevel[];
  const unique = [...new Set(matches)];
  return unique.length === 1 ? unique[0] : undefined;
};

const extractInlineLevel = (rawText: string): ChecklistLevel | undefined => {
  const normalized = normalizeText(rawText);
  if (!normalized) return undefined;

  const levels = [...new Set((normalized.match(/\b(alta|baja)\b/g) ?? []) as ChecklistLevel[])];
  if (levels.length !== 1) return undefined;

  const patterns = [
    /\bresultado(?:\s+final)?(?:\s+de\s+rendimiento)?\b[\s:;-]*(alta|baja)\b/,
    /\bprioridad(?:\s+de\s+rendimiento)?\b[\s:;-]*(alta|baja)\b/,
    /\bnivel(?:\s+de\s+rendimiento)?\b[\s:;-]*(alta|baja)\b/,
    /\b(alta|baja)\b[\s:;-]*\bresultado(?:\s+final)?\b/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1] === 'alta' || match?.[1] === 'baja') return match[1] as ChecklistLevel;
  }

  return undefined;
};

const parseClassicResult = (rawText: string): ChecklistClassicResult | undefined => {
  const normalized = normalizeText(rawText);
  if (normalized === 'conforme') return 'conforme';
  if (normalized === 'pendiente') return 'pendiente';
  if (normalized === 'no conforme' || normalized === 'no_conforme') return 'no_conforme';
  return undefined;
};

const findColumnIndex = (headers: string[], aliases: string[]): number => {
  const normalizedAliases = aliases.map(normalizeText);

  for (const alias of normalizedAliases) {
    const idx = headers.findIndex((h) => h === alias);
    if (idx !== -1) return idx;
  }

  for (const alias of normalizedAliases) {
    const idx = headers.findIndex((h) => h.startsWith(alias));
    if (idx !== -1) return idx;
  }

  for (const alias of normalizedAliases) {
    const idx = headers.findIndex((h) => h.includes(alias));
    if (idx !== -1) return idx;
  }

  return -1;
};

const hasVisualSignal = (cell: any): number => {
  let score = 0;
  const fill = cell?.fill;
  if (fill && (fill.fgColor || fill.bgColor || (fill.pattern && fill.pattern !== 'none'))) score += 140;
  if (cell?.font?.bold) score += 30;
  return score;
};

const readCell = (ws: any, row: number, col: number) => {
  if (row < 1 || col < 1) return undefined;
  const r = ws.getRow?.(row);
  return r?.getCell?.(col);
};

const detectFromFixedResultCellE22 = (ws: any, cellText: (cell: any) => string): Candidate | undefined => {
  const cell = readCell(ws, 22, 5); // E22
  if (!cell) return undefined;

  const candidates = new Set<string>();
  const add = (val: any) => {
    if (val == null) return;
    const txt = String(val).trim();
    if (txt) candidates.add(txt);
  };

  add(cellText(cell));

  const mergedMaster = cell?.isMerged ? cell?.master : undefined;
  if (mergedMaster) add(cellText(mergedMaster));

  const value = cell?.value;
  if (value && typeof value === 'object') {
    add((value as any).result);
    add((value as any).formula);
  }

  const masterValue = mergedMaster?.value;
  if (masterValue && typeof masterValue === 'object') {
    add((masterValue as any).result);
    add((masterValue as any).formula);
  }

  for (const raw of candidates) {
    const level = extractUniqueLevel(raw) ?? extractInlineLevel(raw);
    if (!level) continue;

    return {
      level,
      score: 3000,
      source: 'fixed_cell_e22',
      strongSignal: true,
    };
  }

  return undefined;
};

const hasNearbyMarker = (ws: any, row: number, col: number, cellText: (cell: any) => string): boolean => {
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 2; c <= col + 2; c++) {
      const cell = readCell(ws, r, c);
      if (!cell) continue;
      const text = normalizeText(cellText(cell));
      if (MARKER_REGEX.test(text)) return true;
    }
  }
  return false;
};

const pickBest = (best: Candidate | undefined, candidate: Candidate | undefined): Candidate | undefined => {
  if (!candidate) return best;
  if (!best) return candidate;
  return candidate.score > best.score ? candidate : best;
};

const buildResultColumnMap = (ws: any, cellText: (cell: any) => string): HeaderMap | undefined => {
  let best: HeaderMap | undefined;
  const scanRows = Math.max(1, Math.min(ws.rowCount ?? 1, 15));

  for (let rowNumber = 1; rowNumber <= scanRows; rowNumber++) {
    const row = ws.getRow?.(rowNumber);
    if (!row) continue;

    const headers: string[] = [];
    let maxCol = 0;
    row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
      headers[colNumber - 1] = normalizeText(cellText(cell));
      if (colNumber > maxCol) maxCol = colNumber;
    });

    if (maxCol === 0) continue;

    const nonEmpty = headers.filter(Boolean);
    if (nonEmpty.length < 2) continue;

    const resultIdx = findColumnIndex(headers, RESULT_COLUMN_ALIASES);
    if (resultIdx === -1) continue;

    const resultHeader = headers[resultIdx] ?? '';
    let confidence = 600;

    if (resultHeader === 'resultado' || resultHeader === 'resultado final') confidence += 140;
    else if (resultHeader.startsWith('resultado')) confidence += 110;
    else if (resultHeader.includes('resultado')) confidence += 90;
    else confidence += 45;

    const supportHits = SUPPORTING_HEADER_ALIASES.filter((alias) => headers.some((h) => h.includes(alias))).length;
    confidence += supportHits * 30;
    if (nonEmpty.length >= 4) confidence += 30;

    const candidate: HeaderMap = { row: rowNumber, resultCol: resultIdx + 1, confidence };
    if (!best || candidate.confidence > best.confidence) best = candidate;
  }

  return best;
};

const detectFromMappedResultColumn = (ws: any, cellText: (cell: any) => string): Candidate | undefined => {
  const headerMap = buildResultColumnMap(ws, cellText);
  if (!headerMap) return undefined;

  const candidates: Candidate[] = [];
  let emptyStreak = 0;
  const maxRow = Math.min(ws.rowCount ?? headerMap.row, headerMap.row + 250);

  for (let rowNumber = headerMap.row + 1; rowNumber <= maxRow; rowNumber++) {
    const resultCell = readCell(ws, rowNumber, headerMap.resultCol);
    if (!resultCell) continue;

    const raw = cellText(resultCell);
    const value = normalizeText(raw);
    if (!value) {
      emptyStreak += 1;
      if (emptyStreak >= 15) break;
      continue;
    }
    emptyStreak = 0;

    // Ignorar texto ambiguo tipo "Alta o Baja"
    if (value.includes('alta') && value.includes('baja')) continue;

    const level = extractUniqueLevel(value);
    if (!level) continue;

    const visual = hasVisualSignal(resultCell);
    const nearMarker = hasNearbyMarker(ws, rowNumber, headerMap.resultCol, cellText);

    let score = headerMap.confidence + 280;
    if (value === level) score += 90;
    else score += 30;

    score += visual;
    if (nearMarker) score += 200;

    let rowContext = '';
    let sameRowAlta = false;
    let sameRowBaja = false;

    for (let c = Math.max(1, headerMap.resultCol - 3); c <= headerMap.resultCol + 2; c++) {
      const txt = normalizeText(cellText(readCell(ws, rowNumber, c)));
      rowContext += ` ${txt}`;
      if (txt === 'alta') sameRowAlta = true;
      if (txt === 'baja') sameRowBaja = true;
    }

    if (rowContext.includes('resultado final')) score += 90;
    else if (rowContext.includes('resultado') || rowContext.includes('prioridad')) score += 50;
    if (rowContext.includes('checklist') && rowContext.includes('rendimiento')) score += 25;

    const strongSignal = nearMarker || visual > 0 || rowContext.includes('resultado final');

    // Si la fila muestra ALTA y BAJA como opciones, exigir señal fuerte
    if (sameRowAlta && sameRowBaja && !strongSignal) continue;

    candidates.push({ level, score, source: 'mapped_result_column', strongSignal });
  }

  if (candidates.length === 0) return undefined;

  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const top = sorted[0];

  const topAlta = sorted.find((c) => c.level === 'alta');
  const topBaja = sorted.find((c) => c.level === 'baja');

  // Si existen ambas opciones con puntajes cercanos, tratarlo como ambiguo
  if (topAlta && topBaja) {
    const diff = Math.abs(topAlta.score - topBaja.score);
    if (diff < 120) return undefined;

    // Si gana por poco y sin señal fuerte, no confiar
    if (!top.strongSignal && diff < 200) return undefined;
  }

  return top;
};

const detectFromBinaryRowSelection = (ws: any, cellText: (cell: any) => string): Candidate | undefined => {
  let best: Candidate | undefined;

  ws.eachRow((row: any, rowNumber: number) => {
    const rowLevels: Array<{ level: ChecklistLevel; col: number; cell: any }> = [];

    row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
      const normalized = normalizeText(cellText(cell));
      if (normalized === 'alta' || normalized === 'baja') rowLevels.push({ level: normalized, col: colNumber, cell });
    });

    const hasAlta = rowLevels.some((l) => l.level === 'alta');
    const hasBaja = rowLevels.some((l) => l.level === 'baja');
    if (!hasAlta || !hasBaja) return;

    for (const entry of rowLevels) {
      const nearMarker = hasNearbyMarker(ws, rowNumber, entry.col, cellText);
      const visual = hasVisualSignal(entry.cell);
      if (!nearMarker && visual === 0) continue;

      let score = 220 + visual;
      if (nearMarker) score += 140;

      const leftText = normalizeText(cellText(readCell(ws, rowNumber, Math.max(1, entry.col - 1))));
      const farLeftText = normalizeText(cellText(readCell(ws, rowNumber, Math.max(1, entry.col - 2))));
      const context = `${leftText} ${farLeftText}`;

      if (context.includes('resultado') || context.includes('prioridad')) score += 50;
      if (context.includes('checklist') && context.includes('rendimiento')) score += 20;

      best = pickBest(best, { level: entry.level, score, source: 'binary_row_selection' });
    }
  });

  return best;
};

const detectFromInlineLabels = (ws: any, cellText: (cell: any) => string): Candidate | undefined => {
  let best: Candidate | undefined;

  ws.eachRow((row: any, rowNumber: number) => {
    row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
      const inlineLevel = extractInlineLevel(cellText(cell));
      if (!inlineLevel) return;

      let score = 180;
      score += hasVisualSignal(cell);
      if (hasNearbyMarker(ws, rowNumber, colNumber, cellText)) score += 70;

      best = pickBest(best, { level: inlineLevel, score, source: 'inline_label' });
    });
  });

  return best;
};

const detectNearAnchors = (ws: any, cellText: (cell: any) => string): Candidate | undefined => {
  const anchors: Array<{ row: number; col: number; weight: number }> = [];
  const levels: Array<{ row: number; col: number; cell: any; level: ChecklistLevel }> = [];

  ws.eachRow((row: any, rowNumber: number) => {
    row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
      const text = normalizeText(cellText(cell));
      if (!text) return;

      if (text.includes('resultado final')) anchors.push({ row: rowNumber, col: colNumber, weight: 220 });
      else if (text.includes('resultado')) anchors.push({ row: rowNumber, col: colNumber, weight: 190 });
      else if (text.includes('prioridad')) anchors.push({ row: rowNumber, col: colNumber, weight: 160 });

      const level = extractUniqueLevel(text);
      if (!level) return;
      levels.push({ row: rowNumber, col: colNumber, cell, level });
    });
  });

  if (anchors.length === 0 || levels.length === 0) return undefined;

  let best: Candidate | undefined;
  for (const lvl of levels) {
    let anchorScore = -Infinity;
    for (const anchor of anchors) {
      const dist = Math.abs(lvl.row - anchor.row) + Math.abs(lvl.col - anchor.col);
      if (dist > 8) continue;
      anchorScore = Math.max(anchorScore, anchor.weight + Math.max(0, 24 - dist));
    }

    if (anchorScore === -Infinity) continue;

    let score = anchorScore;
    score += hasVisualSignal(lvl.cell);
    if (hasNearbyMarker(ws, lvl.row, lvl.col, cellText)) score += 90;

    best = pickBest(best, { level: lvl.level, score, source: 'anchor_proximity' });
  }

  return best;
};

export function detectChecklistOutcome(
  workbook: any,
  cellText: (cell: any) => string = defaultCellText,
): ChecklistDetection {
  if (!workbook?.worksheets?.length) return {};

  // 1) Prioridad absoluta: celda E22 (resultado por fórmula en plantilla)
  let fixedE22Best: Candidate | undefined;
  for (const ws of workbook.worksheets) {
    fixedE22Best = pickBest(fixedE22Best, detectFromFixedResultCellE22(ws, cellText));
  }
  if (fixedE22Best) {
    console.info(`[checklist-parser] nivel=${fixedE22Best.level} source=${fixedE22Best.source}`);
    return { level: fixedE22Best.level };
  }

  // 2) Resultado clásico: conforme/no conforme/pendiente
  for (const ws of workbook.worksheets) {
    let found: ChecklistClassicResult | undefined;
    ws.eachRow((row: any) => {
      if (found) return;
      row.eachCell({ includeEmpty: true }, (cell: any) => {
        if (found) return;
        found = parseClassicResult(cellText(cell));
      });
    });
    if (found) return { result: found };
  }

  // 3) Prioridad estricta: columna Resultado mapeada dinámicamente
  let mappedBest: Candidate | undefined;
  let hasMappedHeader = false;
  for (const ws of workbook.worksheets) {
    const hasHeaderInSheet = Boolean(buildResultColumnMap(ws, cellText));
    if (hasHeaderInSheet) hasMappedHeader = true;
    mappedBest = pickBest(mappedBest, detectFromMappedResultColumn(ws, cellText));
  }
  if (mappedBest) {
    console.info(`[checklist-parser] nivel=${mappedBest.level} source=${mappedBest.source}`);
    return { level: mappedBest.level };
  }

  // Si existe columna Resultado pero no hubo evidencia sólida,
  // permitir solo fallback binario (marcado visual) y bloquear inferencias débiles.
  if (hasMappedHeader) {
    let binaryBest: Candidate | undefined;
    for (const ws of workbook.worksheets) {
      binaryBest = pickBest(binaryBest, detectFromBinaryRowSelection(ws, cellText));
    }

    if (binaryBest) {
      console.info(`[checklist-parser] nivel=${binaryBest.level} source=${binaryBest.source}`);
      return { level: binaryBest.level };
    }

    return {};
  }

  // 4) Fallbacks (más conservadores)
  let fallbackBest: Candidate | undefined;
  for (const ws of workbook.worksheets) {
    fallbackBest = pickBest(fallbackBest, detectFromBinaryRowSelection(ws, cellText));
    fallbackBest = pickBest(fallbackBest, detectFromInlineLabels(ws, cellText));
    fallbackBest = pickBest(fallbackBest, detectNearAnchors(ws, cellText));
  }

  if (fallbackBest) {
    console.info(`[checklist-parser] nivel=${fallbackBest.level} source=${fallbackBest.source}`);
    return { level: fallbackBest.level };
  }

  return {};
}
