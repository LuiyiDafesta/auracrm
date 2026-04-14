interface TagData { name: string; color: string; count: number }
interface Props { tags: TagData[] }

export function ContactsByTag({ tags }: Props) {
  if (!tags.length) return <p className="text-sm text-muted-foreground">No hay etiquetas.</p>;
  const max = Math.max(...tags.map(t => t.count), 1);

  return (
    <div className="space-y-2">
      {tags.map(t => (
        <div key={t.name} className="space-y-1">
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
              <span>{t.name}</span>
            </div>
            <span className="text-muted-foreground">{t.count}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(t.count / max) * 100}%`, backgroundColor: t.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
