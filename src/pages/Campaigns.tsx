import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];

const statusColors: Record<string, string> = {
  borrador: 'bg-muted text-muted-foreground',
  activa: 'bg-success/10 text-success',
  pausada: 'bg-warning/10 text-warning',
  completada: 'bg-primary/10 text-primary',
  cancelada: 'bg-destructive/10 text-destructive',
};

export default function Campaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState({ name: '', type: '', status: 'borrador' as Campaign['status'], start_date: '', end_date: '', budget: '', notes: '', from_email: '', from_name: '' });

  const fetchData = async () => {
    if (!user) return;
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    setCampaigns(data || []);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const data = { ...form, user_id: user.id, budget: form.budget ? parseFloat(form.budget) : null, start_date: form.start_date || null, end_date: form.end_date || null, from_email: form.from_email || null, from_name: form.from_name || null };
    let error;
    if (editing) {
      ({ error } = await supabase.from('campaigns').update(data).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('campaigns').insert(data));
    }
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Campaña actualizada' : 'Campaña creada' });
    setOpen(false); setEditing(null);
    setForm({ name: '', type: '', status: 'borrador', start_date: '', end_date: '', budget: '', notes: '', from_email: '', from_name: '' });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('campaigns').delete().eq('id', id);
    toast({ title: 'Campaña eliminada' });
    fetchData();
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({ name: c.name, type: c.type || '', status: c.status, start_date: c.start_date || '', end_date: c.end_date || '', budget: String(c.budget || ''), notes: c.notes || '', from_email: (c as any).from_email || '', from_name: (c as any).from_name || '' });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Campañas</h1><p className="text-muted-foreground">Gestiona tus campañas</p></div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm({ name: '', type: '', status: 'borrador', start_date: '', end_date: '', budget: '', notes: '', from_email: '', from_name: '' }); } }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nueva Campaña</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Editar Campaña' : 'Nueva Campaña'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-sm font-medium">Nombre *</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Tipo</label><Input value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} placeholder="Email, Social, etc." /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado</label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as Campaign['status'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="borrador">Borrador</SelectItem>
                      <SelectItem value="activa">Activa</SelectItem>
                      <SelectItem value="pausada">Pausada</SelectItem>
                      <SelectItem value="completada">Completada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><label className="text-sm font-medium">Presupuesto ($)</label><Input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-sm font-medium">Fecha inicio</label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Fecha fin</label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><label className="text-sm font-medium">Notas</label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={handleSave} className="w-full">{editing ? 'Guardar cambios' : 'Crear campaña'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Presupuesto</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No hay campañas</TableCell></TableRow>
              ) : campaigns.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.type || '—'}</TableCell>
                  <TableCell><Badge className={statusColors[c.status]} variant="secondary">{c.status}</Badge></TableCell>
                  <TableCell>{c.budget ? `$${Number(c.budget).toLocaleString()}` : '—'}</TableCell>
                  <TableCell>{c.start_date ? new Date(c.start_date).toLocaleDateString('es-ES') : '—'}</TableCell>
                  <TableCell>{c.end_date ? new Date(c.end_date).toLocaleDateString('es-ES') : '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/email-builder/new?campaign=${c.id}`)} title="Crear email"><Mail className="h-4 w-4 text-primary" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
