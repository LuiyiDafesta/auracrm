import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { TRIGGER_TYPES, ACTION_TYPES, CONDITION_TYPES } from './types';
import { Trash2 } from 'lucide-react';

interface Props {
  node: any;
  onUpdate: (id: string, data: any) => void;
  onDelete: (id: string) => void;
}

export function NodeConfigPanel({ node, onUpdate, onDelete }: Props) {
  const [tags, setTags] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('tags').select('id, name').then(({ data }) => setTags(data || []));
    supabase.from('segments').select('id, name').then(({ data }) => setSegments(data || []));
    supabase.from('email_templates').select('id, name, subject').then(({ data }) => setTemplates(data || []));
  }, []);

  const config = node.data.config || {};
  const updateConfig = (key: string, value: any) => {
    onUpdate(node.id, { ...node.data, config: { ...config, [key]: value } });
  };

  const nodeType = node.data.nodeType;
  const isTrigger = node.type === 'trigger';
  const isAction = node.type === 'action';
  const isCondition = node.type === 'condition';

  const typeInfo = isTrigger
    ? TRIGGER_TYPES.find(t => t.value === nodeType)
    : isAction
    ? ACTION_TYPES.find(a => a.value === nodeType)
    : CONDITION_TYPES.find(c => c.value === nodeType);

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{typeInfo?.label || nodeType}</h3>
        {!isTrigger && (
          <Button variant="ghost" size="icon" onClick={() => onDelete(node.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      {/* Trigger configs */}
      {nodeType === 'tag_added' || nodeType === 'tag_removed' ? (
        <div className="space-y-2">
          <label className="text-xs font-medium">Etiqueta</label>
          <Select value={config.tag_id || ''} onValueChange={v => {
            const tag = tags.find(t => t.id === v);
            updateConfig('tag_id', v);
            if (tag) updateConfig('tag_name', tag.name);
          }}>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>{tags.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ) : null}

      {nodeType === 'segment_entered' || nodeType === 'in_segment' || nodeType === 'not_in_segment' || nodeType === 'add_to_segment' || nodeType === 'remove_from_segment' ? (
        <div className="space-y-2">
          <label className="text-xs font-medium">Segmento</label>
          <Select value={config.segment_id || ''} onValueChange={v => {
            const seg = segments.find(s => s.id === v);
            updateConfig('segment_id', v);
            if (seg) updateConfig('segment_name', seg.name);
          }}>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>{segments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ) : null}

      {nodeType === 'lead_score_reached' || nodeType === 'lead_score_gt' || nodeType === 'lead_score_lt' ? (
        <div className="space-y-2">
          <label className="text-xs font-medium">Valor: {config.value || 0}</label>
          <Slider value={[config.value || 0]} onValueChange={v => updateConfig('value', v[0])} min={0} max={100} step={1} />
        </div>
      ) : null}

      {nodeType === 'field_changed' || nodeType === 'field_equals' ? (
        <div className="space-y-2">
          <label className="text-xs font-medium">Campo</label>
          <Input value={config.field_name || ''} onChange={e => updateConfig('field_name', e.target.value)} placeholder="ej: status, email" />
          {nodeType === 'field_equals' && (
            <>
              <label className="text-xs font-medium">Valor</label>
              <Input value={config.value || ''} onChange={e => updateConfig('value', e.target.value)} />
            </>
          )}
        </div>
      ) : null}

      {nodeType === 'status_changed' || nodeType === 'status_is' || nodeType === 'update_status' ? (
        <div className="space-y-2">
          <label className="text-xs font-medium">{nodeType === 'status_changed' ? 'Nuevo estado (opcional)' : 'Estado'}</label>
          <Select value={config.new_status || config.value || ''} onValueChange={v => updateConfig(nodeType === 'update_status' ? 'new_status' : 'value', v)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
              <SelectItem value="prospecto">Prospecto</SelectItem>
              <SelectItem value="cliente">Cliente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Action configs */}
      {nodeType === 'send_email' ? (
        <div className="space-y-2">
          <label className="text-xs font-medium">Plantilla de email</label>
          <Select value={config.template_id || ''} onValueChange={v => {
            const tmpl = templates.find(t => t.id === v);
            updateConfig('template_id', v);
            if (tmpl) updateConfig('template_name', tmpl.name);
          }}>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ) : null}

      {nodeType === 'wait' ? (
        <div className="space-y-2">
          <label className="text-xs font-medium">Tiempo de espera</label>
          <div className="flex gap-2">
            <Input type="number" min={1} value={config.wait_value || 1} onChange={e => updateConfig('wait_value', parseInt(e.target.value) || 1)} className="w-20" />
            <Select value={config.wait_unit || 'days'} onValueChange={v => updateConfig('wait_unit', v)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Días</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {(nodeType === 'add_tag' || nodeType === 'remove_tag') && isAction ? (
        <div className="space-y-2">
          <label className="text-xs font-medium">Etiqueta</label>
          <Select value={config.tag_id || ''} onValueChange={v => {
            const tag = tags.find(t => t.id === v);
            updateConfig('tag_id', v);
            if (tag) updateConfig('tag_name', tag.name);
          }}>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>{tags.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ) : null}

      {nodeType === 'update_lead_score' ? (
        <div className="space-y-2">
          <label className="text-xs font-medium">Operación</label>
          <Select value={config.operation || 'add'} onValueChange={v => updateConfig('operation', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="add">Sumar</SelectItem>
              <SelectItem value="subtract">Restar</SelectItem>
              <SelectItem value="set">Establecer en</SelectItem>
            </SelectContent>
          </Select>
          <label className="text-xs font-medium">Valor</label>
          <Input type="number" value={config.value || 0} onChange={e => updateConfig('value', parseInt(e.target.value) || 0)} />
        </div>
      ) : null}

      {nodeType === 'update_field' ? (
        <div className="space-y-2">
          <label className="text-xs font-medium">Campo</label>
          <Input value={config.field_name || ''} onChange={e => updateConfig('field_name', e.target.value)} placeholder="ej: notes, phone" />
          <label className="text-xs font-medium">Nuevo valor</label>
          <Input value={config.value || ''} onChange={e => updateConfig('value', e.target.value)} />
        </div>
      ) : null}

      {(nodeType === 'has_tag' || nodeType === 'not_has_tag') ? (
        <div className="space-y-2">
          <label className="text-xs font-medium">Etiqueta</label>
          <Select value={config.tag_id || ''} onValueChange={v => {
            const tag = tags.find(t => t.id === v);
            updateConfig('tag_id', v);
            if (tag) updateConfig('tag_name', tag.name);
          }}>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>{tags.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
