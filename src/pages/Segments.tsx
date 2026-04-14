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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Users, Filter } from 'lucide-react';

interface SegmentRule {
  field: string;
  operator: string;
  value: string;
}

const FIELDS = [
  { value: 'status', label: 'Estado' },
  { value: 'position', label: 'Cargo' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'first_name', label: 'Nombre' },
  { value: 'last_name', label: 'Apellido' },
  { value: 'tag', label: 'Etiqueta' },
];

const OPERATORS = [
  { value: 'equals', label: 'es igual a' },
  { value: 'not_equals', label: 'no es igual a' },
  { value: 'contains', label: 'contiene' },
  { value: 'not_contains', label: 'no contiene' },
  { value: 'is_empty', label: 'está vacío' },
  { value: 'is_not_empty', label: 'no está vacío' },
];

export default function Segments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [segments, setSegments] = useState<any[]>([]);
  const [segmentCounts, setSegmentCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [rules, setRules] = useState<SegmentRule[]>([{ field: 'status', operator: 'equals', value: '' }]);

  const fetchSegments = async () => {
    if (!user) return;
    const { data } = await supabase.from('segments').select('*').order('created_at', { ascending: false });
    setSegments(data || []);

    // Count contacts per segment
    if (data) {
      const counts: Record<string, number> = {};
      for (const seg of data) {
        const count = await countContactsForRules(seg.rules as unknown as SegmentRule[]);
        counts[seg.id] = count;
      }
      setSegmentCounts(counts);
    }
  };

  const countContactsForRules = async (segRules: SegmentRule[]): Promise<number> => {
    if (!user) return 0;
    // Build filters manually to avoid deep type instantiation
    const filters: { column: string; op: string; value: string }[] = [];
    for (const rule of segRules) {
      if (rule.field === 'tag') continue;
      filters.push({ column: rule.field, op: rule.operator, value: rule.value });
    }

    let query = supabase.from('contacts').select('id', { count: 'exact', head: true }) as any;
    for (const f of filters) {
      switch (f.op) {
        case 'equals': query = query.eq(f.column, f.value); break;
        case 'not_equals': query = query.neq(f.column, f.value); break;
        case 'contains': query = query.ilike(f.column, `%${f.value}%`); break;
        case 'not_contains': query = query.not(f.column, 'ilike', `%${f.value}%`); break;
        case 'is_empty': query = query.is(f.column, null); break;
        case 'is_not_empty': query = query.not(f.column, 'is', null); break;
      }
    }

    const { count } = await query;
    return count || 0;
  };

  useEffect(() => { fetchSegments(); }, [user]);

  const handleSave = async () => {
    if (!user || !form.name.trim()) return;
    const data = { name: form.name, description: form.description || null, rules: rules as any, user_id: user.id };
    let error;
    if (editing) {
      ({ error } = await supabase.from('segments').update(data).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('segments').insert(data));
    }
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Segmento actualizado' : 'Segmento creado' });
    resetForm();
    fetchSegments();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('segments').delete().eq('id', id);
    toast({ title: 'Segmento eliminado' });
    fetchSegments();
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({ name: s.name, description: s.description || '' });
    setRules(s.rules as SegmentRule[] || [{ field: 'status', operator: 'equals', value: '' }]);
    setOpen(true);
  };

  const resetForm = () => {
    setOpen(false);
    setEditing(null);
    setForm({ name: '', description: '' });
    setRules([{ field: 'status', operator: 'equals', value: '' }]);
  };

  const addRule = () => setRules([...rules, { field: 'status', operator: 'equals', value: '' }]);
  const removeRule = (i: number) => setRules(rules.filter((_, idx) => idx !== i));
  const updateRule = (i: number, key: keyof SegmentRule, val: string) => {
    const updated = [...rules];
    updated[i] = { ...updated[i], [key]: val };
    setRules(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Segmentos</h1>
          <p className="text-muted-foreground">Agrupa contactos con filtros inteligentes</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Segmento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? 'Editar Segmento' : 'Nuevo Segmento'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre *</label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Clientes VIP" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descripción</label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descripción opcional" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2"><Filter className="h-4 w-4" />Reglas de filtrado</label>
                  <Button variant="outline" size="sm" onClick={addRule}><Plus className="h-3 w-3 mr-1" />Agregar regla</Button>
                </div>
                {rules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/50 p-3 rounded-lg">
                    {i > 0 && <Badge variant="secondary" className="text-xs shrink-0">Y</Badge>}
                    <Select value={rule.field} onValueChange={v => updateRule(i, 'field', v)}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>{FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={rule.operator} onValueChange={v => updateRule(i, 'operator', v)}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>{OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
                      <Input className="flex-1" value={rule.value} onChange={e => updateRule(i, 'value', e.target.value)} placeholder="Valor..." />
                    )}
                    {rules.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeRule(i)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    )}
                  </div>
                ))}
              </div>

              <Button onClick={handleSave} className="w-full">{editing ? 'Guardar cambios' : 'Crear segmento'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {segments.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="pt-6 text-center text-muted-foreground">
              No hay segmentos. Crea uno para agrupar contactos automáticamente.
            </CardContent>
          </Card>
        ) : segments.map(s => (
          <Card key={s.id} className="group">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{s.name}</CardTitle>
                  {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(s.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Users className="h-4 w-4" />
                <span>{segmentCounts[s.id] ?? '...'} contactos</span>
              </div>
              <div className="space-y-1">
                {(s.rules as SegmentRule[]).map((r, i) => (
                  <div key={i} className="text-xs bg-muted/50 rounded px-2 py-1">
                    {i > 0 && <span className="font-medium mr-1">Y</span>}
                    <span className="font-medium">{FIELDS.find(f => f.value === r.field)?.label}</span>{' '}
                    <span className="text-muted-foreground">{OPERATORS.find(o => o.value === r.operator)?.label}</span>{' '}
                    {r.value && <span className="font-medium">"{r.value}"</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
