import { Handle, Position } from '@xyflow/react';
import { TRIGGER_TYPES } from '../types';
import { Zap } from 'lucide-react';

export function TriggerNode({ data, selected }: any) {
  const trigger = TRIGGER_TYPES.find(t => t.value === data.nodeType);
  return (
    <div className={`rounded-lg border-2 px-4 py-3 min-w-[180px] bg-background shadow-sm transition-all ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-amber-400'}`}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm">
          {trigger?.icon || <Zap className="h-4 w-4 text-amber-600" />}
        </div>
        <div>
          <p className="text-[10px] uppercase font-semibold text-amber-600 tracking-wider">Trigger</p>
          <p className="text-sm font-medium leading-tight">{trigger?.label || data.label}</p>
        </div>
      </div>
      {data.config?.tag_name && <p className="text-xs text-muted-foreground mt-1 ml-10">{data.config.tag_name}</p>}
      {data.config?.segment_name && <p className="text-xs text-muted-foreground mt-1 ml-10">{data.config.segment_name}</p>}
      {data.config?.webhook_name && <p className="text-xs text-muted-foreground mt-1 ml-10">🔗 {data.config.webhook_name}</p>}
      {data.config?.run_date && <p className="text-xs text-muted-foreground mt-1 ml-10">📅 {data.config.run_date} {data.config.run_time || ''}</p>}
      {data.config?.frequency && <p className="text-xs text-muted-foreground mt-1 ml-10">🔁 {data.config.frequency}</p>}
      <Handle type="source" position={Position.Bottom} className="!bg-amber-400 !w-3 !h-3" />
    </div>
  );
}
