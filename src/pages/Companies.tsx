import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Company = Database['public']['Tables']['companies']['Row'];

export default function Companies() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: '', industry: '', website: '', phone: '', email: '', address: '', city: '', country: '', size: '', notes: '' });

  const fetchData = async () => {
    if (!user) return;
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
    setCompanies(data || []);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const data = { ...form, user_id: user.id };
    let error;
    if (editing) {
      ({ error } = await supabase.from('companies').update(data).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('companies').insert(data));
    }
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Empresa actualizada' : 'Empresa creada' });
    setOpen(false); setEditing(null);
    setForm({ name: '', industry: '', website: '', phone: '', email: '', address: '', city: '', country: '', size: '', notes: '' });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('companies').delete().eq('id', id);
    toast({ title: 'Empresa eliminada' });
    fetchData();
  };

  const openEdit = (c: Company) => {
    setEditing(c);
    setForm({ name: c.name, industry: c.industry || '', website: c.website || '', phone: c.phone || '', email: c.email || '', address: c.address || '', city: c.city || '', country: c.country || '', size: c.size || '', notes: c.notes || '' });
    setOpen(true);
  };

  const filtered = companies.filter(c => `${c.name} ${c.industry}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Empresas</h1>
          <p className="text-muted-foreground">Gestiona tus empresas</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm({ name: '', industry: '', website: '', phone: '', email: '', address: '', city: '', country: '', size: '', notes: '' }); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nueva Empresa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Editar Empresa' : 'Nueva Empresa'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-sm font-medium">Nombre *</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Industria</label><Input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-sm font-medium">Sitio web</label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Teléfono</label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-sm font-medium">Email</label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Tamaño</label><Input value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} placeholder="1-10, 11-50, 51-200..." /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><label className="text-sm font-medium">Dirección</label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Ciudad</label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-sm font-medium">País</label><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><label className="text-sm font-medium">Notas</label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={handleSave} className="w-full">{editing ? 'Guardar cambios' : 'Crear empresa'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar empresas..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Industria</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No hay empresas</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.industry || '—'}</TableCell>
                  <TableCell>{c.phone || '—'}</TableCell>
                  <TableCell>{c.email || '—'}</TableCell>
                  <TableCell>{c.city || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
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
