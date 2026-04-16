import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TagManager } from '@/components/TagManager';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Camera, Mail, Phone, Briefcase, Building2,
  Calendar, Globe, ChevronDown, ChevronUp, Save, Pencil, EyeOff, Plus, Minus, DollarSign,
  ChevronLeft, ChevronRight, Tags
} from 'lucide-react';

interface CustomField {
  id: string;
  name: string;
  field_type: string;
  options: string[];
  is_required: boolean;
  is_visible: boolean;
}

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [contact, setContact] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>({});
  const [showHidden, setShowHidden] = useState(false);
  const [leadScore, setLeadScore] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transForm, setTransForm] = useState({ amount: '', type: 'ingreso', description: '' });
  const [addingTrans, setAddingTrans] = useState(false);

  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  // Pagination
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(10);

  const fetchAll = async () => {
    if (!user || !id) return;
    const [cRes, cfRes, cvRes, coRes, actRes, transRes, oppsRes, tagsRes, segmentsRes] = await Promise.all([
      supabase.from('contacts').select('*').eq('id', id).single(),
      supabase.from('custom_fields').select('*').order('sort_order'),
      supabase.from('contact_custom_values').select('*').eq('contact_id', id),
      supabase.from('companies').select('*').order('name'),
      supabase.from('activities').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
      supabase.from('contact_transactions').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
      supabase.from('opportunities').select('id, name, stage, value, probability, is_archived').eq('contact_id', id).eq('is_archived', false),
      supabase.from('contact_tags').select('tag_id, tags(name, color)').eq('contact_id', id),
      supabase.from('segment_contacts').select('segment_id, segments(name)').eq('contact_id', id),
    ]);
    if (cRes.data) {
      setContact(cRes.data);
      setForm(cRes.data);
      const dbScore = (cRes.data as any).lead_score || 0;
      const maxOppProb = oppsRes.data?.reduce((max: number, o: any) => Math.max(max, o.probability || 0), 0) || 0;
      setLeadScore(Math.max(dbScore, maxOppProb));
      if (cRes.data.company_id) {
        const comp = coRes.data?.find((c: any) => c.id === cRes.data.company_id);
        setCompany(comp || null);
      }
    }
    setCompanies(coRes.data || []);
    setCustomFields((cfRes.data as any[])?.map(d => ({ ...d, options: d.options || [] })) || []);
    const vals: Record<string, string> = {};
    (cvRes.data || []).forEach((v: any) => { vals[v.custom_field_id] = v.value || ''; });
    setCustomValues(vals);
    setActivities(actRes.data || []);
    setTransactions(transRes.data || []);
    setOpportunities(oppsRes.data || []);
    setTags(tagsRes.data?.map(t => t.tags) || []);
    setSegments(segmentsRes.data?.map(s => s.segments) || []);
  };

  useEffect(() => { fetchAll(); }, [user, id]);

  const handleSave = async () => {
    if (!contact) return;
    const { error } = await supabase.from('contacts').update({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone,
      position: form.position,
      company_id: form.company_id || null,
      status: form.status,
      notes: form.notes,
      lead_score: leadScore,
    }).eq('id', contact.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }

    // Save custom values
    for (const [fieldId, value] of Object.entries(customValues)) {
      await supabase.from('contact_custom_values').upsert(
        { contact_id: contact.id, custom_field_id: fieldId, value },
        { onConflict: 'contact_id,custom_field_id' }
      );
    }

    toast({ title: 'Contacto guardado' });
    setEditMode(false);
    fetchAll();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !contact) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user!.id}/${contact.id}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) { toast({ title: 'Error subiendo imagen', variant: 'destructive' }); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('contacts').update({ avatar_url: urlData.publicUrl }).eq('id', contact.id);
    setUploading(false);
    setUploading(false);
    fetchAll();
  };

  const handleAddTransaction = async () => {
    if (!transForm.amount || isNaN(Number(transForm.amount))) {
      toast({ title: 'Introduce un monto válido', variant: 'destructive' });
      return;
    }
    setAddingTrans(true);
    const { error } = await supabase.from('contact_transactions').insert({
      contact_id: contact.id,
      user_id: user?.id,
      amount: Number(transForm.amount),
      type: transForm.type,
      description: transForm.description
    });
    setAddingTrans(false);
    if (error) {
      toast({ title: 'Error al procesar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Transacción guardada exitosamente' });
      setTransForm({ amount: '', type: 'ingreso', description: '' });
      fetchAll();
    }
  };

  // balance calculated later

  const renderScore = () => {
    const color = leadScore >= 80 ? 'text-green-500' : leadScore >= 50 ? 'text-yellow-500' : leadScore >= 20 ? 'text-orange-500' : 'text-muted-foreground';
    return (
      <div className="flex items-center gap-2">
        {editMode ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={100}
              value={leadScore}
              onChange={e => setLeadScore(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-20 h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${leadScore >= 80 ? 'bg-green-500' : leadScore >= 50 ? 'bg-yellow-500' : leadScore >= 20 ? 'bg-orange-500' : 'bg-muted-foreground/50'}`} style={{ width: `${leadScore}%` }} />
            </div>
            <span className={`text-sm font-semibold ${color}`}>{leadScore}</span>
          </div>
        )}
      </div>
    );
  };

  const renderCustomFieldInput = (field: CustomField) => {
    const value = customValues[field.id] || '';
    const onChange = (v: string) => setCustomValues({ ...customValues, [field.id]: v });
    if (!editMode) {
      if (!value && !field.is_visible && !showHidden) return null;
      return (
        <div key={field.id} className="flex justify-between items-center py-2">
          <span className="text-sm text-muted-foreground">{field.name}</span>
          <span className="text-sm font-medium">{field.field_type === 'checkbox' ? (value === 'true' ? 'Sí' : 'No') : value || '—'}</span>
        </div>
      );
    }
    switch (field.field_type) {
      case 'textarea': return <Textarea key={field.id} value={value} onChange={e => onChange(e.target.value)} placeholder={field.name} />;
      case 'number': return <Input key={field.id} type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={field.name} />;
      case 'date': return <Input key={field.id} type="date" value={value} onChange={e => onChange(e.target.value)} />;
      case 'checkbox':
        return (
          <div key={field.id} className="flex items-center gap-2">
            <Switch checked={value === 'true'} onCheckedChange={v => onChange(String(v))} />
          </div>
        );
      case 'select':
        return (
          <Select key={field.id} value={value} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {(field.options || []).map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      default: return <Input key={field.id} type={field.field_type === 'url' ? 'url' : field.field_type === 'email' ? 'email' : 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={field.name} />;
    }
  };

  if (!contact) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  const visibleFields = customFields.filter(f => f.is_visible);
  const hiddenFields = customFields.filter(f => !f.is_visible);


  const totalPages = Math.ceil(activities.length / activityPageSize) || 1;
  const Math_min = Math.min;
  const Math_max = Math.max;
  const paginatedActivities = activities.slice((activityPage - 1) * activityPageSize, activityPage * activityPageSize);

  const oppsSum = opportunities.filter((o: any) => o.stage === 'Ganado').reduce((sum: number, o: any) => sum + Number(o.value || 0), 0);
  const transSum = transactions.reduce((sum, t) => sum + (t.type === 'ingreso' ? Number(t.amount) : -Number(t.amount)), 0);
  const balance = oppsSum + transSum;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/contactos')} className="gap-2">
        <ArrowLeft className="h-4 w-4" />Volver a contactos
      </Button>

      {/* Super Header Card */}
      <Card className="overflow-hidden border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <Avatar className="h-24 w-24 text-2xl ring-4 ring-muted/50">
                <AvatarImage src={(contact as any).avatar_url || ''} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {contact.first_name?.[0]}{contact.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              {editMode && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="h-6 w-6 text-white" />
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>

            {/* Main Info */}
            <div className="flex-1 space-y-4 w-full">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  {editMode ? (
                    <div className="flex gap-2">
                      <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="Nombre" className="text-xl font-bold h-9 bg-transparent" />
                      <Input value={form.last_name || ''} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Apellido" className="text-xl font-bold h-9 bg-transparent" />
                    </div>
                  ) : (
                    <h2 className="text-3xl font-extrabold tracking-tight">{contact.first_name} {contact.last_name}</h2>
                  )}

                  {/* Badges row: Score, Balance, Status */}
                  <div className="flex items-center gap-3 pt-1 flex-wrap">
                    {renderScore()}
                    <Badge variant={balance >= 0 ? "default" : "destructive"} className="text-xs h-6 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full">
                      $ {balance.toLocaleString()}
                    </Badge>
                    {editMode ? (
                      <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                        <SelectTrigger className="w-28 h-6 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="activo">Activo</SelectItem>
                          <SelectItem value="inactivo">Inactivo</SelectItem>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="cliente">Cliente</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={contact.status === 'activo' ? 'default' : 'secondary'} className="h-6 px-3 rounded-full">{contact.status}</Badge>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  {editMode ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => { setEditMode(false); setForm(contact); setLeadScore((contact as any).lead_score || 0); }}>Cancelar</Button>
                      <Button size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-1" />Guardar</Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEditMode(true)}><Pencil className="h-4 w-4 mr-1" />Editar</Button>
                  )}
                </div>
              </div>

              {/* Quick Contact Line */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded-lg border">
                {editMode ? (
                  <div className="flex w-full gap-4 flex-wrap">
                    <Input className="h-8 flex-1 min-w-[200px]" type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" />
                    <Input className="h-8 flex-1 min-w-[150px]" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Teléfono" />
                    <Input className="h-8 flex-1 min-w-[150px]" value={form.position || ''} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="Cargo" />
                  </div>
                ) : (
                  <>
                    {contact.email && <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{contact.email}</span>}
                    {contact.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{contact.phone}</span>}
                    {contact.position && <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" />{contact.position}</span>}
                    {company && <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" />{company.name}</span>}
                  </>
                )}
              </div>

              {/* Tags, Segments & Opportunities */}
              {(tags.length > 0 || segments.length > 0 || opportunities.length > 0) && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {tags.map((tag: any) => (
                    <Badge key={tag.name} style={{backgroundColor: tag.color}} className="text-[10px] uppercase font-bold tracking-wider text-white hover:opacity-90 transition-opacity">
                      {tag.name}
                    </Badge>
                  ))}
                  {segments.map((seg: any) => (
                    <Badge key={seg.name} variant="outline" className="text-[10px] uppercase font-bold tracking-wider bg-slate-50 text-slate-600 flex items-center gap-1">
                      <Tags className="h-3 w-3" /> {seg.name}
                    </Badge>
                  ))}
                  {opportunities.map((opp: any) => (
                    <Badge key={opp.id} variant="outline" className="text-[10px] uppercase font-bold tracking-wider bg-green-50 text-green-700 border-green-200">
                      💰 {opp.name} ({opp.stage} - ${Number(opp.value || 0).toLocaleString()})
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs section for Data */}
      <Tabs defaultValue="activity" className="w-full mt-8">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 h-auto p-1 bg-muted/50 rounded-lg">
          <TabsTrigger value="activity" className="py-2.5">Historial de Actividad</TabsTrigger>
          <TabsTrigger value="transactions" className="py-2.5">Cuenta Corriente</TabsTrigger>
          <TabsTrigger value="details" className="py-2.5">Datos Adicionales</TabsTrigger>
        </TabsList>
        
        {/* TAB 1: ACTIVIDAD */}
        <TabsContent value="activity" className="mt-6">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-muted/10">
              <CardTitle className="text-lg font-semibold">Registro Histórico</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Mostrar:</span>
                <Select value={String(activityPageSize)} onValueChange={v => { setActivityPageSize(Number(v)); setActivityPage(1); }}>
                  <SelectTrigger className="h-8 w-16 text-xs bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {activities.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Calendar className="h-6 w-6 opacity-30" />
                  </div>
                  <p>No hay registro de actividad aún.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {paginatedActivities.map((activity: any) => (
                     <div key={activity.id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                       <div className="flex items-start gap-4 flex-1">
                         <div className="mt-1 flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                           {activity.type.substring(0,2)}
                         </div>
                         <div className="space-y-1">
                           <p className="text-sm font-semibold capitalize">{activity.type.replace('_', ' ')}</p>
                           <p className="text-sm text-muted-foreground">{activity.description}</p>
                         </div>
                       </div>
                       <time className="text-xs text-muted-foreground font-medium whitespace-nowrap bg-muted px-2 py-1 rounded">
                         {new Date(activity.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                       </time>
                     </div>
                  ))}
                </div>
              )}
            </CardContent>
            {activities.length > 0 && (
              <div className="border-t p-3 flex items-center justify-between bg-muted/10 text-sm">
                <span className="text-muted-foreground">
                  Mostrando {(activityPage - 1) * activityPageSize + 1} - {Math.min(activityPage * activityPageSize, activities.length)} de {activities.length} eventos
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setActivityPage((p: number) => Math.max(1, p - 1))} disabled={activityPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-medium w-16 text-center">Pág. {activityPage} / {totalPages}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setActivityPage((p: number) => Math.min(totalPages, p + 1))} disabled={activityPage === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TAB 2: CUENTA CORRIENTE */}
        <TabsContent value="transactions" className="mt-6">
          <Card className="border shadow-sm">
             <CardHeader className="flex flex-row items-center justify-between pb-4 border-b bg-muted/10">
              <CardTitle className="text-lg font-semibold">Libro de Transacciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="flex flex-col sm:flex-row gap-3 items-end p-4 rounded-xl border bg-gradient-to-r from-muted/50 to-transparent shadow-sm">
                <div className="flex-1 space-y-1.5 w-full">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Monto</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" placeholder="0.00" className="pl-9 h-10 font-semibold" value={transForm.amount} onChange={e => setTransForm({...transForm, amount: e.target.value})} />
                  </div>
                </div>
                <div className="flex-[2] space-y-1.5 w-full">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Detalle del Movimiento</label>
                  <Input placeholder="Ej: Depósito bancario, flete extra..." className="h-10" value={transForm.description} onChange={e => setTransForm({...transForm, description: e.target.value})} />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button disabled={addingTrans} size="sm" onClick={() => { setTransForm({...transForm, type: 'ingreso'}); handleAddTransaction(); }} className="h-10 flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors text-white">
                    <Plus className="h-4 w-4 mr-1.5" /> Ingreso
                  </Button>
                  <Button disabled={addingTrans} size="sm" variant="destructive" onClick={() => { setTransForm({...transForm, type: 'egreso'}); handleAddTransaction(); }} className="h-10 flex-1 sm:flex-none shadow-sm">
                    <Minus className="h-4 w-4 mr-1.5" /> Egreso
                  </Button>
                </div>
              </div>

              {transactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
                   <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                     <DollarSign className="h-6 w-6 opacity-30" />
                   </div>
                   <p>No hay registros contables.</p>
                 </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((t: any) => (
                    <div key={t.id} className="flex justify-between items-center p-3.5 px-5 bg-card hover:bg-muted/40 transition-colors rounded-lg border shadow-sm group">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-sm group-hover:text-primary transition-colors">{t.description || (t.type === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado')}</span>
                        <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{new Date(t.created_at).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short'})}</span>
                      </div>
                      <div className={`flex items-center gap-2 font-bold px-3 py-1 rounded-full ${t.type === 'ingreso' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {t.type === 'ingreso' ? <Plus className="w-3 h-3"/> : <Minus className="w-3 h-3"/>}
                        ${Number(t.amount).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: DATOS ADICIONALES */}
        <TabsContent value="details" className="mt-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-sm border">
               <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between pb-3">
                 <CardTitle className="text-base font-semibold">Organización</CardTitle>
               </CardHeader>
               <CardContent className="pt-4 space-y-4">
                 {editMode ? (
                    <div className="space-y-4 text-sm">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground uppercase">Empresa de origen</label>
                        <Select value={form.company_id || ''} onValueChange={v => setForm({ ...form, company_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                          <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground uppercase">Notas Internas</label>
                        <Textarea className="min-h-[100px]" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Anotaciones referenciales..." />
                      </div>
                    </div>
                 ) : (
                    <div className="space-y-4">
                       <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Fecha de Creación</span>
                          <span className="text-sm font-medium">{new Date(contact.created_at).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                       </div>
                       {contact.notes && (
                         <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-md">
                           <p className="text-sm text-amber-900/80 leading-relaxed italic">"{contact.notes}"</p>
                         </div>
                       )}
                    </div>
                 )}
               </CardContent>
            </Card>

            <Card className="shadow-sm border">
              <CardHeader className="bg-muted/10 border-b pb-3"><CardTitle className="text-base font-semibold">Clasificación Manual</CardTitle></CardHeader>
              <CardContent className="pt-4">
                <TagManager contactId={contact.id} />
              </CardContent>
            </Card>
          </div>

          {/* Campos Personalizados (si existen) */}
          {customFields.length > 0 && (
            <Card className="shadow-sm border">
              <CardHeader className="bg-muted/10 border-b pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Atributos Extra</CardTitle>
                  {hiddenFields.length > 0 && !editMode && (
                    <Button variant="outline" size="sm" onClick={() => setShowHidden(!showHidden)} className="h-8">
                      {showHidden ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                      {showHidden ? 'Ocultar campos no visibles' : `Ver ${hiddenFields.length} campos ocultos`}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {editMode ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {customFields.map(field => (
                      <div key={field.id} className="space-y-1.5 p-3 rounded-lg border bg-muted/10">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          {field.name}
                          {field.is_required && <span className="text-destructive">*</span>}
                          {!field.is_visible && <EyeOff className="h-3 w-3 text-muted-foreground/50" />}
                        </label>
                        {renderCustomFieldInput(field)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleFields.map(f => (
                      <div key={f.id} className="flex flex-col gap-1 p-3 rounded-lg border shadow-sm">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{f.name}</span>
                        {renderCustomFieldInput(f)}
                      </div>
                    ))}
                    {showHidden && hiddenFields.map(f => (
                      <div key={f.id} className="flex flex-col gap-1 p-3 rounded-lg border border-dashed bg-muted/30">
                        <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 opacity-70"><EyeOff className="h-3 w-3"/>{f.name}</span>
                        <div className="opacity-70">{renderCustomFieldInput(f)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
