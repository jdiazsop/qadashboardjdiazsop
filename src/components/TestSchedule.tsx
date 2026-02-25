import { useMemo } from 'react';
import { Atencion, TestCycle, getPeruHolidays, isBusinessDay } from '@/types/qa';
import { CalendarDays } from 'lucide-react';

interface Props {
  atenciones: Atencion[];
}

interface CycleSchedule {
  atencionCode: string;
  atencionId: string;
  cycleLabel: string;
  totalCPs: number;
  qaCount: number;
  realStart: string;
  plannedEnd: string;
  businessDays: number;
  casesPerDay: number;
  casesPerQAPerDay: number;
  executed: number;
  remaining: number;
  dailyBreakdown: { date: string; dayLabel: string; casesPerQA: number; cumulative: number }[];
}

function countBusinessDaysBetween(start: Date, end: Date, holidays: Set<string>): number {
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (isBusinessDay(cursor, holidays)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function getBusinessDaysList(start: Date, end: Date, holidays: Set<string>): Date[] {
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (isBusinessDay(cursor, holidays)) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

const CYCLE_PATTERN = /^(C\d+|UAT)$/i;
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function TestSchedule({ atenciones }: Props) {
  const schedules = useMemo(() => {
    // Deduplicate by sourceId
    const seen = new Set<string>();
    const unique = atenciones.filter(a => {
      const key = a.sourceId || a.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const allYears = new Set<number>();
    unique.forEach(a => {
      a.cycles?.forEach(c => {
        if (c.realStartDate) allYears.add(new Date(c.realStartDate + 'T12:00:00').getFullYear());
        if (c.endDate) allYears.add(new Date(c.endDate + 'T12:00:00').getFullYear());
        if (c.startDate) allYears.add(new Date(c.startDate + 'T12:00:00').getFullYear());
      });
    });
    if (allYears.size === 0) allYears.add(new Date().getFullYear());
    const holidays = new Set<string>();
    allYears.forEach(y => getPeruHolidays(y).forEach(h => holidays.add(h)));

    const result: CycleSchedule[] = [];

    for (const a of unique) {
      if (!a.cycles) continue;
      const qaCount = a.estimation?.qaCount || 1;

      for (const cycle of a.cycles) {
        if (!CYCLE_PATTERN.test(cycle.label.trim())) continue;
        const totalCPs = cycle.totalCPs || 0;
        if (totalCPs <= 0) continue;

        const startStr = cycle.realStartDate || cycle.startDate;
        const endStr = cycle.endDate;
        if (!startStr || !endStr) continue;

        const startDate = new Date(startStr + 'T12:00:00');
        const endDate = new Date(endStr + 'T12:00:00');
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) continue;

        const bizDays = getBusinessDaysList(startDate, endDate, holidays);
        if (bizDays.length === 0) continue;

        // Calculate executed (conforme + enProceso + bloqueados)
        const executed = (cycle.status?.conforme || 0) + (cycle.status?.enProceso || 0) + (cycle.status?.bloqueados || 0);
        const remaining = Math.max(0, totalCPs - executed);

        const casesPerDay = Math.ceil(totalCPs / bizDays.length);
        const casesPerQAPerDay = Math.ceil(totalCPs / (bizDays.length * qaCount));

        let cumulative = 0;
        const dailyBreakdown = bizDays.map((d, i) => {
          const isLast = i === bizDays.length - 1;
          const dayTarget = isLast
            ? totalCPs - cumulative
            : Math.min(casesPerQAPerDay * qaCount, totalCPs - cumulative);
          cumulative += dayTarget;
          const dayPerQA = Math.ceil(dayTarget / qaCount);
          return {
            date: d.toISOString().slice(0, 10),
            dayLabel: `${DAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`,
            casesPerQA: dayPerQA,
            cumulative,
          };
        });

        result.push({
          atencionCode: a.code,
          atencionId: a.id,
          cycleLabel: cycle.label,
          totalCPs,
          qaCount,
          realStart: startStr,
          plannedEnd: endStr,
          businessDays: bizDays.length,
          casesPerDay,
          casesPerQAPerDay,
          executed,
          remaining,
          dailyBreakdown,
        });
      }
    }

    return result;
  }, [atenciones]);

  if (schedules.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6">
        No hay actividades con casos de prueba y fechas definidas para generar cronograma.
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-x-auto">
      {schedules.map((s, idx) => {
        const progressPct = s.totalCPs > 0 ? Math.round((s.executed / s.totalCPs) * 100) : 0;
        return (
          <div key={`${s.atencionId}-${s.cycleLabel}-${idx}`} className="border border-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="bg-secondary/50 px-3 py-2 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-bold text-foreground">{s.atencionCode}</span>
              <span className="bg-primary/20 text-primary px-2 py-0.5 rounded font-medium">{s.cycleLabel}</span>
              <span className="text-muted-foreground">
                {s.totalCPs} CPs · {s.qaCount} QA{s.qaCount > 1 ? 's' : ''} · {s.businessDays} días hábiles
              </span>
              <span className="text-muted-foreground">
                {s.realStart} → {s.plannedEnd}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <span className="font-semibold text-accent-foreground bg-accent/20 px-2 py-0.5 rounded">
                  ~{s.casesPerQAPerDay} CPs/QA/día
                </span>
                {s.executed > 0 && (
                  <span className="text-muted-foreground">
                    Ejecutados: {s.executed}/{s.totalCPs} ({progressPct}%)
                  </span>
                )}
              </div>
            </div>
            {/* Daily breakdown table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-2 py-1.5 text-muted-foreground font-medium sticky left-0 bg-muted/30 min-w-[60px]">Día</th>
                    {s.dailyBreakdown.map((d, i) => (
                      <th key={i} className="px-2 py-1.5 text-center text-muted-foreground font-medium whitespace-nowrap min-w-[60px]">
                        {d.dayLabel}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="px-2 py-1.5 text-muted-foreground font-medium sticky left-0 bg-card">CPs/QA</td>
                    {s.dailyBreakdown.map((d, i) => (
                      <td key={i} className="px-2 py-1.5 text-center font-semibold text-foreground">
                        {d.casesPerQA}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-2 py-1.5 text-muted-foreground font-medium sticky left-0 bg-card">Acum.</td>
                    {s.dailyBreakdown.map((d, i) => (
                      <td key={i} className="px-2 py-1.5 text-center text-muted-foreground">
                        {d.cumulative}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}