import { Handle, Position } from '@xyflow/react';
import { ACTION_TYPES } from '../types';

export function ActionNode({ data, selected }: any) {
  const action = ACTION_TYPES.find(a => a.value === data.nodeType);
  const color = action?.color || '#2563EB';

  let detail = '';
  if (data.nodeType === 'wait') {
    const val = data.config?.wait_value || 1;
    const unit = data.config?.wait_unit === 'minutes' ? 'minuto(s)' : data.config?.wait_unit === 'hours' ? 'hora(s)' : 'día(s)';
    detail = `${val} ${unit}`;
  }
  if (data.nodeType === 'send_email') detail = data.config?.template_name || '';
  if (data.nodeType === 'add_tag' || data.nodeType === 'remove_tag') detail = data.config?.tag_name || '';
  if (data.nodeType === 'add_to_segment' || data.nodeType === 'remove_from_segment') detail = data.config?.segment_name || '';
  if (data.nodeType === 'update_status') detail = data.config?.new_status || '';
  if (data.nodeType === 'update_lead_score') {
    const op = data.config?.operation === 'add' ? '+' : data.config?.operation === 'subtract' ? '-' : '=';
    detail = `${op}${data.config?.value || 0}`;
  }

  return (
    <div className={`rounded-lg border-2 px-4 py-3 min-w-[180px] bg-background shadow-sm transition-all ${selected ? 'border-primary ring-2 ring-primary/20' : ''}`} style={{ borderColor: selected ? undefined : color }}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3" style={{ background: color }} />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: `${color}20` }}>
          {action?.icon || '⚡'}
        </div>
        <div>
          <p className="text-[10px] uppercase font-semibold tracking-wider" style={{ color }}>{action?.label || 'Acción'}</p>
          {detail && <p className="text-xs text-muted-foreground leading-tight">{detail}</p>}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3" style={{ background: color }} />
    </div>
  );
}
