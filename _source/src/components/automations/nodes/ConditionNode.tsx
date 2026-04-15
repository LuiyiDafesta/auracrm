import { Handle, Position } from '@xyflow/react';
import { CONDITION_TYPES } from '../types';

export function ConditionNode({ data, selected }: any) {
  const condition = CONDITION_TYPES.find(c => c.value === data.nodeType);

  let detail = '';
  if (data.config?.tag_name) detail = data.config.tag_name;
  if (data.config?.value !== undefined) detail = String(data.config.value);
  if (data.config?.segment_name) detail = data.config.segment_name;

  return (
    <div className={`rounded-lg border-2 px-4 py-3 min-w-[180px] bg-background shadow-sm transition-all ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-violet-400'}`} style={{ borderRadius: '0.5rem', transform: 'rotate(0deg)' }}>
      <Handle type="target" position={Position.Top} className="!bg-violet-400 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-sm">🔀</div>
        <div>
          <p className="text-[10px] uppercase font-semibold text-violet-600 tracking-wider">Condición</p>
          <p className="text-xs font-medium">{condition?.label || data.label}</p>
          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        </div>
      </div>
      <div className="flex justify-between mt-2 text-[10px] px-1">
        <span className="text-green-600 font-semibold">Sí ✓</span>
        <span className="text-red-500 font-semibold">No ✗</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" className="!bg-green-500 !w-3 !h-3" style={{ left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="no" className="!bg-red-500 !w-3 !h-3" style={{ left: '70%' }} />
    </div>
  );
}
