import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { WorkflowEditor } from '@/components/automations/WorkflowEditor';
import { TRIGGER_TYPES } from '@/components/automations/types';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';

export default function AutomationEditorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const isNew = id === 'nueva';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('contact_created');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user || isNew) {
      // Create default trigger node
      const triggerNode: Node = {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 250, y: 50 },
        data: { label: 'Contacto creado', nodeType: 'contact_created', config: {} },
      };
      setNodes([triggerNode]);
      setEdges([]);
      setLoaded(true);
      return;
    }

    // Load existing automation
    (supabase.from('automations' as any).select('*').eq('id', id).single() as any).then(({ data }: any) => {
      if (data) {
        setName(data.name);
        setDescription(data.description || '');
        setTriggerType(data.trigger_type);
        setTriggerConfig(data.trigger_config || {});
        const wf = data.workflow || { nodes: [], edges: [] };
        setNodes(wf.nodes || []);
        setEdges(wf.edges || []);
      }
      setLoaded(true);
    });
  }, [user, id, isNew]);

  const handleTriggerChange = (value: string) => {
    setTriggerType(value);
    const trigger = TRIGGER_TYPES.find(t => t.value === value);
    // Update trigger node - create new array reference so WorkflowEditor picks up the change
    setNodes(nds => {
      const updated = nds.map(n =>
        n.type === 'trigger'
          ? { ...n, data: { ...n.data, nodeType: value, label: trigger?.label || value, config: {} } }
          : n
      );
      return [...updated];
    });
    setTriggerConfig({});
  };

  const handleWorkflowChange = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    setNodes(newNodes);
    setEdges(newEdges);
  }, []);

  const handleSave = async () => {
    if (!user || !name.trim()) {
      toast({ title: 'Error', description: 'Ingresa un nombre', variant: 'destructive' });
      return;
    }
    setSaving(true);

    // Extract trigger config from trigger node
    const triggerNode = nodes.find(n => n.type === 'trigger');
    const finalTriggerConfig = triggerNode?.data?.config || triggerConfig;

    const payload: any = {
      user_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      trigger_type: triggerType,
      trigger_config: finalTriggerConfig,
      workflow: { nodes, edges },
    };

    let error;
    if (isNew) {
      ({ error } = await (supabase.from('automations' as any).insert(payload) as any));
    } else {
      ({ error } = await (supabase.from('automations' as any).update(payload).eq('id', id) as any));
    }

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: isNew ? 'Automatización creada' : 'Automatización guardada' });
      navigate('/automatizaciones');
    }
    setSaving(false);
  };

  if (!loaded) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-4 bg-background shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate('/automatizaciones')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex items-center gap-3">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nombre de la automatización"
            className="max-w-xs font-semibold"
          />
          <Select value={triggerType} onValueChange={handleTriggerChange}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Trigger" />
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Descripción (opcional)"
          className="max-w-xs text-sm"
        />
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar
        </Button>
      </div>

      {/* Workflow canvas */}
      <div className="flex-1">
        <WorkflowEditor
          initialNodes={nodes}
          initialEdges={edges}
          onChange={handleWorkflowChange}
        />
      </div>
    </div>
  );
}
