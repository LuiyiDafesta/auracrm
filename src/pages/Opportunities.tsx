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
import { Plus, Pencil, Trash2, Calendar, User, Building2, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type Opportunity = Database['public']['Tables']['opportunities']['Row'];
type Stage = Database['public']['Enums']['opportunity_stage'];

const STAGES: { value: Stage; label: string; color: string; headerColor: string }[] = [
  { value: 'prospecto', label: 'Prospecto', color: 'border-l-muted-foreground', headerColor: 'bg-muted' },
  { value: 'calificado', label: 'Calificado', color: 'border-l-blue-500', headerColor: 'bg-blue-500/10' },
  { value: 'propuesta', label: 'Propuesta', color: 'border-l-yellow-500', headerColor: 'bg-yellow-500/10' },
  { value: 'negociacion', label: 'Negociación', color: 'border-l-purple-500', headerColor: 'bg-purple-500/10' },
  { value: 'cerrado_ganado', label: 'Ganado', color: 'border-l-green-500', headerColor: 'bg-green-500/10' },
  { value: 'cerrado_perdido', label: 'Perdido', color: 'border-l-red-500', headerColor: 'bg-red-500/10' },
];

export default function Opportunities() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [form, setForm] = useState({ name: '', value: '', stage: 'prospecto' as Stage, expected_close_date: '', probability: '', contact_id: '', company_id: '', notes: '' });

  const fetchData = async () => {
    if (!user) return;
    const [o, c, co] = await Promise.all([
      supabase.from('opportunities').select('*').order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, first_name, last_name'),
      supabase.from('companies').select('id, name'),
    ]);
    setOpportunities(o.data || []);
    setContacts(c.data || []);
    setCompanies(co.data || []);
  };

  useEffect(() => { fetchData(); }, [user]);

  const resetForm = () => setForm({ name: '', value: '', stage: 'prospecto', expected_close_date: '', probability: '', contact_id: '', company_id: '', notes: '' });

  const handleSave = async () => {
    if (!user) return;
    const data = {
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

  const openCreateInStage = (stage: Stage) => {
    setEditing(null);
    resetForm();
    setForm(f => ({ ...f, stage }));
    setOpen(true);
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const oppId = result.draggableId;
    const newStage = result.destination.droppableId as Stage;
    // Optimistic update
    setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, stage: newStage } : o));
    const { error } = await supabase.from('opportunities').update({ stage: newStage }).eq('id', oppId);
    if (error) {
      toast({ title: 'Error al mover', variant: 'destructive' });
      fetchData();
    }
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

  const totalPipeline = opportunities.filter(o => o.stage !== 'cerrado_perdido').reduce((s, o) => s + (Number(o.value) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Oportunidades</h1>
          <p className="text-muted-foreground">Pipeline: <strong>${totalPipeline.toLocaleString()}</strong> · {opportunities.length} oportunidades</p>
        </div>
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
                  <Select value={form.stage} onValueChange={v => setForm({ ...form, stage: v as Stage })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
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

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 12rem)' }}>
          {STAGES.map(stage => {
            const stageOpps = opportunities.filter(o => o.stage === stage.value);
            const total = stageOpps.reduce((s, o) => s + (Number(o.value) || 0), 0);
            return (
              <div key={stage.value} className="flex-shrink-0 w-64 flex flex-col">
                {/* Column header */}
                <div className={`rounded-t-lg px-3 py-2 ${stage.headerColor}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{stage.label}</h3>
                    <Badge variant="secondary" className="text-[10px] h-5">{stageOpps.length}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">${total.toLocaleString()}</p>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={stage.value}>
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
                                className={`bg-card rounded-lg p-3 shadow-sm border border-l-4 ${stage.color} cursor-grab active:cursor-grabbing group transition-shadow ${snap.isDragging ? 'shadow-lg ring-2 ring-primary/20' : 'hover:shadow-md'}`}
                              >
                                {/* Title & actions */}
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

                                {/* Value */}
                                <div className="flex items-center gap-1 text-sm font-semibold text-primary mb-2">
                                  <DollarSign className="h-3.5 w-3.5" />
                                  {Number(o.value || 0).toLocaleString()}
                                </div>

                                {/* Probability bar */}
                                {(o.probability !== null && o.probability > 0) && (
                                  <div className="mb-2">
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                                      <span>Probabilidad</span>
                                      <span>{o.probability}%</span>
                                    </div>
                                    <Progress value={o.probability} className="h-1.5" />
                                  </div>
                                )}

                                {/* Meta info */}
                                <div className="space-y-1">
                                  {contactName && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => o.contact_id && navigate(`/contactos/${o.contact_id}`)}>
                                      <User className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{contactName}</span>
                                    </div>
                                  )}
                                  {companyName && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Building2 className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{companyName}</span>
                                    </div>
                                  )}
                                  {o.expected_close_date && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3 shrink-0" />
                                      <span>{new Date(o.expected_close_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Notes preview */}
                                {o.notes && (
                                  <p className="text-[10px] text-muted-foreground mt-2 line-clamp-2 italic">{o.notes}</p>
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}

                      {/* Add button at bottom */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground hover:text-foreground mt-1"
                        onClick={() => openCreateInStage(stage.value)}
                      >
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
