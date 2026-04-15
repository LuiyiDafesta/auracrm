import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Pencil, Trash2, Filter, X, CalendarIcon, Users, Tag, ChevronDown, Upload } from 'lucide-react';
import { ImportContactsDialog } from '@/components/ImportContactsDialog';
import { TagManager } from '@/components/TagManager';
import { TablePagination } from '@/components/TablePagination';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type Contact = Database['public']['Tables']['contacts']['Row'];
type Company = Database['public']['Tables']['companies']['Row'];

interface SegmentInfo { id: string; name: string; }
interface TagInfo { id: string; name: string; color: string; }

export default function Contacts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [segments, setSegments] = useState<SegmentInfo[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  // Maps: contactId -> segment names, contactId -> tag ids
  const [contactSegments, setContactSegments] = useState<Record<string, SegmentInfo[]>>({});
  const [contactTagIds, setContactTagIds] = useState<Record<string, string[]>>({});

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', position: '', company_id: '', status: 'activo', notes: '' });

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSegment, setFilterSegment] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>();
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>();

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSegmentOpen, setBulkSegmentOpen] = useState(false);
  const [bulkSegmentId, setBulkSegmentId] = useState('');

  const fetchData = async () => {
    if (!user) return;
    const [c, co, seg, tg, sc, ct] = await Promise.all([
      supabase.from('contacts').select('*').order('created_at', { ascending: false }),
      supabase.from('companies').select('*').order('name'),
      supabase.from('segments').select('id, name').order('name'),
      supabase.from('tags').select('id, name, color').order('name'),
      supabase.from('segment_contacts').select('contact_id, segment_id'),
      supabase.from('contact_tags').select('contact_id, tag_id'),
    ]);
    setContacts(c.data || []);
    setCompanies(co.data || []);
    setSegments((seg.data as SegmentInfo[]) || []);
    setTags((tg.data as TagInfo[]) || []);

    // Build contactSegments map
    const segMap: Record<string, SegmentInfo[]> = {};
    const segLookup = new Map((seg.data || []).map((s: any) => [s.id, s]));
    for (const row of (sc.data || []) as any[]) {
      const s = segLookup.get(row.segment_id);
      if (s) {
        if (!segMap[row.contact_id]) segMap[row.contact_id] = [];
        segMap[row.contact_id].push(s);
      }
    }
    setContactSegments(segMap);

    // Build contactTags map
    const tagMap: Record<string, string[]> = {};
    for (const row of (ct.data || []) as any[]) {
      if (!tagMap[row.contact_id]) tagMap[row.contact_id] = [];
      tagMap[row.contact_id].push(row.tag_id);
    }
    setContactTagIds(tagMap);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (!form.first_name.trim() || !form.email.trim()) {
      toast({ title: 'Error', description: 'Nombre y email son obligatorios', variant: 'destructive' });
      return;
    }
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

  // --- Filtering ---
  const filtered = useMemo(() => {
    let result = contacts;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c => `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(q));
    }
    if (filterStatus) {
      result = result.filter(c => c.status === filterStatus);
    }
    if (filterSegment) {
      result = result.filter(c => contactSegments[c.id]?.some(s => s.id === filterSegment));
    }
    if (filterTag) {
      result = result.filter(c => contactTagIds[c.id]?.includes(filterTag));
    }
    if (filterDateFrom) {
      result = result.filter(c => new Date(c.created_at) >= filterDateFrom!);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo!);
      to.setHours(23, 59, 59, 999);
      result = result.filter(c => new Date(c.created_at) <= to);
    }

    return result;
  }, [contacts, search, filterStatus, filterSegment, filterTag, filterDateFrom, filterDateTo, contactSegments, contactTagIds]);

  // Pagination
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, filterStatus, filterSegment, filterTag, filterDateFrom, filterDateTo, pageSize]);

  const activeFilterCount = [filterStatus, filterSegment, filterTag, filterDateFrom, filterDateTo].filter(Boolean).length;

  const clearFilters = () => {
    setFilterStatus('');
    setFilterSegment('');
    setFilterTag('');
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
  };

  // --- Bulk actions ---
  const allPageSelected = paginated.length > 0 && paginated.every(c => selected.has(c.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allPageSelected) {
      const next = new Set(selected);
      paginated.forEach(c => next.delete(c.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      paginated.forEach(c => next.add(c.id));
      setSelected(next);
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const bulkDelete = async () => {
    if (!confirm(`¿Eliminar ${selected.size} contactos?`)) return;
    for (const id of selected) {
      await supabase.from('contacts').delete().eq('id', id);
    }
    toast({ title: `${selected.size} contactos eliminados` });
    setSelected(new Set());
    fetchData();
  };

  const bulkAddToSegment = async () => {
    if (!bulkSegmentId) return;
    const toInsert = Array.from(selected).map(contact_id => ({ contact_id, segment_id: bulkSegmentId }));
    const { error } = await supabase.from('segment_contacts').insert(toInsert);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${selected.size} contactos agregados al segmento` });
    }
    setBulkSegmentOpen(false);
    setBulkSegmentId('');
    setSelected(new Set());
    fetchData();
  };

  const getCompanyName = (id: string | null) => companies.find(c => c.id === id)?.name || '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contactos</h1>
          <p className="text-muted-foreground">
            {filtered.length} contacto{filtered.length !== 1 ? 's' : ''}
            {filtered.length !== contacts.length && ` (de ${contacts.length} total)`}
          </p>
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
                  <label className="text-sm font-medium">Email *</label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
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
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            {/* Search + filter toggle */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar por nombre o email..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button variant={showFilters ? 'secondary' : 'outline'} size="sm" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-4 w-4 mr-1" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="destructive" className="ml-1.5 h-5 w-5 p-0 text-[10px] flex items-center justify-center rounded-full">{activeFilterCount}</Badge>
                )}
              </Button>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                  <X className="h-4 w-4 mr-1" />Limpiar
                </Button>
              )}
            </div>

            {/* Filter bar */}
            {showFilters && (
              <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Estado</label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-8 w-[130px]"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Segmento</label>
                  <Select value={filterSegment} onValueChange={setFilterSegment}>
                    <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      {segments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Etiqueta</label>
                  <Select value={filterTag} onValueChange={setFilterTag}>
                    <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      {tags.map(t => <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.name}
                        </div>
                      </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Desde</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn('h-8 w-[130px] justify-start text-left font-normal', !filterDateFrom && 'text-muted-foreground')}>
                        <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                        {filterDateFrom ? format(filterDateFrom, 'dd/MM/yy') : 'Fecha'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={filterDateFrom} onSelect={setFilterDateFrom} locale={es} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Hasta</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn('h-8 w-[130px] justify-start text-left font-normal', !filterDateTo && 'text-muted-foreground')}>
                        <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                        {filterDateTo ? format(filterDateTo, 'dd/MM/yy') : 'Fecha'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={filterDateTo} onSelect={setFilterDateTo} locale={es} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Bulk actions bar */}
            {someSelected && (
              <div className="flex items-center gap-3 p-2 rounded-lg border bg-primary/5 border-primary/20">
                <span className="text-sm font-medium">{selected.size} seleccionado{selected.size > 1 ? 's' : ''}</span>
                <div className="flex gap-2 ml-auto">
                  <Dialog open={bulkSegmentOpen} onOpenChange={setBulkSegmentOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm"><Users className="h-4 w-4 mr-1" />Agregar a segmento</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader><DialogTitle>Agregar a segmento</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <Select value={bulkSegmentId} onValueChange={setBulkSegmentId}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar segmento" /></SelectTrigger>
                          <SelectContent>
                            {segments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button onClick={bulkAddToSegment} className="w-full" disabled={!bulkSegmentId}>
                          Agregar {selected.size} contacto{selected.size > 1 ? 's' : ''}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="destructive" size="sm" onClick={bulkDelete}>
                    <Trash2 className="h-4 w-4 mr-1" />Eliminar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Deseleccionar</Button>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allPageSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Segmentos</TableHead>
                <TableHead>Puntuación</TableHead>
                <TableHead>Etiquetas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No hay contactos</TableCell></TableRow>
              ) : paginated.map(c => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/contactos/${c.id}`)}>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{c.first_name} {c.last_name}</TableCell>
                  <TableCell className="text-sm">{c.email || '—'}</TableCell>
                  <TableCell>{getCompanyName(c.company_id)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(contactSegments[c.id] || []).map(s => (
                        <Badge key={s.id} variant="outline" className="text-[10px] h-5">{s.name}</Badge>
                      ))}
                      {!(contactSegments[c.id]?.length) && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${c.lead_score >= 80 ? 'bg-green-500' : c.lead_score >= 50 ? 'bg-yellow-500' : c.lead_score >= 20 ? 'bg-orange-500' : 'bg-muted-foreground/50'}`} style={{ width: `${c.lead_score || 0}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{c.lead_score || 0}</span>
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
          <TablePagination
            total={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
