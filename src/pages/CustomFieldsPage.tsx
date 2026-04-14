import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';
import { CopyId } from '@/components/CopyId';

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'textarea', label: 'Texto largo' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'select', label: 'Selección' },
  { value: 'checkbox', label: 'Casilla' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Teléfono' },
];

interface CustomField {
  id: string;
  name: string;
  field_type: string;
  options: string[];
  is_required: boolean;
  sort_order: number;
  is_visible: boolean;
}

export default function CustomFieldsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomField | null>(null);
  const [form, setForm] = useState({ name: '', field_type: 'text', options: '', is_required: false, is_visible: true });

  const fetchFields = async () => {
    if (!user) return;
    const { data } = await supabase.from('custom_fields').select('*').order('sort_order');
    setFields((data as any[])?.map(d => ({ ...d, options: d.options || [] })) || []);
  };

  useEffect(() => { fetchFields(); }, [user]);

  const handleSave = async () => {
    if (!user || !form.name.trim()) return;
    const options = form.field_type === 'select'
      ? form.options.split('\n').map(o => o.trim()).filter(Boolean)
      : [];
    const data = {
      name: form.name,
      field_type: form.field_type,
      options: options as any,
      is_required: form.is_required,
      is_visible: form.is_visible,
      user_id: user.id,
      sort_order: editing ? editing.sort_order : fields.length,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('custom_fields').update(data).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('custom_fields').insert(data));
    }
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Campo actualizado' : 'Campo creado' });
    resetForm();
    fetchFields();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('custom_fields').delete().eq('id', id);
    toast({ title: 'Campo eliminado' });
    fetchFields();
  };

  const toggleVisibility = async (field: CustomField) => {
    await supabase.from('custom_fields').update({ is_visible: !field.is_visible }).eq('id', field.id);
    fetchFields();
  };

  const openEdit = (f: CustomField) => {
    setEditing(f);
    setForm({
      name: f.name,
      field_type: f.field_type,
      options: Array.isArray(f.options) ? f.options.join('\n') : '',
      is_required: f.is_required,
      is_visible: f.is_visible,
    });
    setOpen(true);
  };

  const resetForm = () => {
    setOpen(false);
    setEditing(null);
    setForm({ name: '', field_type: 'text', options: '', is_required: false, is_visible: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campos Personalizados</h1>
          <p className="text-muted-foreground">Define campos adicionales para tus contactos</p>
        </div>
        <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Campo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Editar Campo' : 'Nuevo Campo'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre del campo *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Fecha de nacimiento" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de dato</label>
                <Select value={form.field_type} onValueChange={v => setForm({ ...form, field_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.field_type === 'select' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Opciones (una por línea)</label>
                  <textarea
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                    value={form.options}
                    onChange={e => setForm({ ...form, options: e.target.value })}
                    placeholder={"Opción 1\nOpción 2\nOpción 3"}
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Obligatorio</label>
                <Switch checked={form.is_required} onCheckedChange={v => setForm({ ...form, is_required: v })} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Visible por defecto</label>
                <Switch checked={form.is_visible} onCheckedChange={v => setForm({ ...form, is_visible: v })} />
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? 'Guardar cambios' : 'Crear campo'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {fields.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay campos personalizados. Crea uno para extender la información de tus contactos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Obligatorio</TableHead>
                  <TableHead>Visible</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map(f => (
                  <TableRow key={f.id}>
                    <TableCell><CopyId id={f.id} /></TableCell>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{FIELD_TYPES.find(t => t.value === f.field_type)?.label || f.field_type}</Badge>
                    </TableCell>
                    <TableCell>{f.is_required ? '✓' : '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleVisibility(f)}>
                        {f.is_visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(f.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
