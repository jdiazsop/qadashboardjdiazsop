import { Tag } from '@/types/qa';

const colorMap: Record<string, string> = {
  calidad: 'bg-tag-calidad text-black',
  sap: 'bg-tag-sap text-black',
  core: 'bg-tag-core text-black',
  desarrollo: 'bg-tag-desarrollo text-white',
  dl: 'bg-tag-dl text-white',
  rend: 'bg-tag-rend text-white',
};

export function TagBadge({ tag }: { tag: Tag }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${colorMap[tag.color] || 'bg-muted text-muted-foreground'}`}>
      {tag.label}
    </span>
  );
}
