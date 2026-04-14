const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente', en_progreso: 'En Progreso', completada: 'Completada', cancelada: 'Cancelada',
};
const STATUS_COLORS: Record<string, string> = {
  pendiente: 'hsl(var(--muted-foreground))', en_progreso: 'hsl(var(--primary))', completada: '#22c55e', cancelada: '#ef4444',
};

interface Props { byStatus: Record<string, number> }

export function TasksSummary({ byStatus }: Props) {
  const total = Object.values(byStatus).reduce((s, v) => s + v, 0);
  if (!total) return <p className="text-sm text-muted-foreground">No hay tareas.</p>;

  return (
    <div className="space-y-3">
      <div className="flex h-4 rounded-full overflow-hidden">
        {Object.entries(STATUS_LABELS).map(([key]) => {
          const count = byStatus[key] || 0;
          if (!count) return null;
          return <div key={key} className="h-full transition-all" style={{ width: `${(count / total) * 100}%`, backgroundColor: STATUS_COLORS[key] }} />;
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[key] }} />
            <span>{label}: <strong>{byStatus[key] || 0}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}
