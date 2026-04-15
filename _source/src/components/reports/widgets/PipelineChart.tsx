const STAGE_LABELS: Record<string, string> = {
  prospecto: 'Prospecto', calificado: 'Calificado', propuesta: 'Propuesta',
  negociacion: 'Negociación', cerrado_ganado: 'Cerrado Ganado', cerrado_perdido: 'Cerrado Perdido',
};

interface Props {
  pipelineByStage: Record<string, { count: number; value: number }>;
}

export function PipelineChart({ pipelineByStage }: Props) {
  const maxValue = Math.max(...Object.values(pipelineByStage).map(s => s.value), 1);

  return (
    <div className="space-y-3">
      {Object.entries(STAGE_LABELS).map(([key, label]) => {
        const stage = pipelineByStage[key];
        const count = stage?.count || 0;
        const value = stage?.value || 0;
        const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{label}</span>
              <span className="text-muted-foreground">{count} · ${value.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
