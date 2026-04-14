export const TRIGGER_TYPES = [
  { value: 'contact_created', label: 'Contacto creado', icon: '👤' },
  { value: 'tag_added', label: 'Etiqueta asignada', icon: '🏷️' },
  { value: 'tag_removed', label: 'Etiqueta removida', icon: '🏷️' },
  { value: 'segment_entered', label: 'Entra a segmento', icon: '📋' },
  { value: 'field_changed', label: 'Campo modificado', icon: '✏️' },
  { value: 'status_changed', label: 'Estado cambiado', icon: '🔄' },
  { value: 'lead_score_reached', label: 'Lead score alcanzado', icon: '⭐' },
] as const;

export const ACTION_TYPES = [
  { value: 'send_email', label: 'Enviar email', icon: '📧', color: '#2563EB' },
  { value: 'wait', label: 'Esperar', icon: '⏳', color: '#F59E0B' },
  { value: 'add_tag', label: 'Agregar etiqueta', icon: '🏷️', color: '#10B981' },
  { value: 'remove_tag', label: 'Quitar etiqueta', icon: '🏷️', color: '#EF4444' },
  { value: 'update_field', label: 'Actualizar campo', icon: '✏️', color: '#8B5CF6' },
  { value: 'update_status', label: 'Cambiar estado', icon: '🔄', color: '#6366F1' },
  { value: 'update_lead_score', label: 'Modificar lead score', icon: '⭐', color: '#F97316' },
  { value: 'add_to_segment', label: 'Agregar a segmento', icon: '📋', color: '#14B8A6' },
  { value: 'remove_from_segment', label: 'Quitar de segmento', icon: '📋', color: '#DC2626' },
] as const;

export const CONDITION_TYPES = [
  { value: 'has_tag', label: 'Tiene etiqueta' },
  { value: 'not_has_tag', label: 'No tiene etiqueta' },
  { value: 'lead_score_gt', label: 'Lead score mayor que' },
  { value: 'lead_score_lt', label: 'Lead score menor que' },
  { value: 'status_is', label: 'Estado es' },
  { value: 'field_equals', label: 'Campo igual a' },
  { value: 'in_segment', label: 'Está en segmento' },
  { value: 'not_in_segment', label: 'No está en segmento' },
] as const;

export interface AutomationNode {
  id: string;
  type: 'trigger' | 'action' | 'condition';
  position: { x: number; y: number };
  data: {
    label: string;
    nodeType: string; // e.g., 'send_email', 'wait', 'has_tag'
    config: Record<string, any>;
  };
}

export interface AutomationEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

export interface Automation {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'paused';
  trigger_type: string;
  trigger_config: Record<string, any>;
  workflow: { nodes: AutomationNode[]; edges: AutomationEdge[] };
  run_count: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}
