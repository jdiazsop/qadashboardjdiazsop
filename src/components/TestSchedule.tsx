import React, { useMemo } from 'react';
import { Atencion, getPeruHolidays, isBusinessDay } from '@/types/qa';

interface Props {
  atenciones: Atencion[];
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

interface RowData {
  label: string; // "Planificado" or "Real"
  type: 'planned' | 'real';
  startDate: string;
  endDate: string;
  totalCPs: number;
  qaCount: number;
  businessDays: number;
  casesPerQAPerDay: number;
  // map dateKey -> { casesPerQA, cumulative }
  dailyMap: Map<string, { casesPerQA: number; cumulative: number }>;
}

interface CycleGroup {
  atencionCode: string;
  atencionId: string;
  cycleLabel: string;
  totalCPs: number;
  qaCount: number;
  executed: number;
  rows: RowData[];
}

export function TestSchedule({ atenciones }: Props) {
  const { groups, allDays, holidays, monthHeaders } = useMemo(() => {
    // Deduplicate
    const seen = new Set<string>();
    const unique = atenciones.filter(a => {
      const key = a.sourceId || a.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Collect all years for holidays
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

    if (allYears.size === 0) allYears.add(new Date().getFullYear());
    const hol = new Set<string>();
    allYears.forEach(y => getPeruHolidays(y).forEach(h => hol.add(h)));

    const allDays = getAllCalendarDays(globalMin, globalMax);

    // Build month headers
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

    // Build groups
    const result: CycleGroup[] = [];

    for (const a of unique) {
      if (!a.cycles) continue;
      const qaCount = a.estimation?.qaCount || 1;

      for (const cycle of a.cycles) {
        if (!CYCLE_PATTERN.test(cycle.label.trim())) continue;
        const totalCPs = cycle.totalCPs || 0;
        if (totalCPs <= 0) continue;
        if (!cycle.endDate) continue;

        const plannedEnd = new Date(cycle.endDate + 'T12:00:00');
        if (isNaN(plannedEnd.getTime())) continue;

        const executed = (cycle.status?.conforme || 0) + (cycle.status?.enProceso || 0) + (cycle.status?.bloqueados || 0);

        const rows: RowData[] = [];

        // Row 1: Planned (startDate → endDate)
        if (cycle.startDate) {
          const pStart = new Date(cycle.startDate + 'T12:00:00');
          if (!isNaN(pStart.getTime())) {
            const bizDays = getBusinessDaysList(pStart, plannedEnd, hol);
            if (bizDays.length > 0) {
              const cpsPerQAPerDay = Math.ceil(totalCPs / (bizDays.length * qaCount));
              const dailyMap = new Map<string, { casesPerQA: number; cumulative: number }>();
              let cum = 0;
              bizDays.forEach((d, i) => {
                const isLast = i === bizDays.length - 1;
                const dayTarget = isLast ? totalCPs - cum : Math.min(cpsPerQAPerDay * qaCount, totalCPs - cum);
                cum += dayTarget;
                dailyMap.set(dateKey(d), { casesPerQA: Math.ceil(dayTarget / qaCount), cumulative: cum });
              });
              rows.push({
                label: 'Planificado',
                type: 'planned',
                startDate: cycle.startDate,
                endDate: cycle.endDate,
                totalCPs,
                qaCount,
                businessDays: bizDays.length,
                casesPerQAPerDay: cpsPerQAPerDay,
                dailyMap,
              });
            }
          }
        }

        // Row 2: Real (realStartDate → endDate)
        if (cycle.realStartDate) {
          const rStart = new Date(cycle.realStartDate + 'T12:00:00');
          if (!isNaN(rStart.getTime())) {
            const bizDays = getBusinessDaysList(rStart, plannedEnd, hol);
            if (bizDays.length > 0) {
              const cpsPerQAPerDay = Math.ceil(totalCPs / (bizDays.length * qaCount));
              const dailyMap = new Map<string, { casesPerQA: number; cumulative: number }>();
              let cum = 0;
              bizDays.forEach((d, i) => {
                const isLast = i === bizDays.length - 1;
                const dayTarget = isLast ? totalCPs - cum : Math.min(cpsPerQAPerDay * qaCount, totalCPs - cum);
                cum += dayTarget;
                dailyMap.set(dateKey(d), { casesPerQA: Math.ceil(dayTarget / qaCount), cumulative: cum });
              });
              rows.push({
                label: 'Real',
                type: 'real',
                startDate: cycle.realStartDate,
                endDate: cycle.endDate,
                totalCPs,
                qaCount,
                businessDays: bizDays.length,
                casesPerQAPerDay: cpsPerQAPerDay,
                dailyMap,
              });
            }
          }
        }

        if (rows.length > 0) {
          result.push({
            atencionCode: a.code,
            atencionId: a.id,
            cycleLabel: cycle.label,
            totalCPs,
            qaCount,
            executed,
            rows,
          });
        }
      }
    }

    return { groups: result, allDays, holidays: hol, monthHeaders: mHeaders };
  }, [atenciones]);

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
            {/* Month row */}
            <tr className="border-b border-border bg-muted/40">
              <th className="sticky left-0 z-20 bg-muted/40 min-w-[180px]" style={{ width: LABEL_W }} />
              {monthHeaders.map((mh, i) => (
                <th
                  key={i}
                  colSpan={mh.span}
                  className="text-center text-muted-foreground font-semibold px-1 py-1 border-l border-border/40"
                >
                  {mh.label}
                </th>
              ))}
            </tr>
            {/* Day row */}
            <tr className="border-b border-border bg-muted/30">
              <th className="sticky left-0 z-20 bg-muted/30 text-left px-2 py-1 text-muted-foreground font-medium" style={{ width: LABEL_W }}>
                Atención / Ciclo
              </th>
              {allDays.map((d, i) => {
                const dow = d.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isHoliday = holidays.has(dateKey(d));
                const isNonWorking = isWeekend || isHoliday;
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
          {groups.map((g, gIdx) => {
            const progressPct = g.totalCPs > 0 ? Math.round((g.executed / g.totalCPs) * 100) : 0;
            return (
              <tbody key={`${g.atencionId}-${g.cycleLabel}-${gIdx}`}>
                {/* Group header row */}
                <tr className="bg-secondary/40 border-t border-border">
                  <td
                    colSpan={1 + allDays.length}
                    className="px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">{g.atencionCode}</span>
                      <span className="bg-primary/20 text-primary px-2 py-0.5 rounded font-medium">{g.cycleLabel}</span>
                      <span className="text-muted-foreground">
                        {g.totalCPs} CPs · {g.qaCount} QA{g.qaCount > 1 ? 's' : ''}
                      </span>
                      {g.executed > 0 && (
                        <span className="text-muted-foreground">
                          Ejecutados: {g.executed}/{g.totalCPs} ({progressPct}%)
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                {/* Data rows */}
                {g.rows.map((row, rIdx) => (
                  <React.Fragment key={rIdx}>
                    {/* CPs/QA row */}
                    <tr className="border-b border-border/30">
                      <td className="sticky left-0 z-10 bg-card px-2 py-1 font-medium text-muted-foreground whitespace-nowrap" style={{ width: LABEL_W }}>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${row.type === 'planned' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                          {row.label}
                          <span className="text-[10px] text-muted-foreground/70">
                            ({row.businessDays}d · ~{row.casesPerQAPerDay} CPs/QA/día)
                          </span>
                        </div>
                      </td>
                      {allDays.map((d, i) => {
                        const dk = dateKey(d);
                        const entry = row.dailyMap.get(dk);
                        const dow = d.getDay();
                        const isWeekend = dow === 0 || dow === 6;
                        const isHoliday = holidays.has(dk);
                        const isNonWorking = isWeekend || isHoliday;
                        return (
                          <td
                            key={i}
                            className={`text-center px-0.5 py-1 border-l border-border/10 ${isNonWorking ? 'bg-red-900/20' : ''} ${entry ? (row.type === 'planned' ? 'bg-blue-900/20' : 'bg-emerald-900/20') : ''}`}
                            style={{ minWidth: COL_W, maxWidth: COL_W }}
                          >
                            {entry && (
                              <span className={`font-semibold ${row.type === 'planned' ? 'text-blue-300' : 'text-emerald-300'}`}>
                                {entry.casesPerQA}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    {/* Cumulative row */}
                    <tr className="border-b border-border/50">
                      <td className="sticky left-0 z-10 bg-card px-2 py-1 text-muted-foreground/70 text-[10px] pl-6" style={{ width: LABEL_W }}>
                        Acumulado
                      </td>
                      {allDays.map((d, i) => {
                        const dk = dateKey(d);
                        const entry = row.dailyMap.get(dk);
                        const dow = d.getDay();
                        const isWeekend = dow === 0 || dow === 6;
                        const isHoliday = holidays.has(dk);
                        const isNonWorking = isWeekend || isHoliday;
                        return (
                          <td
                            key={i}
                            className={`text-center px-0.5 py-0.5 border-l border-border/10 text-[10px] ${isNonWorking ? 'bg-red-900/20' : ''} ${entry ? (row.type === 'planned' ? 'bg-blue-900/10' : 'bg-emerald-900/10') : ''}`}
                            style={{ minWidth: COL_W, maxWidth: COL_W }}
                          >
                            {entry && (
                              <span className="text-muted-foreground">
                                {entry.cumulative}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}
