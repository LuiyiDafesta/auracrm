import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Users, Filter, UserPlus, X, Search, Eye } from 'lucide-react';

interface SegmentRule {
  field: string;
  operator: string;
  value: string;
}

interface CustomField {
  id: string;
  name: string;
  field_type: string;
}

const BASE_FIELDS = [
  { value: 'status', label: 'Estado', type: 'text' },
  { value: 'position', label: 'Cargo', type: 'text' },
  { value: 'email', label: 'Email', type: 'text' },
  { value: 'phone', label: 'Teléfono', type: 'text' },
  { value: 'first_name', label: 'Nombre', type: 'text' },
  { value: 'last_name', label: 'Apellido', type: 'text' },
  { value: 'lead_score', label: 'Puntuación', type: 'number' },
  { value: 'created_at', label: 'Fecha de creación', type: 'date' },
  { value: 'tag', label: 'Etiqueta', type: 'tag' },
];

const TEXT_OPERATORS = [
  { value: 'equals', label: 'es igual a' },
  { value: 'not_equals', label: 'no es igual a' },
  { value: 'contains', label: 'contiene' },
  { value: 'not_contains', label: 'no contiene' },
  { value: 'starts_with', label: 'empieza con' },
  { value: 'ends_with', label: 'termina con' },
  { value: 'is_empty', label: 'está vacío' },
  { value: 'is_not_empty', label: 'no está vacío' },
];

const NUMBER_OPERATORS = [
  { value: 'equals', label: 'es igual a' },
  { value: 'not_equals', label: 'no es igual a' },
  { value: 'greater_than', label: 'mayor que' },
  { value: 'less_than', label: 'menor que' },
  { value: 'greater_or_equal', label: 'mayor o igual' },
  { value: 'less_or_equal', label: 'menor o igual' },
  { value: 'between', label: 'entre' },
  { value: 'is_empty', label: 'está vacío' },
  { value: 'is_not_empty', label: 'no está vacío' },
];

const DATE_OPERATORS = [
  { value: 'equals', label: 'es igual a' },
  { value: 'greater_than', label: 'después de' },
  { value: 'less_than', label: 'antes de' },
  { value: 'between', label: 'entre' },
  { value: 'days_ago_less', label: 'hace menos de X días' },
  { value: 'days_ago_more', label: 'hace más de X días' },
  { value: 'is_empty', label: 'está vacío' },
  { value: 'is_not_empty', label: 'no está vacío' },
];

const TAG_OPERATORS = [
  { value: 'has_tag', label: 'tiene la etiqueta' },
  { value: 'not_has_tag', label: 'no tiene la etiqueta' },
  { value: 'has_any_tag', label: 'tiene alguna etiqueta' },
  { value: 'has_no_tags', label: 'no tiene etiquetas' },
];

function getFieldType(fieldValue: string, customFields: CustomField[]): string {
  const base = BASE_FIELDS.find(f => f.value === fieldValue);
  if (base) return base.type;
  const custom = customFields.find(f => `cf_${f.id}` === fieldValue);
  if (custom) {
    if (['number'].includes(custom.field_type)) return 'number';
    if (['date'].includes(custom.field_type)) return 'date';
    return 'text';
  }
  return 'text';
}

function getOperatorsForType(type: string) {
  switch (type) {
    case 'number': return NUMBER_OPERATORS;
    case 'date': return DATE_OPERATORS;
    case 'tag': return TAG_OPERATORS;
    default: return TEXT_OPERATORS;
  }
}

export default function Segments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [segments, setSegments] = useState<any[]>([]);
  const [segmentCounts, setSegmentCounts] = useState<Record<string, number>>({});
  const [manualCounts, setManualCounts] = useState<Record<string, number>>({});
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [rules, setRules] = useState<SegmentRule[]>([{ field: 'status', operator: 'equals', value: '' }]);
  // Manual contacts dialog
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSegment, setManualSegment] = useState<any>(null);
  const [manualContactIds, setManualContactIds] = useState<string[]>([]);
  const [manualSearch, setManualSearch] = useState('');
  // View contacts dialog
  const [viewOpen, setViewOpen] = useState(false);
  const [viewSegment, setViewSegment] = useState<any>(null);
  const [viewContacts, setViewContacts] = useState<any[]>([]);
  const [viewSearch, setViewSearch] = useState('');
  const [viewLoading, setViewLoading] = useState(false);

  const allFields = [
    ...BASE_FIELDS.map(f => ({ value: f.value, label: f.label })),
    ...customFields.map(f => ({ value: `cf_${f.id}`, label: `📋 ${f.name}` })),
  ];

  const fetchData = async () => {
    if (!user) return;
    const [segRes, cfRes, tagRes, contactsRes] = await Promise.all([
      supabase.from('segments').select('*').order('created_at', { ascending: false }),
      supabase.from('custom_fields').select('id, name, field_type').order('sort_order'),
      supabase.from('tags').select('*'),
      supabase.from('contacts').select('id, first_name, last_name, email').order('first_name'),
    ]);
    setSegments(segRes.data || []);
    setCustomFields((cfRes.data as any[]) || []);
    setTags(tagRes.data || []);
    setContacts(contactsRes.data || []);

    if (segRes.data) {
      const counts: Record<string, number> = {};
      const mCounts: Record<string, number> = {};
      for (const seg of segRes.data) {
        counts[seg.id] = await countContactsForRules(seg.rules as unknown as SegmentRule[]);
        const { count } = await supabase.from('segment_contacts').select('id', { count: 'exact', head: true }).eq('segment_id', seg.id);
        mCounts[seg.id] = count || 0;
      }
      setSegmentCounts(counts);
      setManualCounts(mCounts);
    }
  };

  const getContactsForRules = async (segRules: SegmentRule[]): Promise<any[]> => {
    if (!user) return [];
    // Step 1: apply standard field filters via Supabase query
    let query = supabase.from('contacts').select('id, first_name, last_name, email, lead_score, status') as any;
    for (const rule of segRules) {
      if (rule.field === 'tag' || rule.field.startsWith('cf_')) continue;
      query = applyFilter(query, rule);
    }
    const { data: dbContacts } = await query;
    let result: any[] = dbContacts || [];

    // Step 2: apply tag filters client-side
    const tagRules = segRules.filter(r => r.field === 'tag');
    if (tagRules.length > 0) {
      // Fetch all contact_tags with tag names
      const { data: allCT } = await supabase.from('contact_tags').select('contact_id, tag_id, tags(name)');
      const contactTagMap = new Map<string, string[]>();
      (allCT || []).forEach((ct: any) => {
        const name = ct.tags?.name;
        if (!name) return;
        const arr = contactTagMap.get(ct.contact_id) || [];
        arr.push(name);
        contactTagMap.set(ct.contact_id, arr);
      });

      for (const rule of tagRules) {
        result = result.filter(c => {
          const tags = contactTagMap.get(c.id) || [];
          switch (rule.operator) {
            case 'has_tag': return tags.includes(rule.value);
            case 'not_has_tag': return !tags.includes(rule.value);
            case 'has_any_tag': return tags.length > 0;
            case 'has_no_tags': return tags.length === 0;
            default: return true;
          }
        });
      }
    }

    // Step 3: apply custom field filters client-side
    const cfRules = segRules.filter(r => r.field.startsWith('cf_'));
    if (cfRules.length > 0) {
      const contactIds = result.map(c => c.id);
      if (contactIds.length === 0) return [];
      const { data: cfValues } = await supabase.from('contact_custom_values').select('contact_id, custom_field_id, value').in('contact_id', contactIds);
      const cfMap = new Map<string, Map<string, string>>();
      (cfValues || []).forEach((v: any) => {
        if (!cfMap.has(v.contact_id)) cfMap.set(v.contact_id, new Map());
        cfMap.get(v.contact_id)!.set(v.custom_field_id, v.value || '');
      });

      for (const rule of cfRules) {
        const fieldId = rule.field.replace('cf_', '');
        result = result.filter(c => {
          const val = cfMap.get(c.id)?.get(fieldId) || '';
          return matchValue(val, rule.operator, rule.value);
        });
      }
    }

    return result;
  };

  const matchValue = (val: string, operator: string, target: string): boolean => {
    switch (operator) {
      case 'equals': return val === target;
      case 'not_equals': return val !== target;
      case 'contains': return val.toLowerCase().includes(target.toLowerCase());
      case 'not_contains': return !val.toLowerCase().includes(target.toLowerCase());
      case 'starts_with': return val.toLowerCase().startsWith(target.toLowerCase());
      case 'ends_with': return val.toLowerCase().endsWith(target.toLowerCase());
      case 'greater_than': return parseFloat(val) > parseFloat(target);
      case 'less_than': return parseFloat(val) < parseFloat(target);
      case 'greater_or_equal': return parseFloat(val) >= parseFloat(target);
      case 'less_or_equal': return parseFloat(val) <= parseFloat(target);
      case 'is_empty': return !val;
      case 'is_not_empty': return !!val;
      default: return true;
    }
  };

  const countContactsForRules = async (segRules: SegmentRule[]): Promise<number> => {
    const contacts = await getContactsForRules(segRules);
    return contacts.length;
  };

  const applyFilter = (query: any, rule: SegmentRule) => {
    const { field, operator, value } = rule;
    switch (operator) {
      case 'equals': return query.eq(field, value);
      case 'not_equals': return query.neq(field, value);
      case 'contains': return query.ilike(field, `%${value}%`);
      case 'not_contains': return query.not(field, 'ilike', `%${value}%`);
      case 'starts_with': return query.ilike(field, `${value}%`);
      case 'ends_with': return query.ilike(field, `%${value}`);
      case 'greater_than': return query.gt(field, value);
      case 'less_than': return query.lt(field, value);
      case 'greater_or_equal': return query.gte(field, value);
      case 'less_or_equal': return query.lte(field, value);
      case 'is_empty': return query.is(field, null);
      case 'is_not_empty': return query.not(field, 'is', null);
      default: return query;
    }
  };

  useEffect(() => { fetchData(); }, [user]);

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
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('segments').delete().eq('id', id);
    toast({ title: 'Segmento eliminado' });
    fetchData();
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
    if (key === 'field') {
      const type = getFieldType(val, customFields);
      const ops = getOperatorsForType(type);
      updated[i] = { field: val, operator: ops[0].value, value: '' };
    } else {
      updated[i] = { ...updated[i], [key]: val };
    }
    setRules(updated);
  };

  const getOperatorLabel = (op: string) => {
    const all = [...TEXT_OPERATORS, ...NUMBER_OPERATORS, ...DATE_OPERATORS, ...TAG_OPERATORS];
    return all.find(o => o.value === op)?.label || op;
  };

  const getFieldLabel = (f: string) => allFields.find(af => af.value === f)?.label || f;

  const needsValueInput = (op: string) => !['is_empty', 'is_not_empty', 'has_any_tag', 'has_no_tags'].includes(op);

  // Manual contacts management
  const openManualContacts = async (seg: any) => {
    setManualSegment(seg);
    setManualSearch('');
    const { data } = await supabase.from('segment_contacts').select('contact_id').eq('segment_id', seg.id);
    setManualContactIds((data || []).map((d: any) => d.contact_id));
    setManualOpen(true);
  };

  const toggleManualContact = async (contactId: string) => {
    if (!manualSegment) return;
    if (manualContactIds.includes(contactId)) {
      await supabase.from('segment_contacts').delete().eq('segment_id', manualSegment.id).eq('contact_id', contactId);
      setManualContactIds(manualContactIds.filter(id => id !== contactId));
    } else {
      await supabase.from('segment_contacts').insert({ segment_id: manualSegment.id, contact_id: contactId });
      setManualContactIds([...manualContactIds, contactId]);
    }
    fetchData();
  };

  const filteredContacts = contacts.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(manualSearch.toLowerCase())
  );

  const openViewContacts = async (seg: any) => {
    setViewSegment(seg);
    setViewSearch('');
    setViewLoading(true);
    setViewOpen(true);

    // Fetch contacts matching rules
    const segRules = (seg.rules || []) as SegmentRule[];
    let query = supabase.from('contacts').select('id, first_name, last_name, email, lead_score, status') as any;
    for (const rule of segRules) {
      if (rule.field === 'tag' || rule.field.startsWith('cf_')) continue;
      query = applyFilter(query, rule);
    }
    const { data: ruleContacts } = await query;

    // Fetch manually added contacts
    const { data: manualRows } = await supabase.from('segment_contacts').select('contact_id').eq('segment_id', seg.id);
    const manualIds = (manualRows || []).map((r: any) => r.contact_id);
    let manualContacts: any[] = [];
    if (manualIds.length > 0) {
      const { data } = await supabase.from('contacts').select('id, first_name, last_name, email, lead_score, status').in('id', manualIds);
      manualContacts = data || [];
    }

    // Merge and deduplicate
    const allMap = new Map<string, any>();
    (ruleContacts || []).forEach((c: any) => allMap.set(c.id, { ...c, source: 'regla' }));
    manualContacts.forEach(c => {
      if (allMap.has(c.id)) {
        allMap.set(c.id, { ...allMap.get(c.id), source: 'ambos' });
      } else {
        allMap.set(c.id, { ...c, source: 'manual' });
      }
    });
    setViewContacts(Array.from(allMap.values()));
    setViewLoading(false);
  };

  const viewFilteredContacts = viewContacts.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(viewSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Segmentos</h1>
          <p className="text-muted-foreground">Filtra contactos con reglas avanzadas</p>
        </div>
        <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Segmento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? 'Editar Segmento' : 'Nuevo Segmento'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre *</label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Leads calientes" />
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
                {rules.map((rule, i) => {
                  const fieldType = getFieldType(rule.field, customFields);
                  const operators = getOperatorsForType(fieldType);
                  return (
                    <div key={i} className="bg-muted/50 p-3 rounded-lg space-y-2">
                      {i > 0 && <Badge variant="secondary" className="text-xs mb-1">Y</Badge>}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select value={rule.field} onValueChange={v => updateRule(i, 'field', v)}>
                          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>{allFields.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={rule.operator} onValueChange={v => updateRule(i, 'operator', v)}>
                          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                          <SelectContent>{operators.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                        {needsValueInput(rule.operator) && (
                          fieldType === 'tag' ? (
                            <Select value={rule.value} onValueChange={v => updateRule(i, 'value', v)}>
                              <SelectTrigger className="flex-1 min-w-[120px]"><SelectValue placeholder="Seleccionar etiqueta" /></SelectTrigger>
                              <SelectContent>{tags.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : fieldType === 'date' ? (
                            <Input type="date" className="flex-1 min-w-[120px]" value={rule.value} onChange={e => updateRule(i, 'value', e.target.value)} />
                          ) : fieldType === 'number' ? (
                            <Input type="number" className="flex-1 min-w-[80px]" value={rule.value} onChange={e => updateRule(i, 'value', e.target.value)} placeholder="Valor" />
                          ) : (
                            <Input className="flex-1 min-w-[120px]" value={rule.value} onChange={e => updateRule(i, 'value', e.target.value)} placeholder="Valor..." />
                          )
                        )}
                        {rules.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeRule(i)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openViewContacts(s)} title="Ver contactos"><Eye className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openManualContacts(s)} title="Agregar contactos manualmente"><UserPlus className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(s.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><Filter className="h-3 w-3" />{segmentCounts[s.id] ?? '...'} por reglas</span>
                {(manualCounts[s.id] || 0) > 0 && (
                  <span className="flex items-center gap-1"><UserPlus className="h-3 w-3" />{manualCounts[s.id]} manuales</span>
                )}
              </div>
              <div className="space-y-1">
                {(s.rules as SegmentRule[]).map((r, i) => (
                  <div key={i} className="text-xs bg-muted/50 rounded px-2 py-1">
                    {i > 0 && <span className="font-medium mr-1">Y</span>}
                    <span className="font-medium">{getFieldLabel(r.field)}</span>{' '}
                    <span className="text-muted-foreground">{getOperatorLabel(r.operator)}</span>{' '}
                    {r.value && <span className="font-medium">"{r.value}"</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Manual contacts dialog */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Contactos manuales — {manualSegment?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar contactos..." value={manualSearch} onChange={e => setManualSearch(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">{manualContactIds.length} contactos agregados manualmente</p>
            <ScrollArea className="h-[340px] border rounded-md">
              <div className="p-2 space-y-1">
                {filteredContacts.map(c => (
                  <label key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      checked={manualContactIds.includes(c.id)}
                      onCheckedChange={() => toggleManualContact(c.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.first_name} {c.last_name}</p>
                      {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                    </div>
                    {manualContactIds.includes(c.id) && (
                      <Badge variant="secondary" className="text-xs shrink-0">Incluido</Badge>
                    )}
                  </label>
                ))}
                {filteredContacts.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">No hay contactos</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* View segment contacts dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contactos en "{viewSegment?.name}"
              <Badge variant="secondary">{viewContacts.length}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar en este segmento..." value={viewSearch} onChange={e => setViewSearch(e.target.value)} />
            </div>
            {viewLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>
            ) : (
              <ScrollArea className="h-[400px] border rounded-md">
                <div className="divide-y">
                  {viewFilteredContacts.map(c => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{c.first_name} {c.last_name}</p>
                        {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${(c.lead_score || 0) >= 80 ? 'bg-green-500' : (c.lead_score || 0) >= 50 ? 'bg-yellow-500' : (c.lead_score || 0) >= 20 ? 'bg-orange-500' : 'bg-muted-foreground/50'}`} style={{ width: `${c.lead_score || 0}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-6 text-right">{c.lead_score || 0}</span>
                      </div>
                      <Badge variant={c.source === 'manual' ? 'outline' : c.source === 'ambos' ? 'default' : 'secondary'} className="text-xs shrink-0">
                        {c.source === 'manual' ? 'Manual' : c.source === 'ambos' ? 'Regla + Manual' : 'Regla'}
                      </Badge>
                    </div>
                  ))}
                  {viewFilteredContacts.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">No hay contactos en este segmento</p>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
