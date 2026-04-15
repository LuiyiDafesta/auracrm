import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { TablePagination } from '@/components/TablePagination';
import { Plus, Search, Pencil, Trash2, FolderOpen, Users, Megaphone, TrendingUp, CheckSquare } from 'lucide-react';

const PRESET_COLORS = ['#3B82F6', '#22C55E', '#EAB308', '#EF4444', '#8B5CF6', '#EC4899', '#F97316', '#14B8A6', '#6B7280', '#0EA5E9'];

interface Project {
  id: string;
  name: string;
  description: string | null;
  client_name: string | null;
  status: string;
  color: string;
  created_at: string;
  user_id: string;
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [counts, setCounts] = useState<Record<string, { contacts: number; campaigns: number; opportunities: number; tasks: number }>>({});
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState({ name: '', description: '', client_name: '', status: 'activo', color: '#3B82F6' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchData = async () => {
    if (!user) return;
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    const projs = (data as Project[]) || [];
    setProjects(projs);

    // Fetch counts
    const [pc, pca, po, pt] = await Promise.all([
      supabase.from('project_contacts').select('project_id'),
      supabase.from('project_campaigns').select('project_id'),
      supabase.from('project_opportunities').select('project_id'),
      supabase.from('project_tasks').select('project_id'),
    ]);

    const c: Record<string, { contacts: number; campaigns: number; opportunities: number; tasks: number }> = {};
    for (const p of projs) {
      c[p.id] = {
        contacts: ((pc.data || []) as any[]).filter(r => r.project_id === p.id).length,
        campaigns: ((pca.data || []) as any[]).filter(r => r.project_id === p.id).length,
        opportunities: ((po.data || []) as any[]).filter(r => r.project_id === p.id).length,
        tasks: ((pt.data || []) as any[]).filter(r => r.project_id === p.id).length,
      };
    }
    setCounts(c);
  };

  useEffect(() => { fetchData(); }, [user]);

  const resetForm = () => setForm({ name: '', description: '', client_name: '', status: 'activo', color: '#3B82F6' });

  const handleSave = async () => {
    if (!user || !form.name.trim()) return;
    const data = { ...form, user_id: user.id };
    let error;
    if (editing) {
      ({ error } = await supabase.from('projects').update(data).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('projects').insert(data));
    }
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Proyecto actualizado' : 'Proyecto creado' });
    setOpen(false); setEditing(null); resetForm();
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este proyecto?')) return;
    await supabase.from('projects').delete().eq('id', id);
    toast({ title: 'Proyecto eliminado' });
    fetchData();
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description || '', client_name: p.client_name || '', status: p.status, color: p.color });
    setOpen(true);
  };

  const filtered = projects.filter(p =>
    `${p.name} ${p.client_name || ''}`.toLowerCase().includes(search.toLowerCase())
  );
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Proyectos</h1>
          <p className="text-muted-foreground">{projects.length} proyecto{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Proyecto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Editar Proyecto' : 'Nuevo Proyecto'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><label className="text-sm font-medium">Nombre *</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Cliente</label><Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="Nombre del cliente" /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Descripción</label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado</label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="completado">Completado</SelectItem>
                      <SelectItem value="archivado">Archivado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Color</label>
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    {PRESET_COLORS.map(c => (
                      <button key={c} className={`w-6 h-6 rounded-full border-2 transition-all ${form.color === c ? 'ring-2 ring-primary ring-offset-2' : 'border-transparent'}`} style={{ backgroundColor: c }} onClick={() => setForm({ ...form, color: c })} />
                    ))}
                  </div>
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? 'Guardar cambios' : 'Crear proyecto'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar proyectos..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {paginated.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No hay proyectos aún</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paginated.map(p => {
                const c = counts[p.id] || { contacts: 0, campaigns: 0, opportunities: 0, tasks: 0 };
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border bg-card p-4 cursor-pointer hover:shadow-md transition-shadow group"
                    style={{ borderLeftWidth: '4px', borderLeftColor: p.color }}
                    onClick={() => navigate(`/proyectos/${p.id}`)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-base">{p.name}</h3>
                        {p.client_name && <p className="text-sm text-muted-foreground">{p.client_name}</p>}
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      <div className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c.contacts}</div>
                      <div className="flex items-center gap-1"><Megaphone className="h-3.5 w-3.5" />{c.campaigns}</div>
                      <div className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />{c.opportunities}</div>
                      <div className="flex items-center gap-1"><CheckSquare className="h-3.5 w-3.5" />{c.tasks}</div>
                    </div>
                    <Badge variant={p.status === 'activo' ? 'default' : 'secondary'} className="text-[10px]">
                      {p.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
          <TablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
        </CardContent>
      </Card>
    </div>
  );
}
