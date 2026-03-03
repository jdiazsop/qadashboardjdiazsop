export type ChecklistClassicResult = 'conforme' | 'no_conforme' | 'pendiente';
export type ChecklistLevel = 'alta' | 'baja';

export interface ChecklistDetection {
  result?: ChecklistClassicResult;
  level?: ChecklistLevel;
}

type Candidate = { level: ChecklistLevel; score: number };

const LEVEL_REGEX = /\b(alta|baja)\b/g;
const MARKER_REGEX = /^(x|✓|✔|si|sí|s|1|true|ok|v)$/i;

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
  return toText(cell?.value ?? cell).trim();
};

const extractUniqueLevel = (rawText: string): ChecklistLevel | undefined => {
  const normalized = normalizeText(rawText);
  if (!normalized) return undefined;
  if (normalized === 'alta' || normalized === 'baja') return normalized;

  const matches = [...normalized.matchAll(LEVEL_REGEX)].map((m) => m[1] as ChecklistLevel);
  const unique = [...new Set(matches)];
  return unique.length === 1 ? unique[0] : undefined;
};

const extractInlineLevel = (rawText: string): ChecklistLevel | undefined => {
  const normalized = normalizeText(rawText);
  if (!normalized) return undefined;

  const levels = [...new Set([...normalized.matchAll(LEVEL_REGEX)].map((m) => m[1] as ChecklistLevel))];
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

  // 1) Exact match
  for (const alias of normalizedAliases) {
    const idx = headers.findIndex((h) => h === alias);
    if (idx !== -1) return idx;
  }

  // 2) Starts with
  for (const alias of normalizedAliases) {
    const idx = headers.findIndex((h) => h.startsWith(alias));
    if (idx !== -1) return idx;
  }

  // 3) Contains
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

const detectFromResultColumn = (ws: any, cellText: (cell: any) => string): Candidate | undefined => {
  let best: Candidate | undefined;

  ws.eachRow((row: any, rowNumber: number) => {
    const headers: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
      headers[colNumber - 1] = normalizeText(cellText(cell));
    });

    if (headers.length === 0) return;
    const resultCol = findColumnIndex(headers, [
      'resultado',
      'resultado final',
      'resultado checklist',
      'prioridad',
      'prioridad rendimiento',
      'nivel',
      'nivel rendimiento',
    ]);
    if (resultCol === -1) return;

    const targetCol = resultCol + 1;
    let emptyStreak = 0;

    for (let r = rowNumber + 1; r <= Math.min((ws.rowCount ?? rowNumber) + 1, rowNumber + 80); r++) {
      const resultCell = readCell(ws, r, targetCol);
      if (!resultCell) continue;

      const value = normalizeText(cellText(resultCell));
      if (!value) {
        emptyStreak += 1;
        if (emptyStreak >= 8) break;
        continue;
      }
      emptyStreak = 0;

      const level = extractUniqueLevel(value);
      if (!level) continue;

      let score = 480;
      if (value === level) score += 100;
      if (value.includes('alta') && value.includes('baja')) score -= 260;

      let context = '';
      for (let c = Math.max(1, targetCol - 2); c <= targetCol + 1; c++) {
        context += ` ${normalizeText(cellText(readCell(ws, r, c)))}`;
      }

      if (context.includes('rendimiento')) score += 40;
      if (context.includes('resultado') || context.includes('prioridad')) score += 30;

      score += hasVisualSignal(resultCell);
      if (hasNearbyMarker(ws, r, targetCol, cellText)) score += 170;

      best = pickBest(best, { level, score });
    }
  });

  return best;
};

const detectFromBinaryRowSelection = (ws: any, cellText: (cell: any) => string): Candidate | undefined => {
  let best: Candidate | undefined;

  ws.eachRow((row: any, rowNumber: number) => {
    const rowLevels: Array<{ level: ChecklistLevel; col: number; cell: any; text: string }> = [];

    row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
      const raw = cellText(cell);
      const normalized = normalizeText(raw);
      if (normalized === 'alta' || normalized === 'baja') {
        rowLevels.push({ level: normalized, col: colNumber, cell, text: normalized });
      }
    });

    const hasAlta = rowLevels.some((l) => l.level === 'alta');
    const hasBaja = rowLevels.some((l) => l.level === 'baja');
    if (!hasAlta || !hasBaja) return;

    for (const entry of rowLevels) {
      let score = 560;
      score += hasVisualSignal(entry.cell);
      if (hasNearbyMarker(ws, rowNumber, entry.col, cellText)) score += 170;

      const labelCell = readCell(ws, rowNumber, Math.max(1, entry.col - 2));
      const labelText = normalizeText(cellText(labelCell));
      if (labelText.includes('resultado') || labelText.includes('prioridad')) score += 40;

      best = pickBest(best, { level: entry.level, score });
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

      let score = 360;
      score += hasVisualSignal(cell);
      if (hasNearbyMarker(ws, rowNumber, colNumber, cellText)) score += 90;

      best = pickBest(best, { level: inlineLevel, score });
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

      if (text.includes('resultado final')) anchors.push({ row: rowNumber, col: colNumber, weight: 320 });
      else if (text.includes('resultado')) anchors.push({ row: rowNumber, col: colNumber, weight: 280 });
      else if (text.includes('prioridad')) anchors.push({ row: rowNumber, col: colNumber, weight: 230 });
      else if (text.includes('checklist') && text.includes('rendimiento')) anchors.push({ row: rowNumber, col: colNumber, weight: 180 });

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
      if (dist > 14) continue;
      anchorScore = Math.max(anchorScore, anchor.weight + Math.max(0, 32 - dist));
    }

    if (anchorScore === -Infinity) continue;

    let score = anchorScore;
    score += hasVisualSignal(lvl.cell);
    if (hasNearbyMarker(ws, lvl.row, lvl.col, cellText)) score += 120;

    best = pickBest(best, { level: lvl.level, score });
  }

  return best;
};

export function detectChecklistOutcome(
  workbook: any,
  cellText: (cell: any) => string = defaultCellText,
): ChecklistDetection {
  if (!workbook?.worksheets?.length) return {};

  // 1) Classic checklist values
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

  // 2) Alta/Baja with prioritized strategies
  let best: Candidate | undefined;
  for (const ws of workbook.worksheets) {
    best = pickBest(best, detectFromResultColumn(ws, cellText));
    best = pickBest(best, detectFromBinaryRowSelection(ws, cellText));
    best = pickBest(best, detectFromInlineLabels(ws, cellText));
    best = pickBest(best, detectNearAnchors(ws, cellText));
  }

  return best ? { level: best.level } : {};
}
