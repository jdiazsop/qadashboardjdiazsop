import React, { useMemo, useCallback } from 'react';
import { Atencion, TestCycle, getPeruHolidays, isBusinessDay } from '@/types/qa';

interface Props {
  atenciones: Atencion[];
  onUpdateAtencion?: (a: Atencion) => void;
}

const CYCLE_PATTERN = /^(C\d+|UAT)$/i;
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function getBusinessDaysList(start: Date, end: Date, holidays: Set<string>): Date[] {
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (isBusinessDay(cursor, holidays)) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function getAllCalendarDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface DailyEntry {
  casesPerQA: number;
  cumulative: number;
}

interface RowData {
  label: string;
  type: 'planned' | 'real' | 'diff';
  businessDays: number;
  casesPerQAPerDay: number;
  dailyMap: Map<string, DailyEntry>;
}

interface CycleGroup {
  atencionCode: string;
  atencionId: string;
  cycleId: string;
  cycleLabel: string;
  totalCPs: number;
  qaCount: number;
  conformes: number;
  rows: RowData[];
  /** Business day keys where Real row cells should be editable */
  editableDays: string[];
  dailyConformes: Record<string, number>;
}

function buildDistributionMap(
  bizDays: Date[],
  totalToDistribute: number,
  qaCount: number,
): { dailyMap: Map<string, DailyEntry>; cpsPerQAPerDay: number } {
  if (bizDays.length === 0 || totalToDistribute <= 0) {
    return { dailyMap: new Map(), cpsPerQAPerDay: 0 };
  }
  const cpsPerQAPerDay = Math.ceil(totalToDistribute / (bizDays.length * qaCount));
  const totalPerDay = cpsPerQAPerDay * qaCount;
  const dailyMap = new Map<string, DailyEntry>();
  let cum = 0;
  bizDays.forEach((d, i) => {
    const isLast = i === bizDays.length - 1;
    const dayTarget = isLast
      ? totalToDistribute - cum
      : Math.min(totalPerDay, totalToDistribute - cum);
    cum += dayTarget;
    dailyMap.set(dateKey(d), {
      casesPerQA: dayTarget,
      cumulative: cum,
    });
  });
  return { dailyMap, cpsPerQAPerDay };
}

/** Build real row from dailyConformes record */
function buildRealFromDaily(
  dailyConformes: Record<string, number>,
): Map<string, DailyEntry> {
  const dailyMap = new Map<string, DailyEntry>();
  // Sort dates to compute cumulative
  const sortedDates = Object.keys(dailyConformes).sort();
  let cum = 0;
  for (const dk of sortedDates) {
    const val = dailyConformes[dk] || 0;
    if (val > 0) {
      cum += val;
      dailyMap.set(dk, { casesPerQA: val, cumulative: cum });
    }
  }
  return dailyMap;
}

export function TestSchedule({ atenciones, onUpdateAtencion }: Props) {
  const { groups, allDays, holidays, monthHeaders } = useMemo(() => {
    const seen = new Set<string>();
    const unique = atenciones.filter(a => {
      const key = a.sourceId || a.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const allYears = new Set<number>();
    let globalMin: Date | null = null;
    let globalMax: Date | null = null;

    const updateRange = (ds: string) => {
      const d = new Date(ds + 'T12:00:00');
      if (isNaN(d.getTime())) return;
      allYears.add(d.getFullYear());
      if (!globalMin || d < globalMin) globalMin = new Date(d);
      if (!globalMax || d > globalMax) globalMax = new Date(d);
    };

    unique.forEach(a => {
      a.cycles?.forEach(c => {
        if (!CYCLE_PATTERN.test(c.label.trim())) return;
        if ((c.totalCPs || 0) <= 0) return;
        if (c.startDate) updateRange(c.startDate);
        if (c.endDate) updateRange(c.endDate);
        if (c.realStartDate) updateRange(c.realStartDate);
      });
    });

    if (!globalMin || !globalMax) {
      return { groups: [] as CycleGroup[], allDays: [] as Date[], holidays: new Set<string>(), monthHeaders: [] as { label: string; span: number }[] };
    }

    // Extend globalMax to today if needed (so we can edit today's cell)
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    if (today > globalMax) globalMax = today;

    if (allYears.size === 0) allYears.add(new Date().getFullYear());
    allYears.add(today.getFullYear());
    const hol = new Set<string>();
    allYears.forEach(y => getPeruHolidays(y).forEach(h => hol.add(h)));

    const allDays = getAllCalendarDays(globalMin, globalMax);

    const mHeaders: { label: string; span: number }[] = [];
    let curMonth = -1;
    let curYear = -1;
    for (const d of allDays) {
      const m = d.getMonth();
      const y = d.getFullYear();
      if (m === curMonth && y === curYear) {
        mHeaders[mHeaders.length - 1].span++;
      } else {
        mHeaders.push({ label: `${MONTH_NAMES[m]} ${y}`, span: 1 });
        curMonth = m;
        curYear = y;
      }
    }

    const result: CycleGroup[] = [];

    for (const a of unique) {
      if (!a.cycles) continue;
      const qaCount = a.qaCount || 1;

      for (const cycle of a.cycles) {
        if (!CYCLE_PATTERN.test(cycle.label.trim())) continue;
        const totalCPs = cycle.totalCPs || 0;
        if (totalCPs <= 0) continue;
        if (!cycle.endDate) continue;

        const plannedEnd = new Date(cycle.endDate + 'T12:00:00');
        if (isNaN(plannedEnd.getTime())) continue;

        const dailyConformes = cycle.dailyConformes || {};
        const conformes = Object.values(dailyConformes).reduce((s, v) => s + (v || 0), 0);
        const rows: RowData[] = [];

        // --- PLANIFICADO ---
        if (cycle.startDate) {
          const pStart = new Date(cycle.startDate + 'T12:00:00');
          if (!isNaN(pStart.getTime())) {
            const bizDays = getBusinessDaysList(pStart, plannedEnd, hol);
            if (bizDays.length > 0) {
              const { dailyMap, cpsPerQAPerDay } = buildDistributionMap(bizDays, totalCPs, qaCount);
              rows.push({
                label: 'Planificado',
                type: 'planned',
                businessDays: bizDays.length,
                casesPerQAPerDay: cpsPerQAPerDay,
                dailyMap,
              });
            }
          }
        }

        // --- REAL (from dailyConformes) ---
        const realMap = buildRealFromDaily(dailyConformes);
        const realDaysCount = realMap.size;
        rows.push({
          label: 'Real',
          type: 'real',
          businessDays: realDaysCount,
          casesPerQAPerDay: 0,
          dailyMap: realMap,
        });

        // --- DIFERENCIA (Acumulado Real - Acumulado Planificado) ---
        // Only if we have a planned row
        const plannedRow = rows.find(r => r.type === 'planned');
        if (plannedRow) {
          const diffMap = new Map<string, DailyEntry>();
          // For each day that has either planned or real cumulative, compute diff
          const allKeys = new Set<string>();
          plannedRow.dailyMap.forEach((_, k) => allKeys.add(k));
          realMap.forEach((_, k) => allKeys.add(k));

          // We need running cumulative for real across all days (fill forward)
          let lastRealCum = 0;
          let lastPlannedCum = 0;
          const sortedAllDayKeys = allDays.map(d => dateKey(d));

          for (const dk of sortedAllDayKeys) {
            const plannedEntry = plannedRow.dailyMap.get(dk);
            const realEntry = realMap.get(dk);
            if (plannedEntry) lastPlannedCum = plannedEntry.cumulative;
            if (realEntry) lastRealCum = realEntry.cumulative;
            // Only show diff on days where planned has data
            if (plannedEntry || realEntry) {
              const diff = lastRealCum - lastPlannedCum;
              diffMap.set(dk, { casesPerQA: diff, cumulative: diff });
            }
          }

          rows.push({
            label: 'Diferencia',
            type: 'diff',
            businessDays: 0,
            casesPerQAPerDay: 0,
            dailyMap: diffMap,
          });
        }

        // Determine editable business days: from realStartDate (or startDate) up to today
        const editStart = cycle.realStartDate
          ? new Date(cycle.realStartDate + 'T12:00:00')
          : cycle.startDate
            ? new Date(cycle.startDate + 'T12:00:00')
            : null;

        let editableDays: string[] = [];
        if (editStart && !isNaN(editStart.getTime())) {
          const editEnd = today < plannedEnd ? today : plannedEnd;
          const bizDays = getBusinessDaysList(editStart, editEnd, hol);
          editableDays = bizDays.map(d => dateKey(d));
        }

        result.push({
          atencionCode: a.code,
          atencionId: a.id,
          cycleId: cycle.id,
          cycleLabel: cycle.label,
          totalCPs,
          qaCount,
          conformes,
          rows,
          editableDays,
          dailyConformes,
        });
      }
    }

    return { groups: result, allDays, holidays: hol, monthHeaders: mHeaders };
  }, [atenciones]);

  const handleDailyChange = useCallback((atencionId: string, cycleId: string, day: string, value: number) => {
    if (!onUpdateAtencion) return;
    const atencion = atenciones.find(a => a.id === atencionId);
    if (!atencion || !atencion.cycles) return;

    const updatedCycles = atencion.cycles.map(c => {
      if (c.id !== cycleId) return c;
      const newDaily = { ...(c.dailyConformes || {}), [day]: value };
      if (value <= 0) delete newDaily[day];
      // Recompute conforme from dailyConformes
      const totalConformes = Object.values(newDaily).reduce((s, v) => s + (v || 0), 0);
      return {
        ...c,
        dailyConformes: newDaily,
        status: { ...c.status, conforme: totalConformes },
      };
    });

    onUpdateAtencion({ ...atencion, cycles: updatedCycles });
  }, [atenciones, onUpdateAtencion]);

  if (groups.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6">
        No hay actividades con casos de prueba y fechas definidas para generar cronograma.
      </div>
    );
  }

  const COL_W = 44;
  const LABEL_W = 180;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse" style={{ minWidth: LABEL_W + allDays.length * COL_W }}>
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="sticky left-0 z-20 bg-muted/40 min-w-[180px]" style={{ width: LABEL_W }} />
              {monthHeaders.map((mh, i) => (
                <th key={i} colSpan={mh.span} className="text-center text-muted-foreground font-semibold px-1 py-1 border-l border-border/40">
                  {mh.label}
                </th>
              ))}
            </tr>
            <tr className="border-b border-border bg-muted/30">
              <th className="sticky left-0 z-20 bg-muted/30 text-left px-2 py-1 text-muted-foreground font-medium" style={{ width: LABEL_W }}>
                Atención / Ciclo
              </th>
              {allDays.map((d, i) => {
                const dow = d.getDay();
                const isNonWorking = dow === 0 || dow === 6 || holidays.has(dateKey(d));
                return (
                  <th
                    key={i}
                    className={`text-center px-0.5 py-1 font-medium whitespace-nowrap border-l border-border/20 ${isNonWorking ? 'bg-red-900/30 text-red-400/70' : 'text-muted-foreground'}`}
                    style={{ minWidth: COL_W, maxWidth: COL_W }}
                  >
                    <div className="leading-tight">
                      <div className="text-[9px]">{DAY_NAMES[dow]}</div>
                      <div>{d.getDate()}</div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          {groups.map((g, gIdx) => (
            <tbody key={`${g.atencionId}-${g.cycleLabel}-${gIdx}`}>
              {/* Group header */}
              <tr className="bg-secondary/40 border-t border-border">
                <td colSpan={1 + allDays.length} className="px-2 py-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground">{g.atencionCode}</span>
                    <span className="bg-primary/20 text-primary px-2 py-0.5 rounded font-medium">{g.cycleLabel}</span>
                    <span className="text-muted-foreground">
                      {g.totalCPs} CPs · {g.qaCount} QA{g.qaCount > 1 ? 's' : ''}
                    </span>
                    {g.conformes > 0 && (
                      <span className="text-muted-foreground">
                        Conformes: {g.conformes}/{g.totalCPs} ({Math.round((g.conformes / g.totalCPs) * 100)}%)
                      </span>
                    )}
                  </div>
                </td>
              </tr>
              {/* Rows */}
              {g.rows.map((row, rIdx) => {
                const isPlanned = row.type === 'planned';
                const isReal = row.type === 'real';
                const isDiff = row.type === 'diff';
                const colorBg = isPlanned ? 'bg-blue-900/20' : isReal ? 'bg-amber-900/20' : '';
                const colorBgLight = isPlanned ? 'bg-blue-900/10' : isReal ? 'bg-amber-900/10' : '';
                const colorText = isPlanned ? 'text-blue-300' : isReal ? 'text-amber-300' : '';
                const dotColor = isPlanned ? 'bg-blue-500' : isReal ? 'bg-amber-500' : 'bg-gray-500';

                // For diff row, render single combined row (no separate acumulado)
                if (isDiff) {
                  return (
                    <tr key={rIdx} className="border-b border-border/50">
                      <td className="sticky left-0 z-10 bg-card px-2 py-1 font-medium text-muted-foreground whitespace-nowrap" style={{ width: LABEL_W }}>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-gray-500" />
                          Diferencia
                        </div>
                      </td>
                      {allDays.map((d, i) => {
                        const dk = dateKey(d);
                        const entry = row.dailyMap.get(dk);
                        const dow = d.getDay();
                        const isNonWorking = dow === 0 || dow === 6 || holidays.has(dk);
                        if (!entry) {
                          return (
                            <td key={i} className={`text-center px-0.5 py-1 border-l border-border/10 ${isNonWorking ? 'bg-red-900/20' : ''}`} style={{ minWidth: COL_W, maxWidth: COL_W }} />
                          );
                        }
                        const diff = entry.casesPerQA;
                        const isNeg = diff < 0;
                        const isPos = diff >= 0;
                        const bgClass = isNeg ? 'bg-red-900/30' : 'bg-emerald-900/30';
                        const textClass = isNeg ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold';
                        return (
                          <td
                            key={i}
                            className={`text-center px-0.5 py-1 border-l border-border/10 ${isNonWorking ? 'bg-red-900/20' : ''} ${bgClass}`}
                            style={{ minWidth: COL_W, maxWidth: COL_W }}
                          >
                            <span className={textClass}>{diff > 0 ? `+${diff}` : diff}</span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                }

                return (
                  <React.Fragment key={rIdx}>
                    {/* Row 1: CPs per day */}
                    <tr className="border-b border-border/30">
                      <td className="sticky left-0 z-10 bg-card px-2 py-1 font-medium text-muted-foreground whitespace-nowrap" style={{ width: LABEL_W }}>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                          {row.label}
                          {isPlanned && (
                            <span className="text-[10px] text-muted-foreground/70">
                              ({row.businessDays}d · ~{row.casesPerQAPerDay} CPs/QA/día)
                            </span>
                          )}
                        </div>
                      </td>
                      {allDays.map((d, i) => {
                        const dk = dateKey(d);
                        const entry = row.dailyMap.get(dk);
                        const dow = d.getDay();
                        const isNonWorking = dow === 0 || dow === 6 || holidays.has(dk);
                        const isEditable = isReal && g.editableDays.includes(dk) && onUpdateAtencion;

                        if (isEditable) {
                          const currentVal = g.dailyConformes[dk] || '';
                          return (
                            <td
                              key={i}
                              className={`text-center px-0 py-0 border-l border-border/10 ${isNonWorking ? 'bg-red-900/20' : ''} ${entry ? colorBg : 'bg-amber-900/5'}`}
                              style={{ minWidth: COL_W, maxWidth: COL_W }}
                            >
                              <input
                                type="number"
                                min={0}
                                value={currentVal}
                                onChange={e => {
                                  const val = e.target.value ? parseInt(e.target.value) : 0;
                                  handleDailyChange(g.atencionId, g.cycleId, dk, val);
                                }}
                                className="w-full h-full bg-transparent text-center text-amber-300 font-semibold text-xs py-1 px-0.5 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="·"
                              />
                            </td>
                          );
                        }

                        return (
                          <td
                            key={i}
                            className={`text-center px-0.5 py-1 border-l border-border/10 ${isNonWorking ? 'bg-red-900/20' : ''} ${entry ? colorBg : ''}`}
                            style={{ minWidth: COL_W, maxWidth: COL_W }}
                          >
                            {entry && <span className={`font-semibold ${colorText}`}>{entry.casesPerQA}</span>}
                          </td>
                        );
                      })}
                    </tr>
                    {/* Row 2: Acumulado */}
                    <tr className="border-b border-border/50">
                      <td className="sticky left-0 z-10 bg-card px-2 py-1 text-muted-foreground/70 text-[10px] pl-6" style={{ width: LABEL_W }}>
                        Acumulado
                      </td>
                      {allDays.map((d, i) => {
                        const dk = dateKey(d);
                        const entry = row.dailyMap.get(dk);
                        const dow = d.getDay();
                        const isNonWorking = dow === 0 || dow === 6 || holidays.has(dk);
                        return (
                          <td
                            key={i}
                            className={`text-center px-0.5 py-0.5 border-l border-border/10 text-[10px] ${isNonWorking ? 'bg-red-900/20' : ''} ${entry ? colorBgLight : ''}`}
                            style={{ minWidth: COL_W, maxWidth: COL_W }}
                          >
                            {entry && <span className="text-muted-foreground">{entry.cumulative}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
