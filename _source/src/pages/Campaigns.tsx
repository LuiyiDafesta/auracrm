import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Mail, Send, Loader2, BarChart3, Trophy, Eye, MousePointerClick, ChevronRight, ChevronLeft, CalendarClock, Settings2, Users2, LayoutTemplate, CheckCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];

const statusColors: Record<string, string> = {
  borrador: 'bg-muted text-muted-foreground',
  activa: 'bg-success/10 text-success',
  pausada: 'bg-warning/10 text-warning',
  completada: 'bg-primary/10 text-primary',
  cancelada: 'bg-destructive/10 text-destructive',
};

const emptyForm = { name: '', type: '', status: 'borrador' as Campaign['status'], start_date: '', end_date: '', budget: '', notes: '', from_email: '', from_name: '' };

export default function Campaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Send dialog state
  const [sendOpen, setSendOpen] = useState(false);
  const [sendStep, setSendStep] = useState(1);
  const [sendCampaign, setSendCampaign] = useState<Campaign | null>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [sendForm, setSendForm] = useState({
    segment_id: '', template_id: '', emails_per_second: '1',
    from_email: '', from_name: '',
    is_ab_test: false, template_id_b: '', ab_test_percentage: 10, ab_wait_hours: 24, ab_winning_metric: 'opens',
    distribute_over_days: false,
  });
  const [sendLoading, setSendLoading] = useState(false);

  // Active sends + metrics
  const [activeSends, setActiveSends] = useState<any[]>([]);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [metricsCampaign, setMetricsCampaign] = useState<Campaign | null>(null);
  const [campaignSends, setCampaignSends] = useState<any[]>([]);
  const [trackingData, setTrackingData] = useState<Record<string, { opens: number; clicks: number }>>({});
  const [winnerLoading, setWinnerLoading] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    setCampaigns(data || []);
    return data;
  };

  const fetchActiveSends = async () => {
    if (!user) return;
    const { data } = await supabase.from('campaign_sends' as any).select('*').in('status', ['pending', 'processing']).order('created_at', { ascending: false }) as any;
    setActiveSends(data || []);
  };

  useEffect(() => {
    if (!user) return;
    fetchData().then((campaignsData) => {
      // Check query param
      const sendCampId = searchParams.get('send_campaign');
      if (sendCampId && campaignsData) {
        const c = (campaignsData as Campaign[]).find(camp => camp.id === sendCampId);
        if (c) {
          openSendDialog(c);
          searchParams.delete('send_campaign');
          setSearchParams(searchParams);
        }
      }
    });
    fetchActiveSends();
    
    const channel = supabase
      .channel('campaign_sends_progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_sends' }, () => {
        fetchActiveSends();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const data = { ...form, user_id: user.id, budget: form.budget ? parseFloat(form.budget) : null, start_date: form.start_date || null, end_date: form.end_date || null, from_email: form.from_email || null, from_name: form.from_name || null };
    let error;
    if (editing) {
      ({ error } = await supabase.from('campaigns').update(data).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('campaigns').insert(data));
    }
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Campaña actualizada' : 'Campaña creada' });
    setOpen(false); setEditing(null); setForm(emptyForm);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('campaigns').delete().eq('id', id);
    toast({ title: 'Campaña eliminada' });
    fetchData();
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({ name: c.name, type: c.type || '', status: c.status, start_date: c.start_date || '', end_date: c.end_date || '', budget: String(c.budget || ''), notes: c.notes || '', from_email: (c as any).from_email || '', from_name: (c as any).from_name || '' });
    setOpen(true);
  };

  const openSendDialog = async (c: Campaign) => {
    setSendCampaign(c);
    setSendStep(1);
    setSendForm({
      segment_id: '', template_id: '', emails_per_second: '1',
      from_email: (c as any).from_email || '', from_name: (c as any).from_name || '',
      is_ab_test: false, template_id_b: '', ab_test_percentage: 10, ab_wait_hours: 24, ab_winning_metric: 'opens',
      distribute_over_days: !!(c.start_date && c.end_date),
    });
    const [segRes, tmplRes] = await Promise.all([
      supabase.from('segments').select('id, name'),
      supabase.from('email_templates').select('id, name, subject').order('updated_at', { ascending: false }),
    ]);
    setSegments(segRes.data || []);
    setTemplates(tmplRes.data || []);
    setSendOpen(true);
  };

  const handleSend = async () => {
    if (!sendCampaign) return;
    setSendLoading(true);
    try {
      const res = await supabase.functions.invoke('enqueue-campaign', {
        body: {
          campaign_id: sendCampaign.id,
          segment_id: sendForm.segment_id,
          template_id: sendForm.template_id,
          emails_per_second: parseInt(sendForm.emails_per_second) || 1,
          from_email: sendForm.from_email || undefined,
          from_name: sendForm.from_name || undefined,
          is_ab_test: sendForm.is_ab_test,
          template_id_b: sendForm.is_ab_test ? sendForm.template_id_b : undefined,
          ab_test_percentage: sendForm.ab_test_percentage,
          ab_wait_hours: sendForm.ab_wait_hours,
          ab_winning_metric: sendForm.ab_winning_metric,
          distribute_over_days: sendForm.distribute_over_days,
        },
      });
      if (res.error) throw new Error(res.error.message);
      const result = res.data;
      if (result?.success) {
        const desc = result.type === 'ab_test'
          ? `A/B Test en cola: ${result.test_emails_a}+${result.test_emails_b} pruebas enviándose.`
          : `Lanzado masivo: ${result.total_emails} emails en cola a ${result.emails_per_second}/seg.`;
        toast({ title: '¡Campaña lanzada exitosamente!', description: desc });
        setSendOpen(false);
        fetchActiveSends();
      } else {
        throw new Error(result?.error || 'Error desconocido al encolar');
      }
    } catch (err: any) {
      toast({ title: 'Error al enviar campaña', description: err.message, variant: 'destructive' });
    }
    setSendLoading(false);
  };

  const openMetrics = async (c: Campaign) => {
    setMetricsCampaign(c);
    // Fetch sends for this campaign
    const { data: sends } = await (supabase.from('campaign_sends' as any).select('*').eq('campaign_id', c.id).order('created_at', { ascending: false }) as any);
    setCampaignSends(sends || []);

    // Fetch tracking data grouped by send
    const sendIds = (sends || []).map((s: any) => s.id);
    if (sendIds.length > 0) {
      const { data: tracking } = await (supabase.from('email_tracking' as any).select('campaign_send_id, event_type').in('campaign_send_id', sendIds) as any);
      const grouped: Record<string, { opens: number; clicks: number }> = {};
      for (const t of (tracking || [])) {
        if (!grouped[t.campaign_send_id]) grouped[t.campaign_send_id] = { opens: 0, clicks: 0 };
        if (t.event_type === 'open') grouped[t.campaign_send_id].opens++;
        else if (t.event_type === 'click') grouped[t.campaign_send_id].clicks++;
      }
      setTrackingData(grouped);
    } else {
      setTrackingData({});
    }
    setMetricsOpen(true);
  };

  const handleSelectWinner = async (sendId: string) => {
    setWinnerLoading(true);
    try {
      const res = await supabase.functions.invoke('send-ab-winner', {
        body: { winner_send_id: sendId },
      });
      if (res.error) throw new Error(res.error.message);
      const result = res.data;
      if (result?.success) {
        toast({ title: `¡Variante ${result.winner_variant} ganadora!`, description: `${result.remaining_emails} emails adicionales en cola` });
        if (metricsCampaign) openMetrics(metricsCampaign);
        fetchActiveSends();
      } else {
        throw new Error(result?.error || 'Error del servidor');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setWinnerLoading(false);
  };

  const hasDates = sendCampaign?.start_date && sendCampaign?.end_date;

  const validateStep1 = () => sendForm.segment_id && sendForm.template_id;
  const validateStep2 = () => !sendForm.is_ab_test || (sendForm.is_ab_test && sendForm.template_id_b);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campañas</h1>
          <p className="text-muted-foreground">Gestiona campañas, envíos masivos y A/B testing inteligentemente</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nueva Campaña</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Editar Campaña' : 'Nueva Campaña'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-sm font-medium">Nombre *</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Tipo</label><Input value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} placeholder="Email, Social, etc." /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado</label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as Campaign['status'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="borrador">Borrador</SelectItem>
                      <SelectItem value="activa">Activa</SelectItem>
                      <SelectItem value="pausada">Pausada</SelectItem>
                      <SelectItem value="completada">Completada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><label className="text-sm font-medium">Presupuesto ($)</label><Input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-sm font-medium">Fecha inicio</label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Fecha fin</label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><label className="text-sm font-medium">Notas</label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="border-t pt-4 mt-2">
                <p className="text-sm font-medium mb-1">Remitente personalizado <span className="text-muted-foreground font-normal">(opcional)</span></p>
                <div className="grid grid-cols-2 gap-4">
                  <Input placeholder="Email (ej. ventas@empresa.com)" value={form.from_email} onChange={e => setForm({ ...form, from_email: e.target.value })} />
                  <Input placeholder="Nombre (ej. Mi Empresa)" value={form.from_name} onChange={e => setForm({ ...form, from_name: e.target.value })} />
                </div>
              </div>
              <Button onClick={handleSave} className="w-full h-10">{editing ? 'Guardar cambios' : 'Crear campaña'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {activeSends.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2"><h3 className="text-sm font-semibold text-primary">Envíos Activos ({activeSends.length})</h3></CardHeader>
          <CardContent className="space-y-4">
            {activeSends.map((s: any) => {
              const progress = s.total_emails > 0 ? Math.round(((s.sent_count + s.failed_count) / s.total_emails) * 100) : 0;
              const campaignName = campaigns.find(c => c.id === s.campaign_id)?.name || 'Campaña';
              const variant = s.ab_variant ? ` (Variante ${s.ab_variant})` : '';
              return (
                <div key={s.id} className="space-y-2 bg-background p-3 rounded border">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium flex items-center gap-2"><Send className="h-3 w-3 text-primary animate-pulse"/> {campaignName}{variant}</span>
                    <span className="text-muted-foreground text-xs font-semibold">
                      {s.sent_count}/{s.total_emails} ({s.emails_per_second}/seg)
                    </span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardContent className="pt-6 p-0 border-none">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fechas</TableHead>
                <TableHead className="w-48 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aún no hay campañas creadas.</TableCell></TableRow>
              ) : campaigns.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.type || 'Sin tipo determinado'}</p>
                  </TableCell>
                  <TableCell><Badge className={statusColors[c.status]} variant="secondary">{c.status}</Badge></TableCell>
                  <TableCell className="text-sm">
                    {c.start_date || c.end_date ? (
                       <span className="text-muted-foreground flex gap-1 items-center"><CalendarClock className="w-3 h-3"/> {c.start_date ? new Date(c.start_date).toLocaleDateString() : '?'} - {c.end_date ? new Date(c.end_date).toLocaleDateString() : '?'}</span>
                    ) : 'Sin fechas asignadas'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" className="bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary" onClick={() => openSendDialog(c)} title="Asistente de Envío"><Send className="h-3.5 w-3.5 mr-1" /> Enviar</Button>
                      <Button variant="ghost" size="icon" onClick={() => openMetrics(c)} title="Ver Métricas"><BarChart3 className="h-4 w-4" /></Button>
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

      {/* Stepper Dialog for Sending */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-background">
          <DialogHeader className="p-6 pb-2 border-b">
            <DialogTitle className="text-xl flex items-center gap-2"><Send className="h-5 w-5 text-primary"/> Asistente de Envío: {sendCampaign?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="flex h-[55vh] max-h-[600px] min-h-[400px]">
            {/* Sidebar Steps */}
            <div className="w-1/3 border-r bg-muted/10 p-6 flex flex-col gap-6">
               {[
                 {num: 1, name: 'Audiencia y Contenido', icon: Users2},
                 {num: 2, name: 'Pruebas A/B', icon: Trophy},
                 {num: 3, name: 'Delivery y Velocidad', icon: Settings2},
                 {num: 4, name: 'Resumen Final', icon: BarChart3}
               ].map((step) => {
                 const isActive = sendStep === step.num;
                 const isCompleted = sendStep > step.num;
                 return (
                   <div key={step.num} className={`flex gap-3 items-center transition-colors ${isActive ? 'text-primary font-bold' : isCompleted ? 'text-muted-foreground' : 'text-muted-foreground opacity-50'}`}>
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ${isActive ? 'bg-primary/10 border-primary' : isCompleted ? 'bg-muted border-primary/50' : 'bg-transparent border-border'}`}>
                       <step.icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
                     </div>
                     <span className="text-sm leading-tight">{step.name}</span>
                   </div>
                 );
               })}
            </div>

            {/* Content Area */}
            <div className="w-2/3 p-6 overflow-y-auto">
               {sendStep === 1 && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-semibold">¿A quién se lo enviaremos?</h3>
                      <p className="text-sm text-muted-foreground mb-4">Selecciona el grupo de contactos (segmento) objetivo.</p>
                      <Select value={sendForm.segment_id} onValueChange={v => setSendForm({ ...sendForm, segment_id: v })}>
                        <SelectTrigger className="h-12"><SelectValue placeholder="Elegir segmento..." /></SelectTrigger>
                        <SelectContent>{segments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-lg font-semibold">Mensaje Principal</h3>
                        <Button 
                          variant="ghost" size="sm" 
                          className="h-8 text-primary hover:bg-primary/10 px-2"
                          onClick={() => {
                            setSendOpen(false);
                            navigate(`/email-builder/new?campaign=${sendCampaign?.id}`);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1"/> Crear Plantilla
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">Escoge una plantilla de tu galería.</p>
                      <Select value={sendForm.template_id} onValueChange={v => setSendForm({ ...sendForm, template_id: v })}>
                        <SelectTrigger className="h-12"><SelectValue placeholder="Elegir plantilla base (Test A)" /></SelectTrigger>
                        <SelectContent>
                          {templates.length === 0 && <span className="p-3 text-sm text-muted-foreground">No tienes plantillas creadas.</span>}
                          {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name} <span className="opacity-50">— {t.subject}</span></SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                 </div>
               )}

               {sendStep === 2 && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                   <div className="flex items-center justify-between border-b pb-4">
                      <div>
                        <h3 className="text-lg font-semibold">Pruebas A/B</h3>
                        <p className="text-sm text-muted-foreground mr-4">Encuentra la mejor variante probando 2 emails distintos con una pequeña porción del segmento.</p>
                      </div>
                      <Switch checked={sendForm.is_ab_test} onCheckedChange={v => setSendForm({ ...sendForm, is_ab_test: v })} />
                   </div>

                   {sendForm.is_ab_test ? (
                     <div className="space-y-6 border rounded-xl p-4 bg-muted/20">
                       <div className="space-y-1.5">
                          <label className="text-sm font-semibold">Plantilla Competidora (Variante B) *</label>
                          <Select value={sendForm.template_id_b} onValueChange={v => setSendForm({ ...sendForm, template_id_b: v })}>
                            <SelectTrigger className="bg-background"><SelectValue placeholder="Elegir plantilla B..." /></SelectTrigger>
                            <SelectContent>{templates.filter(t => t.id !== sendForm.template_id).map(t => <SelectItem key={t.id} value={t.id}>{t.name} — {t.subject}</SelectItem>)}</SelectContent>
                          </Select>
                       </div>
                       
                       <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold">Audiencia de Prueba: {sendForm.ab_test_percentage}%</label>
                            <Badge variant="outline" className="bg-background">{sendForm.ab_test_percentage/2}% a A / {sendForm.ab_test_percentage/2}% a B</Badge>
                          </div>
                          <Slider value={[sendForm.ab_test_percentage]} onValueChange={v => setSendForm({ ...sendForm, ab_test_percentage: v[0] })} min={2} max={50} step={2} />
                          <p className="text-xs text-muted-foreground text-center">Tú decides cuándo enviar al {100 - sendForm.ab_test_percentage}% restante eligiendo a la ganadora.</p>
                       </div>

                       <div className="grid grid-cols-2 gap-4 pt-2">
                         <div className="space-y-1.5">
                           <label className="text-xs font-semibold uppercase text-muted-foreground">Métrica Ganadora</label>
                           <Select value={sendForm.ab_winning_metric} onValueChange={v => setSendForm({ ...sendForm, ab_winning_metric: v })}>
                             <SelectTrigger className="bg-background h-9 text-sm"><SelectValue /></SelectTrigger>
                             <SelectContent>
                               <SelectItem value="opens">Aperturas (Opens)</SelectItem>
                               <SelectItem value="clicks">Clicks</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                         <div className="space-y-1.5">
                           <label className="text-xs font-semibold uppercase text-muted-foreground">Evaluar tras</label>
                           <Select value={String(sendForm.ab_wait_hours)} onValueChange={v => setSendForm({ ...sendForm, ab_wait_hours: parseInt(v) })}>
                             <SelectTrigger className="bg-background h-9 text-sm"><SelectValue /></SelectTrigger>
                             <SelectContent>
                               <SelectItem value="6">6 horas</SelectItem>
                               <SelectItem value="12">12 horas</SelectItem>
                               <SelectItem value="24">24 horas</SelectItem>
                               <SelectItem value="48">48 horas</SelectItem>
                             </SelectContent>
                           </Select>
                         </div>
                       </div>
                     </div>
                   ) : (
                     <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/10 rounded-xl border border-dashed hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setSendForm({...sendForm, is_ab_test: true})}>
                       <Trophy className="w-10 h-10 text-muted-foreground mb-3 opacity-30" />
                       <span className="text-sm font-semibold text-muted-foreground">A/B Testing Desactivado</span>
                       <span className="text-xs opacity-60">Haz click aquí si deseas comparar dos plantillas antes de enviar.</span>
                     </div>
                   )}
                 </div>
               )}

               {sendStep === 3 && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Tasa Limitada de Entrega (Throttling)</h3>
                      <p className="text-sm text-muted-foreground mb-2">Para proteger la reputación de tu dominio SMTP, configura la velocidad de despacho.</p>
                      <Select value={sendForm.emails_per_second} onValueChange={v => setSendForm({ ...sendForm, emails_per_second: v })}>
                        <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 por segundo (~3,600 / hr) — Recomendado</SelectItem>
                          <SelectItem value="2">2 por segundo (~7,200 / hr) — Moderado</SelectItem>
                          <SelectItem value="10">10 por segundo (~36,000 / hr) — Acelerado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="pt-2 border-t mt-4">
                       <h3 className="text-lg font-semibold mb-1">Distribución Inteligente</h3>
                       <p className="text-sm text-muted-foreground mb-4">Podemos repartir el monto total de emails enviando un poco cada día según la duración original de la campaña.</p>
                       
                       {!hasDates ? (
                         <div className="p-3 bg-warning/10 text-warning rounded text-sm text-center font-medium">
                           Para usar esta función, la campaña debe tener configuradas de antemano "Fecha inicio" y "Fecha fin". Vuelve a editar la campaña para añadir las fechas.
                         </div>
                       ) : (
                         <div className={`p-4 border rounded-xl flex items-start gap-4 transition-all ${sendForm.distribute_over_days ? 'bg-primary/5 border-primary/30' : 'bg-background'}`}>
                           <Switch checked={sendForm.distribute_over_days} onCheckedChange={v => setSendForm({ ...sendForm, distribute_over_days: v })} />
                           <div>
                             <span className="font-semibold block mb-0.5">Espaciar entre días automáticamente</span>
                             <p className="text-xs text-muted-foreground leading-relaxed">
                               Si se activa, distribuiremos los envíos en partes iguales entre {new Date(sendCampaign!.start_date!).toLocaleDateString()} y {new Date(sendCampaign!.end_date!).toLocaleDateString()}. Excelente opción para evitar saturación y bans.
                             </p>
                           </div>
                         </div>
                       )}
                    </div>
                 </div>
               )}

               {sendStep === 4 && (
                 <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-8">
                    <h3 className="text-lg font-bold text-center mb-6">Resumen del Despacho</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="border rounded-lg p-3 bg-muted/10">
                        <span className="block text-xs uppercase text-muted-foreground tracking-wider mb-1 font-semibold">Canal</span>
                        <span className="font-medium">📧 Email Marketing</span>
                      </div>
                      <div className="border rounded-lg p-3 bg-muted/10">
                        <span className="block text-xs uppercase text-muted-foreground tracking-wider mb-1 font-semibold">Tasa de Envío</span>
                        <span className="font-medium">{sendForm.emails_per_second} msg/seg.</span>
                      </div>
                      <div className="col-span-2 border rounded-lg p-3 bg-muted/10">
                        <span className="block text-xs uppercase text-muted-foreground tracking-wider mb-1 font-semibold">Distribución Fechas</span>
                        <span className="font-medium text-primary">
                          {sendForm.distribute_over_days ? `Repartición inteligente activada a lo largo del periodo.` : 'Envío masivo continuado hoy.'}
                        </span>
                      </div>
                      <div className="col-span-2 border rounded-lg p-3 bg-muted/10">
                        <span className="block text-xs uppercase text-muted-foreground tracking-wider mb-1 font-semibold">Pruebas A/B</span>
                        <span className="font-medium">
                          {sendForm.is_ab_test ? `Activadas (${sendForm.ab_test_percentage}% de test). Métrica definida: ${sendForm.ab_winning_metric === 'opens' ? 'Aperturas' : 'Clicks'}.` : 'Desactivadas (Sin variante B y enviando al 100%).'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <p className="text-xs text-muted-foreground text-center mb-3 leading-relaxed">¿Deseas enviar un email remiente estático distinto al de tu configuración general?</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Input className="text-sm h-9" placeholder="De (Email)" value={sendForm.from_email} onChange={e => setSendForm({ ...sendForm, from_email: e.target.value })} />
                        <Input className="text-sm h-9" placeholder="Nombre (Ej: Franco de ABC)" value={sendForm.from_name} onChange={e => setSendForm({ ...sendForm, from_name: e.target.value })} />
                      </div>
                    </div>
                 </div>
               )}
            </div>
          </div>
          
          <DialogFooter className="p-4 border-t bg-muted/20 flex justify-between sm:justify-between items-center shrink-0">
             <Button variant="ghost" onClick={() => setSendStep(Math.max(1, sendStep - 1))} disabled={sendStep === 1} className="w-24">
               <ChevronLeft className="w-4 h-4 mr-1"/> Volver
             </Button>
             
             {sendStep < 4 ? (
               <Button onClick={() => setSendStep(sendStep + 1)} disabled={(sendStep === 1 && !validateStep1()) || (sendStep === 2 && !validateStep2())} className="w-32 bg-indigo-600 hover:bg-indigo-700 text-white">
                 Siguiente <ChevronRight className="w-4 h-4 ml-1"/>
               </Button>
             ) : (
               <Button onClick={handleSend} disabled={sendLoading} className="w-48 bg-primary shadow-md hover:shadow-lg transition-all font-bold">
                  {sendLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Iniciando...</> : <><Send className="h-4 w-4 mr-2" />Despachar Servidor</>}
               </Button>
             )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Metrics Dialog */}
      <Dialog open={metricsOpen} onOpenChange={setMetricsOpen}>
        <DialogContent className="max-w-4xl p-6 bg-slate-50">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="text-primary"/>Métricas en Vivo: {metricsCampaign?.name}</DialogTitle>
            <CardDescription>Rendimiento por despachos y análisis de resultados para Tests A/B.</CardDescription>
          </DialogHeader>
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pb-4 pr-1">
            {campaignSends.length === 0 ? (
              <div className="text-center bg-white p-10 border rounded-xl border-dashed">
                <p className="text-muted-foreground">Todavía no has generado despachos masivos con esta campaña.</p>
              </div>
            ) : (
              // Agrupamos A/B sends si existen.
              campaignSends.map((s: any) => {
                if (s.is_ab_test && s.ab_variant === 'B') return null; // We render A and B together.
                
                let bVariant = null;
                if (s.is_ab_test && s.ab_variant === 'A') {
                  bVariant = campaignSends.find((x: any) => x.ab_parent_id === s.id);
                }

                const renderSendCard = (sendData: any, titleStr: string, isWinner: boolean, metricWatch: string) => {
                  const m = trackingData[sendData.id] || { opens: 0, clicks: 0 };
                  const prog = sendData.total_emails > 0 ? Math.round(((sendData.sent_count + sendData.failed_count) / sendData.total_emails) * 100) : 0;
                  const oRate = sendData.sent_count > 0 ? ((m.opens / sendData.sent_count) * 100).toFixed(1) : '0';
                  const cRate = sendData.sent_count > 0 ? ((m.clicks / sendData.sent_count) * 100).toFixed(1) : '0';
                  const isActive = sendData.status === 'processing';
                  
                  return (
                    <div className={`p-4 border rounded-xl transition-all relative overflow-hidden bg-white ${isWinner ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-md' : 'shadow-sm'}`}>
                      {isWinner && <div className="absolute top-0 right-0 bg-amber-400 text-white text-[10px] uppercase font-bold px-3 py-1 rounded-bl-lg tracking-wider flex"><Trophy className="w-3 h-3 mr-1"/> Líder actual</div>}
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm tracking-tight">{titleStr}</h4>
                          <span className="flex text-[11px] text-muted-foreground uppercase opacity-70">
                            {new Date(sendData.created_at).toLocaleString('es-ES', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                          </span>
                        </div>
                        <Badge variant={sendData.status === 'completed' ? 'default' : isActive ? 'outline' : 'destructive'} className={isActive ? "border-primary text-primary" : ""}>
                          {sendData.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className={`p-3 rounded-lg flex flex-col justify-center items-center ${metricWatch === 'opens' && s.is_ab_test ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50 border border-transparent'}`}>
                           <span className="text-xl font-bold flex gap-1.5 items-center"><Eye className="w-4 h-4 text-primary"/> {m.opens}</span>
                           <span className="text-[10px] text-muted-foreground font-semibold uppercase">{oRate}% Aperturas</span>
                        </div>
                        <div className={`p-3 rounded-lg flex flex-col justify-center items-center ${metricWatch === 'clicks' && s.is_ab_test ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50 border border-transparent'}`}>
                           <span className="text-xl font-bold flex gap-1.5 items-center"><MousePointerClick className="w-4 h-4 text-emerald-600"/> {m.clicks}</span>
                           <span className="text-[10px] text-muted-foreground font-semibold uppercase">{cRate}% Clicks</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-medium text-slate-500 uppercase tracking-widest">
                           <span>{prog}% Progreso</span>
                           <span>{sendData.sent_count} de {sendData.total_emails}</span>
                        </div>
                        <Progress value={prog} className="h-1.5" />
                        {sendData.failed_count > 0 && <span className="block text-right mt-1 text-xs text-destructive font-medium">{sendData.failed_count} fallidos</span>}
                      </div>
                    </div>
                  );
                };

                if (s.is_ab_test && bVariant) {
                   const m1 = trackingData[s.id] || { opens: 0, clicks: 0 };
                   const m2 = trackingData[bVariant.id] || { opens: 0, clicks: 0 };
                   const metricVar = s.ab_winning_metric || 'opens'; 
                   let winnerSendId = null;
                   
                   // Determinar el líder actual para pintarlo
                   if (metricVar === 'opens') {
                     if (m1.opens > m2.opens) winnerSendId = s.id;
                     else if (m2.opens > m1.opens) winnerSendId = bVariant.id;
                   } else {
                     if (m1.clicks > m2.clicks) winnerSendId = s.id;
                     else if (m2.clicks > m1.clicks) winnerSendId = bVariant.id;
                   }
                   
                   const timeElapsed = (new Date().getTime() - new Date(s.started_at).getTime()) / 3600000;
                   const isReadyToPick = (timeElapsed >= s.ab_wait_hours) && !s.ab_winner_sent;

                   return (
                     <div key={s.id} className="p-5 border-2 border-indigo-100 rounded-2xl bg-indigo-50/30">
                        <div className="flex justify-between items-center mb-4">
                           <h3 className="font-black text-indigo-900 tracking-tight flex items-center gap-2">
                             <LayoutTemplate className="w-5 h-5 text-indigo-600"/> 
                             A/B Test en Curso (Evaluando por: {metricVar === 'opens' ? 'Aperturas' : 'Clicks'})
                           </h3>
                           <Badge className="bg-indigo-600 text-white border-transparent">Prueba A/B</Badge>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                           {renderSendCard(s, "Variante A", winnerSendId === s.id, metricVar)}
                           {renderSendCard(bVariant, "Variante B", winnerSendId === bVariant.id, metricVar)}
                        </div>
                        <div className="mt-5 border-t border-indigo-200/50 pt-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
                            <div className="text-sm">
                              {s.ab_winner_sent ? (
                                <p className="text-emerald-700 font-semibold bg-emerald-100 px-4 py-2 rounded-lg flex items-center"><CheckCircle className="w-4 h-4 mr-2"/> La variante ganadora ya fue despachada exitosamente al resto de la lista.</p>
                              ) : (
                                <p className="text-slate-600">Restan enviar mails al <strong>resto del segmento</strong>. Clickea para dispararlos automáticamente con la plantilla líder actual.</p>
                              )}
                            </div>
                            {!s.ab_winner_sent && winnerSendId && (
                               <Button onClick={() => handleSelectWinner(winnerSendId)} disabled={winnerLoading} className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 shadow border-amber-600 dark:border-amber-400 text-white font-bold h-11 shrink-0">
                                  {winnerLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trophy className="w-4 h-4 mr-2"/>}
                                  Aprobar Líder y Enviar
                               </Button>
                            )}
                            {!s.ab_winner_sent && !winnerSendId && isReadyToPick && (
                               <p className="text-xs text-muted-foreground w-full sm:w-auto italic text-right">Ambas plantillas tienen igual rendimiento. Opciones neutrales en breve.</p>
                            )}
                        </div>
                     </div>
                   );
                }

                // If not AB Test 
                return (
                  <div key={s.id} className="mb-4">
                     {renderSendCard(s, "Envío Masivo Directo", false, 'opens')}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );


}
