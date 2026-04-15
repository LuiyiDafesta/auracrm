import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, Pencil, Trash2, Calendar, User, Building2, DollarSign, Settings, GripVertical, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Stage {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  user_id: string;
}

interface Opportunity {
  id: string;
  name: string;
  value: number | null;
  stage: string;
  probability: number | null;
  expected_close_date: string | null;
  contact_id: string | null;
  company_id: string | null;
  notes: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_STAGES = [
  { name: 'Prospecto', color: '#6B7280', sort_order: 0 },
  { name: 'Calificado', color: '#3B82F6', sort_order: 1 },
  { name: 'Propuesta', color: '#EAB308', sort_order: 2 },
  { name: 'Negociación', color: '#8B5CF6', sort_order: 3 },
  { name: 'Ganado', color: '#22C55E', sort_order: 4 },
  { name: 'Perdido', color: '#EF4444', sort_order: 5 },
];

const PRESET_COLORS = ['#6B7280', '#3B82F6', '#EAB308', '#8B5CF6', '#22C55E', '#EF4444', '#F97316', '#EC4899', '#14B8A6', '#0EA5E9'];

export default function Opportunities() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [form, setForm] = useState({ name: '', value: '', stage: '', expected_close_date: '', probability: '', contact_id: '', company_id: '', notes: '' });
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#3B82F6');

  const fetchData = async () => {
    if (!user) return;
    const [o, s, c, co] = await Promise.all([
      supabase.from('opportunities').select('*').order('created_at', { ascending: false }),
      supabase.from('opportunity_stages').select('*').order('sort_order'),
      supabase.from('contacts').select('id, first_name, last_name'),
      supabase.from('companies').select('id, name'),
    ]);
    setOpportunities((o.data as any[]) || []);
    setContacts(c.data || []);
    setCompanies(co.data || []);

    let stagesData = (s.data as Stage[]) || [];
    // Seed default stages if none exist
    if (stagesData.length === 0) {
      const toInsert = DEFAULT_STAGES.map(st => ({ ...st, user_id: user.id }));
      const { data: inserted } = await supabase.from('opportunity_stages').insert(toInsert).select();
      stagesData = (inserted as Stage[]) || [];
    }
    setStages(stagesData);
    // Set default stage for form
    if (stagesData.length > 0 && !form.stage) {
      setForm(f => ({ ...f, stage: stagesData[0].name }));
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const resetForm = () => setForm({ name: '', value: '', stage: stages[0]?.name || '', expected_close_date: '', probability: '', contact_id: '', company_id: '', notes: '' });

  const handleSave = async () => {
    if (!user) return;
    const data: any = {
      name: form.name,
      value: form.value ? parseFloat(form.value) : 0,
      stage: form.stage,
      expected_close_date: form.expected_close_date || null,
      probability: form.probability ? parseInt(form.probability) : 0,
      contact_id: form.contact_id || null,
      company_id: form.company_id || null,
      notes: form.notes || null,
      user_id: user.id,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('opportunities').update(data).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('opportunities').insert(data));
    }
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Oportunidad actualizada' : 'Oportunidad creada' });
    setOpen(false); setEditing(null); resetForm();
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('opportunities').delete().eq('id', id);
    toast({ title: 'Oportunidad eliminada' });
    fetchData();
  };

  const openEdit = (o: Opportunity) => {
    setEditing(o);
    setForm({ name: o.name, value: String(o.value || ''), stage: o.stage, expected_close_date: o.expected_close_date || '', probability: String(o.probability || ''), contact_id: o.contact_id || '', company_id: o.company_id || '', notes: o.notes || '' });
    setOpen(true);
  };

  const openCreateInStage = (stageName: string) => {
    setEditing(null);
    resetForm();
    setForm(f => ({ ...f, stage: stageName }));
    setOpen(true);
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const oppId = result.draggableId;
    const newStage = result.destination.droppableId;
    setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, stage: newStage } : o));
    const { error } = await supabase.from('opportunities').update({ stage: newStage }).eq('id', oppId);
    if (error) {
      toast({ title: 'Error al mover', variant: 'destructive' });
      fetchData();
    }
  };

  // --- Stage management ---
  const addStage = async () => {
    if (!user || !newStageName.trim()) return;
    const { error } = await supabase.from('opportunity_stages').insert({
      user_id: user.id,
      name: newStageName.trim(),
      color: newStageColor,
      sort_order: stages.length,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setNewStageName('');
    setNewStageColor('#3B82F6');
    fetchData();
  };

  const deleteStage = async (stageId: string, stageName: string) => {
    const hasOpps = opportunities.some(o => o.stage === stageName);
    if (hasOpps) {
      toast({ title: 'No se puede eliminar', description: 'Hay oportunidades en esta etapa. Muévelas primero.', variant: 'destructive' });
      return;
    }
    await supabase.from('opportunity_stages').delete().eq('id', stageId);
    fetchData();
  };

  const updateStageColor = async (stageId: string, color: string) => {
    await supabase.from('opportunity_stages').update({ color }).eq('id', stageId);
    setStages(prev => prev.map(s => s.id === stageId ? { ...s, color } : s));
  };

  const getContactName = (id: string | null) => {
    if (!id) return null;
    const c = contacts.find(c => c.id === id);
    return c ? `${c.first_name} ${c.last_name || ''}`.trim() : null;
  };
  const getCompanyName = (id: string | null) => {
    if (!id) return null;
    const c = companies.find(c => c.id === id);
    return c?.name || null;
  };

  const totalPipeline = opportunities.filter(o => {
    const lostStage = stages.find(s => s.name.toLowerCase().includes('perdido'));
    return !lostStage || o.stage !== lostStage.name;
  }).reduce((s, o) => s + (Number(o.value) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Oportunidades</h1>
          <p className="text-muted-foreground">Pipeline: <strong>${totalPipeline.toLocaleString()}</strong> · {opportunities.length} oportunidades</p>
        </div>
        <div className="flex gap-2">
          {/* Stage config dialog */}
          <Dialog open={stagesOpen} onOpenChange={setStagesOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon"><Settings className="h-4 w-4" /></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Configurar Etapas</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  {stages.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="w-6 h-6 rounded-full shrink-0 border" style={{ backgroundColor: s.color }} />
                      <span className="flex-1 text-sm font-medium">{s.name}</span>
                      <div className="flex gap-1">
                        {PRESET_COLORS.filter(c => c !== s.color).slice(0, 3).map(c => (
                          <button key={c} className="w-4 h-4 rounded-full border hover:ring-2 ring-primary/50" style={{ backgroundColor: c }} onClick={() => updateStageColor(s.id, c)} />
                        ))}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteStage(s.id, s.name)}>
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Nueva etapa..." value={newStageName} onChange={e => setNewStageName(e.target.value)} className="flex-1" />
                  <div className="flex gap-1 items-center">
                    {PRESET_COLORS.slice(0, 5).map(c => (
                      <button key={c} className={`w-5 h-5 rounded-full border-2 ${newStageColor === c ? 'ring-2 ring-primary' : ''}`} style={{ backgroundColor: c }} onClick={() => setNewStageColor(c)} />
                    ))}
                  </div>
                  <Button size="sm" onClick={addStage} disabled={!newStageName.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* New opportunity dialog */}
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nueva Oportunidad</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? 'Editar Oportunidad' : 'Nueva Oportunidad'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><label className="text-sm font-medium">Nombre *</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-sm font-medium">Valor ($)</label><Input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></div>
                  <div className="space-y-2"><label className="text-sm font-medium">Probabilidad (%)</label><Input type="number" min="0" max="100" value={form.probability} onChange={e => setForm({ ...form, probability: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Etapa</label>
                    <Select value={form.stage} onValueChange={v => setForm({ ...form, stage: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><label className="text-sm font-medium">Fecha cierre</label><Input type="date" value={form.expected_close_date} onChange={e => setForm({ ...form, expected_close_date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Contacto</label>
                    <Select value={form.contact_id} onValueChange={v => setForm({ ...form, contact_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>{contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Empresa</label>
                    <Select value={form.company_id} onValueChange={v => setForm({ ...form, company_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><label className="text-sm font-medium">Notas</label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                <Button onClick={handleSave} className="w-full">{editing ? 'Guardar cambios' : 'Crear oportunidad'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 12rem)' }}>
          {stages.map(stage => {
            const stageOpps = opportunities.filter(o => o.stage === stage.name);
            const total = stageOpps.reduce((s, o) => s + (Number(o.value) || 0), 0);
            return (
              <div key={stage.id} className="flex-shrink-0 w-64 flex flex-col">
                <div className="rounded-t-lg px-3 py-2" style={{ backgroundColor: `${stage.color}15` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      <h3 className="font-semibold text-sm">{stage.name}</h3>
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-5">{stageOpps.length}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">${total.toLocaleString()}</p>
                </div>

                <Droppable droppableId={stage.name}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 rounded-b-lg border border-t-0 p-2 space-y-2 transition-colors ${snapshot.isDraggingOver ? 'bg-accent/50' : 'bg-muted/30'}`}
                    >
                      {stageOpps.map((o, index) => {
                        const contactName = getContactName(o.contact_id);
                        const companyName = getCompanyName(o.company_id);
                        return (
                          <Draggable key={o.id} draggableId={o.id} index={index}>
                            {(prov, snap) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                className={`bg-card rounded-lg p-3 shadow-sm border cursor-grab active:cursor-grabbing group transition-shadow ${snap.isDragging ? 'shadow-lg ring-2 ring-primary/20' : 'hover:shadow-md'}`}
                                style={{ ...prov.draggableProps.style, borderLeftWidth: '4px', borderLeftColor: stage.color }}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <p className="font-medium text-sm leading-tight">{o.name}</p>
                                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openEdit(o); }}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDelete(o.id); }}>
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 text-sm font-semibold text-primary mb-2">
                                  <DollarSign className="h-3.5 w-3.5" />
                                  {Number(o.value || 0).toLocaleString()}
                                </div>
                                {(o.probability !== null && o.probability > 0) && (
                                  <div className="mb-2">
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                                      <span>Probabilidad</span><span>{o.probability}%</span>
                                    </div>
                                    <Progress value={o.probability} className="h-1.5" />
                                  </div>
                                )}
                                <div className="space-y-1">
                                  {contactName && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => o.contact_id && navigate(`/contactos/${o.contact_id}`)}>
                                      <User className="h-3 w-3 shrink-0" /><span className="truncate">{contactName}</span>
                                    </div>
                                  )}
                                  {companyName && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Building2 className="h-3 w-3 shrink-0" /><span className="truncate">{companyName}</span>
                                    </div>
                                  )}
                                  {o.expected_close_date && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3 shrink-0" />
                                      <span>{new Date(o.expected_close_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                                    </div>
                                  )}
                                </div>
                                {o.notes && <p className="text-[10px] text-muted-foreground mt-2 line-clamp-2 italic">{o.notes}</p>}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                      <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground mt-1" onClick={() => openCreateInStage(stage.name)}>
                        <Plus className="h-3 w-3 mr-1" /> Agregar
                      </Button>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
