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
import { Plus, Search, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Task = Database['public']['Tables']['tasks']['Row'];

const priorityColors: Record<string, string> = {
  baja: 'bg-muted text-muted-foreground',
  media: 'bg-primary/10 text-primary',
  alta: 'bg-warning/10 text-warning',
  urgente: 'bg-destructive/10 text-destructive',
};

const statusLabels: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En Progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export default function Tasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState({ title: '', description: '', priority: 'media' as Task['priority'], status: 'pendiente' as Task['status'], due_date: '' });

  const fetchData = async () => {
    if (!user) return;
    const { data } = await supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false });
    setTasks(data || []);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const data = { ...form, user_id: user.id, due_date: form.due_date || null };
    let error;
    if (editing) {
      ({ error } = await supabase.from('tasks').update(data).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('tasks').insert(data));
    }
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Tarea actualizada' : 'Tarea creada' });
    setOpen(false); setEditing(null);
    setForm({ title: '', description: '', priority: 'media', status: 'pendiente', due_date: '' });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    toast({ title: 'Tarea eliminada' });
    fetchData();
  };

  const toggleComplete = async (task: Task) => {
    const newStatus = task.status === 'completada' ? 'pendiente' : 'completada';
    await supabase.from('tasks').update({ status: newStatus, completed_at: newStatus === 'completada' ? new Date().toISOString() : null }).eq('id', task.id);
    fetchData();
  };

  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({ title: t.title, description: t.description || '', priority: t.priority, status: t.status, due_date: t.due_date ? t.due_date.split('T')[0] : '' });
    setOpen(true);
  };

  const filtered = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tareas</h1>
          <p className="text-muted-foreground">Gestiona tus tareas</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm({ title: '', description: '', priority: 'media', status: 'pendiente', due_date: '' }); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nueva Tarea</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><label className="text-sm font-medium">Título *</label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Descripción</label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prioridad</label>
                  <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v as Task['priority'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baja">Baja</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado</label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as Task['status'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="en_progreso">En Progreso</SelectItem>
                      <SelectItem value="completada">Completada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><label className="text-sm font-medium">Fecha límite</label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? 'Guardar cambios' : 'Crear tarea'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar tareas..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha Límite</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No hay tareas</TableCell></TableRow>
              ) : filtered.map(t => (
                <TableRow key={t.id} className={t.status === 'completada' ? 'opacity-50' : ''}>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleComplete(t)}>
                      <CheckCircle2 className={`h-4 w-4 ${t.status === 'completada' ? 'text-success' : 'text-muted-foreground'}`} />
                    </Button>
                  </TableCell>
                  <TableCell className={`font-medium ${t.status === 'completada' ? 'line-through' : ''}`}>{t.title}</TableCell>
                  <TableCell><Badge className={priorityColors[t.priority]} variant="secondary">{t.priority}</Badge></TableCell>
                  <TableCell>{statusLabels[t.status]}</TableCell>
                  <TableCell>{t.due_date ? new Date(t.due_date).toLocaleDateString('es-ES') : '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
