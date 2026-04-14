interface FieldSummary {
  name: string;
  type: string;
  distribution: { value: string; count: number }[];
}

interface Props { fields: FieldSummary[] }

export function CustomFieldsSummary({ fields }: Props) {
  if (!fields.length) return <p className="text-sm text-muted-foreground">No hay campos personalizados con datos.</p>;

  return (
    <div className="space-y-4">
      {fields.map(f => {
        const max = Math.max(...f.distribution.map(d => d.count), 1);
        return (
          <div key={f.name}>
            <div className="text-sm font-medium mb-2">{f.name} <span className="text-muted-foreground">({f.type})</span></div>
            {f.type === 'number' ? (
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                {f.distribution.map(d => (
                  <div key={d.value} className="rounded border p-2">
                    <div className="text-[10px] text-muted-foreground">{d.value}</div>
                    <div className="font-bold">{d.count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {f.distribution.slice(0, 8).map(d => (
                  <div key={d.value} className="flex items-center gap-2 text-xs">
                    <span className="w-24 truncate">{d.value || '(vacío)'}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${(d.count / max) * 100}%` }} />
                    </div>
                    <span className="text-muted-foreground w-6 text-right">{d.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
