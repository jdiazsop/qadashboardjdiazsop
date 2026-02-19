import { Atencion, Tag } from '@/types/qa';
import { TagBadge } from './TagBadge';

interface Props {
  atenciones: Atencion[];
  tags: Tag[];
}

export function TimelineView({ atenciones, tags }: Props) {
  const items = atenciones.filter(a => a.startDate && a.endDate).sort((a, b) => (a.startDate! > b.startDate! ? 1 : -1));

  if (items.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">
        Sin atenciones con fechas configuradas
      </div>
    );
  }

  // Calculate date range
  const allDates = items.flatMap(a => [new Date(a.startDate!), new Date(a.endDate!)]);
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));

  const today = new Date();
  const todayOffset = Math.ceil((today.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
  const todayPct = Math.min(100, Math.max(0, (todayOffset / totalDays) * 100));

  // Generate month labels
  const months: { label: string; pct: number }[] = [];
  const current = new Date(minDate);
  current.setDate(1);
  while (current <= maxDate) {
    const offset = Math.ceil((current.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const pct = (offset / totalDays) * 100;
    months.push({ label: current.toLocaleDateString('es', { month: 'short', year: '2-digit' }), pct: Math.max(0, pct) });
    current.setMonth(current.getMonth() + 1);
  }

  const getBarColor = (a: Atencion) => {
    if (a.timelineNote) return 'bg-destructive/80';
    if (a.tags.includes('calidad')) return 'bg-tag-calidad/80';
    if (a.tags.includes('desarrollo')) return 'bg-tag-desarrollo/80';
    return 'bg-primary/60';
  };

  return (
    <div className="overflow-x-auto">
      {/* Month headers */}
      <div className="relative h-6 mb-1 border-b border-border">
        {months.map((m, i) => (
          <span key={i} className="absolute text-[10px] text-muted-foreground font-medium" style={{ left: `${m.pct}%` }}>
            {m.label}
          </span>
        ))}
      </div>

      {/* Today line */}
      <div className="relative">
        <div
          className="absolute top-0 bottom-0 w-px bg-destructive/60 z-10"
          style={{ left: `${todayPct}%` }}
        >
          <span className="absolute -top-5 -translate-x-1/2 text-[9px] text-destructive font-semibold">Hoy</span>
        </div>

        {/* Bars */}
        <div className="space-y-1.5 py-1">
          {items.map(a => {
            const start = new Date(a.startDate!);
            const end = new Date(a.endDate!);
            const startOffset = (start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
            const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
            const leftPct = (startOffset / totalDays) * 100;
            const widthPct = Math.max(2, (duration / totalDays) * 100);
            const atencionTags = tags.filter(t => a.tags.includes(t.id));

            return (
              <div key={a.id} className="relative h-7 group">
                <div
                  className={`absolute h-full rounded ${getBarColor(a)} flex items-center px-2 gap-1.5 cursor-default transition-all hover:opacity-90`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: 60 }}
                >
                  <span className="text-[10px] font-mono font-semibold text-black truncate">{a.code}</span>
                </div>
                {a.timelineNote && (
                  <div
                    className="absolute top-0 flex items-center h-full"
                    style={{ left: `${leftPct + widthPct}%` }}
                  >
                    <span className="ml-2 text-[10px] text-destructive font-medium whitespace-nowrap">{a.timelineNote}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
