import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { TagManager } from '@/components/TagManager';
import type { Database } from '@/integrations/supabase/types';

type Contact = Database['public']['Tables']['contacts']['Row'];
type Company = Database['public']['Tables']['companies']['Row'];

export default function Contacts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', position: '', company_id: '', status: 'activo', notes: '' });

  const fetchData = async () => {
    if (!user) return;
    const [c, co] = await Promise.all([
      supabase.from('contacts').select('*').order('created_at', { ascending: false }),
      supabase.from('companies').select('*').order('name'),
    ]);
    setContacts(c.data || []);
    setCompanies(co.data || []);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const data = { ...form, user_id: user.id, company_id: form.company_id || null };
    let error;
    if (editing) {
      ({ error } = await supabase.from('contacts').update(data).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('contacts').insert(data));
    }
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Contacto actualizado' : 'Contacto creado' });
    setOpen(false);
    setEditing(null);
    setForm({ first_name: '', last_name: '', email: '', phone: '', position: '', company_id: '', status: 'activo', notes: '' });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('contacts').delete().eq('id', id);
    toast({ title: 'Contacto eliminado' });
    fetchData();
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({ first_name: c.first_name, last_name: c.last_name || '', email: c.email || '', phone: c.phone || '', position: c.position || '', company_id: c.company_id || '', status: c.status, notes: c.notes || '' });
    setOpen(true);
  };

  const filtered = contacts.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const getCompanyName = (id: string | null) => companies.find(c => c.id === id)?.name || '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contactos</h1>
          <p className="text-muted-foreground">Gestiona tus contactos</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm({ first_name: '', last_name: '', email: '', phone: '', position: '', company_id: '', status: 'activo', notes: '' }); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Contacto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Contacto' : 'Nuevo Contacto'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre *</label>
                  <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Apellido</label>
                  <Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Teléfono</label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cargo</label>
                  <Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Empresa</label>
                  <Select value={form.company_id} onValueChange={v => setForm({ ...form, company_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notas</label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? 'Guardar cambios' : 'Crear contacto'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar contactos..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Puntuación</TableHead>
                <TableHead>Etiquetas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No hay contactos</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/contactos/${c.id}`)}>
                  <TableCell className="font-medium">{c.first_name} {c.last_name}</TableCell>
                  <TableCell>{c.email || '—'}</TableCell>
                  <TableCell>{getCompanyName(c.company_id)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${(c as any).lead_score >= 80 ? 'bg-green-500' : (c as any).lead_score >= 50 ? 'bg-yellow-500' : (c as any).lead_score >= 20 ? 'bg-orange-500' : 'bg-muted-foreground/50'}`} style={{ width: `${(c as any).lead_score || 0}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{(c as any).lead_score || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell><TagManager contactId={c.id} /></TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${c.status === 'activo' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                      {c.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
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
