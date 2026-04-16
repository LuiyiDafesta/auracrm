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
  Calendar, Globe, ChevronDown, ChevronUp, Save, Pencil, EyeOff, Plus, Minus, DollarSign
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

  const fetchAll = async () => {
    if (!user || !id) return;
    const [cRes, cfRes, cvRes, coRes, actRes, transRes] = await Promise.all([
      supabase.from('contacts').select('*').eq('id', id).single(),
      supabase.from('custom_fields').select('*').order('sort_order'),
      supabase.from('contact_custom_values').select('*').eq('contact_id', id),
      supabase.from('companies').select('*').order('name'),
      supabase.from('activities').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
      supabase.from('contact_transactions').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
    ]);
    if (cRes.data) {
      setContact(cRes.data);
      setForm(cRes.data);
      setLeadScore((cRes.data as any).lead_score || 0);
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
    fetchAll();
  };

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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/contactos')} className="gap-2">
        <ArrowLeft className="h-4 w-4" />Volver a contactos
      </Button>

      {/* Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Avatar */}
            <div className="relative group">
              <Avatar className="h-24 w-24 text-2xl">
                <AvatarImage src={(contact as any).avatar_url || ''} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
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

            {/* Info principal */}
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  {editMode ? (
                    <div className="flex gap-2 mb-2">
                      <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="Nombre" className="text-xl font-bold" />
                      <Input value={form.last_name || ''} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Apellido" className="text-xl font-bold" />
                    </div>
                  ) : (
                    <h2 className="text-2xl font-bold">{contact.first_name} {contact.last_name}</h2>
                  )}
                  {editMode ? (
                    <Input value={form.position || ''} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="Cargo" className="text-sm mt-1" />
                  ) : (
                    contact.position && <p className="text-muted-foreground flex items-center gap-1"><Briefcase className="h-3 w-3" />{contact.position}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {editMode ? (
                    <>
                      <Button variant="outline" onClick={() => { setEditMode(false); setForm(contact); setLeadScore((contact as any).lead_score || 0); }}>Cancelar</Button>
                      <Button onClick={handleSave}><Save className="h-4 w-4 mr-1" />Guardar</Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => setEditMode(true)}><Pencil className="h-4 w-4 mr-1" />Editar</Button>
                  )}
                </div>
              </div>

              {/* Lead score & status */}
              <div className="flex items-center gap-4 flex-wrap">
                {renderScore()}
                {editMode ? (
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="cliente">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={contact.status === 'activo' ? 'default' : 'secondary'}>{contact.status}</Badge>
                )}
              </div>

              {/* Quick info */}
              <div className="flex flex-wrap gap-4 text-sm">
                {contact.email && (
                  <span className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" />{contact.email}</span>
                )}
                {contact.phone && (
                  <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{contact.phone}</span>
                )}
                {company && (
                  <span className="flex items-center gap-1 text-muted-foreground"><Building2 className="h-3 w-3" />{company.name}</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Contact Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Información de contacto</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {editMode ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Email</label>
                  <Input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Teléfono</label>
                  <Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Empresa</label>
                  <Select value={form.company_id || ''} onValueChange={v => setForm({ ...form, company_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Notas</label>
                  <Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between py-1"><span className="text-sm text-muted-foreground">Email</span><span className="text-sm">{contact.email || '—'}</span></div>
                <div className="flex justify-between py-1"><span className="text-sm text-muted-foreground">Teléfono</span><span className="text-sm">{contact.phone || '—'}</span></div>
                <div className="flex justify-between py-1"><span className="text-sm text-muted-foreground">Empresa</span><span className="text-sm">{company?.name || '—'}</span></div>
                <div className="flex justify-between py-1"><span className="text-sm text-muted-foreground">Creado</span><span className="text-sm">{new Date(contact.created_at).toLocaleDateString('es')}</span></div>
                {contact.notes && (
                  <div className="pt-2 border-t"><p className="text-sm text-muted-foreground">{contact.notes}</p></div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader><CardTitle className="text-base">Etiquetas</CardTitle></CardHeader>
          <CardContent>
            <TagManager contactId={contact.id} />
          </CardContent>
        </Card>
      </div>

      {/* Custom fields */}
      {customFields.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Campos personalizados</CardTitle>
              {hiddenFields.length > 0 && !editMode && (
                <Button variant="ghost" size="sm" onClick={() => setShowHidden(!showHidden)}>
                  {showHidden ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                  {showHidden ? 'Ocultar campos' : `+${hiddenFields.length} campos ocultos`}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <div className="grid md:grid-cols-2 gap-4">
                {customFields.map(field => (
                  <div key={field.id} className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      {field.name}
                      {field.is_required && <span className="text-destructive">*</span>}
                      {!field.is_visible && <EyeOff className="h-3 w-3" />}
                    </label>
                    {renderCustomFieldInput(field)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1 divide-y">
                {visibleFields.map(f => renderCustomFieldInput(f))}
                {showHidden && hiddenFields.map(f => renderCustomFieldInput(f))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs section for Data */}
      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="activity">Historial de Actividad</TabsTrigger>
          <TabsTrigger value="transactions">Cuenta Corriente</TabsTrigger>
        </TabsList>
        <TabsContent value="activity">
          <Card>
            <CardHeader><CardTitle className="text-base">Historial de Actividad</CardTitle></CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay registro de actividad.</p>
              ) : (
                <div className="space-y-4">
                  {activities.map(activity => (
                    <div key={activity.id} className="relative flex items-start gap-4 pb-4 border-l-2 border-muted last:border-transparent ml-2">
                      <div className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full ring-4 ring-background bg-primary"></div>
                      <div className="pl-6 space-y-1 w-full">
                        <p className="text-sm font-medium">{activity.type}</p>
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                        <time className="text-[10px] text-muted-foreground uppercase opacity-80 font-medium">
                          {new Date(activity.created_at).toLocaleString('es-ES')}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="transactions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Cuenta Corriente</CardTitle>
              <Badge variant={balance >= 0 ? "default" : "destructive"} className="text-sm">
                Saldo: ${balance.toLocaleString()}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2 items-end border p-3 rounded-md bg-muted/20">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Monto</label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input type="number" placeholder="0.00" className="pl-6 h-8 text-sm" value={transForm.amount} onChange={e => setTransForm({...transForm, amount: e.target.value})} />
                  </div>
                </div>
                <div className="flex-[2] space-y-1">
                  <label className="text-xs text-muted-foreground">Descripción (opcional)</label>
                  <Input placeholder="Motivo del movimiento..." className="h-8 text-sm" value={transForm.description} onChange={e => setTransForm({...transForm, description: e.target.value})} />
                </div>
                <Button disabled={addingTrans} size="sm" onClick={() => { setTransForm({...transForm, type: 'ingreso'}); handleAddTransaction(); }} className="h-8 bg-green-600 hover:bg-green-700">
                  <Plus className="h-3 w-3 mr-1" /> Ingreso
                </Button>
                <Button disabled={addingTrans} size="sm" variant="destructive" onClick={() => { setTransForm({...transForm, type: 'egreso'}); handleAddTransaction(); }} className="h-8">
                  <Minus className="h-3 w-3 mr-1" /> Egreso
                </Button>
              </div>

              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No hay transacciones registradas.</p>
              ) : (
                <div className="space-y-2">
                  {transactions.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-3 sm:text-sm text-xs rounded-md border">
                      <div className="flex flex-col">
                        <span className="font-medium">{t.description || (t.type === 'ingreso' ? 'Ingreso manual' : 'Egreso manual')}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString('es-ES')}</span>
                      </div>
                      <span className={`font-semibold ${t.type === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.type === 'ingreso' ? '+' : '-'}${Number(t.amount).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
