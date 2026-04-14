interface SegData { name: string; count: number }
interface Props { segments: SegData[] }

export function ContactsBySegment({ segments }: Props) {
  if (!segments.length) return <p className="text-sm text-muted-foreground">No hay segmentos.</p>;
  const max = Math.max(...segments.map(s => s.count), 1);

  return (
    <div className="space-y-2">
      {segments.map(s => (
        <div key={s.name} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{s.name}</span>
            <span className="text-muted-foreground">{s.count} contactos</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(s.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
