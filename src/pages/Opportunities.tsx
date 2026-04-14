import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Opportunity = Database['public']['Tables']['opportunities']['Row'];
type Stage = Database['public']['Enums']['opportunity_stage'];

const STAGES: { value: Stage; label: string; color: string }[] = [
  { value: 'prospecto', label: 'Prospecto', color: 'bg-muted' },
  { value: 'calificado', label: 'Calificado', color: 'bg-primary/10' },
  { value: 'propuesta', label: 'Propuesta', color: 'bg-warning/10' },
  { value: 'negociacion', label: 'Negociación', color: 'bg-primary/20' },
  { value: 'cerrado_ganado', label: 'Cerrado Ganado', color: 'bg-success/10' },
  { value: 'cerrado_perdido', label: 'Cerrado Perdido', color: 'bg-destructive/10' },
];

export default function Opportunities() {
  const { user } = useAuth();
  const { toast } = useToast();
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
    setOpen(false); setEditing(null);
    setForm({ name: '', value: '', stage: 'prospecto', expected_close_date: '', probability: '', contact_id: '', company_id: '', notes: '' });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('opportunities').delete().eq('id', id);
    toast({ title: 'Oportunidad eliminada' });
    fetchData();
  };

  const handleStageChange = async (id: string, stage: Stage) => {
    await supabase.from('opportunities').update({ stage }).eq('id', id);
    fetchData();
  };

  const openEdit = (o: Opportunity) => {
    setEditing(o);
    setForm({ name: o.name, value: String(o.value || ''), stage: o.stage, expected_close_date: o.expected_close_date || '', probability: String(o.probability || ''), contact_id: o.contact_id || '', company_id: o.company_id || '', notes: o.notes || '' });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Oportunidades</h1>
          <p className="text-muted-foreground">Pipeline de ventas</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm({ name: '', value: '', stage: 'prospecto', expected_close_date: '', probability: '', contact_id: '', company_id: '', notes: '' }); } }}>
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

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {STAGES.map(stage => {
          const stageOpps = opportunities.filter(o => o.stage === stage.value);
          const total = stageOpps.reduce((s, o) => s + (Number(o.value) || 0), 0);
          return (
            <Card key={stage.value} className={stage.color}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{stage.label}</CardTitle>
                <p className="text-xs text-muted-foreground">{stageOpps.length} · ${total.toLocaleString()}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {stageOpps.map(o => (
                  <div key={o.id} className="bg-card rounded-lg p-3 shadow-sm border group">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{o.name}</p>
                        <p className="text-xs text-muted-foreground">${Number(o.value || 0).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(o)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(o.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
