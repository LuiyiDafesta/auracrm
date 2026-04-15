import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Mail, Send, Loader2, BarChart3, Trophy, Eye, MousePointerClick } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Send dialog state
  const [sendOpen, setSendOpen] = useState(false);
  const [sendCampaign, setSendCampaign] = useState<Campaign | null>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [sendForm, setSendForm] = useState({
    segment_id: '', template_id: '', emails_per_second: '1',
    from_email: '', from_name: '',
    is_ab_test: false, template_id_b: '', ab_test_percentage: 10, ab_wait_hours: 24,
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
  };

  const fetchActiveSends = async () => {
    if (!user) return;
    const { data } = await supabase.from('campaign_sends' as any).select('*').in('status', ['pending', 'processing']).order('created_at', { ascending: false }) as any;
    setActiveSends(data || []);
  };

  useEffect(() => { fetchData(); fetchActiveSends(); }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel('campaign_sends_progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_sends' }, () => {
        fetchActiveSends();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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
    setSendForm({
      segment_id: '', template_id: '', emails_per_second: '1',
      from_email: (c as any).from_email || '', from_name: (c as any).from_name || '',
      is_ab_test: false, template_id_b: '', ab_test_percentage: 10, ab_wait_hours: 24,
      distribute_over_days: !!(c.start_date && c.end_date),
    });
    const [segRes, tmplRes] = await Promise.all([
      supabase.from('segments').select('id, name'),
      supabase.from('email_templates').select('id, name, subject'),
    ]);
    setSegments(segRes.data || []);
    setTemplates(tmplRes.data || []);
    setSendOpen(true);
  };

  const handleSend = async () => {
    if (!sendCampaign || !sendForm.segment_id || !sendForm.template_id) {
      toast({ title: 'Error', description: 'Selecciona segmento y plantilla', variant: 'destructive' });
      return;
    }
    if (sendForm.is_ab_test && !sendForm.template_id_b) {
      toast({ title: 'Error', description: 'Selecciona la plantilla B para el A/B test', variant: 'destructive' });
      return;
    }
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
          distribute_over_days: sendForm.distribute_over_days,
        },
      });
      if (res.error) throw new Error(res.error.message);
      const result = res.data;
      if (result?.success) {
        const desc = result.type === 'ab_test'
          ? `A/B Test: ${result.test_emails_a}+${result.test_emails_b} pruebas, ${result.remaining_emails} pendientes`
          : `${result.total_emails} emails en cola${result.days > 1 ? ` (${result.days} días)` : ''} a ${result.emails_per_second}/seg`;
        toast({ title: '¡Campaña lanzada!', description: desc });
        setSendOpen(false);
        fetchActiveSends();
      } else {
        throw new Error(result?.error || 'Error desconocido');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
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
        // Refresh metrics
        if (metricsCampaign) openMetrics(metricsCampaign);
        fetchActiveSends();
      } else {
        throw new Error(result?.error || 'Error');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setWinnerLoading(false);
  };

  const hasDates = sendCampaign?.start_date && sendCampaign?.end_date;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Campañas</h1><p className="text-muted-foreground">Gestiona campañas, envíos masivos y A/B testing</p></div>
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
                <p className="text-xs text-muted-foreground mb-3">Si no se configura, se usará el remitente del SMTP global.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-sm font-medium">Email remitente</label><Input placeholder="ventas@otrodominio.com" value={form.from_email} onChange={e => setForm({ ...form, from_email: e.target.value })} /></div>
                  <div className="space-y-2"><label className="text-sm font-medium">Nombre remitente</label><Input placeholder="Otra Empresa" value={form.from_name} onChange={e => setForm({ ...form, from_name: e.target.value })} /></div>
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? 'Guardar cambios' : 'Crear campaña'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active sends progress */}
      {activeSends.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><h3 className="text-sm font-medium">Envíos en curso</h3></CardHeader>
          <CardContent className="space-y-3">
            {activeSends.map((s: any) => {
              const progress = s.total_emails > 0 ? Math.round(((s.sent_count + s.failed_count) / s.total_emails) * 100) : 0;
              const campaignName = campaigns.find(c => c.id === s.campaign_id)?.name || 'Campaña';
              const variant = s.ab_variant ? ` (Variante ${s.ab_variant})` : '';
              return (
                <div key={s.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{campaignName}{variant}</span>
                    <span className="text-muted-foreground">
                      {s.sent_count}/{s.total_emails} enviados ({s.emails_per_second}/seg)
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Presupuesto</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead className="w-36"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No hay campañas</TableCell></TableRow>
              ) : campaigns.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.type || '—'}</TableCell>
                  <TableCell><Badge className={statusColors[c.status]} variant="secondary">{c.status}</Badge></TableCell>
                  <TableCell>{c.budget ? `$${Number(c.budget).toLocaleString()}` : '—'}</TableCell>
                  <TableCell>{c.start_date ? new Date(c.start_date).toLocaleDateString('es-ES') : '—'}</TableCell>
                  <TableCell>{c.end_date ? new Date(c.end_date).toLocaleDateString('es-ES') : '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openSendDialog(c)} title="Enviar campaña"><Send className="h-4 w-4 text-primary" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openMetrics(c)} title="Métricas"><BarChart3 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/email-builder/new?campaign=${c.id}`)} title="Crear email"><Mail className="h-4 w-4" /></Button>
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

      {/* Send Campaign Dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Enviar Campaña: {sendCampaign?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <label className="text-sm font-medium">Segmento de contactos *</label>
              <Select value={sendForm.segment_id} onValueChange={v => setSendForm({ ...sendForm, segment_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona un segmento" /></SelectTrigger>
                <SelectContent>{segments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Plantilla{sendForm.is_ab_test ? ' A' : ''} *</label>
              <Select value={sendForm.template_id} onValueChange={v => setSendForm({ ...sendForm, template_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona una plantilla" /></SelectTrigger>
                <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name} — {t.subject}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Velocidad de envío</label>
              <Select value={sendForm.emails_per_second} onValueChange={v => setSendForm({ ...sendForm, emails_per_second: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1/seg (~3,600/hora)</SelectItem>
                  <SelectItem value="2">2/seg (~7,200/hora)</SelectItem>
                  <SelectItem value="5">5/seg (~18,000/hora)</SelectItem>
                  <SelectItem value="10">10/seg (~36,000/hora)</SelectItem>
                  <SelectItem value="20">20/seg (~72,000/hora)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date distribution */}
            {hasDates && (
              <div className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">Distribuir en la duración</p>
                  <p className="text-xs text-muted-foreground">Repartir emails entre {sendCampaign?.start_date} y {sendCampaign?.end_date}</p>
                </div>
                <Switch checked={sendForm.distribute_over_days} onCheckedChange={v => setSendForm({ ...sendForm, distribute_over_days: v })} />
              </div>
            )}

            {/* A/B Testing */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">A/B Testing</p>
                  <p className="text-xs text-muted-foreground">Prueba 2 plantillas y envía la ganadora al resto</p>
                </div>
                <Switch checked={sendForm.is_ab_test} onCheckedChange={v => setSendForm({ ...sendForm, is_ab_test: v })} />
              </div>

              {sendForm.is_ab_test && (
                <div className="space-y-3 pl-1">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Plantilla B *</label>
                    <Select value={sendForm.template_id_b} onValueChange={v => setSendForm({ ...sendForm, template_id_b: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecciona la plantilla B" /></SelectTrigger>
                      <SelectContent>{templates.filter(t => t.id !== sendForm.template_id).map(t => <SelectItem key={t.id} value={t.id}>{t.name} — {t.subject}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">% de prueba: {sendForm.ab_test_percentage}%</label>
                    <p className="text-xs text-muted-foreground">{sendForm.ab_test_percentage / 2}% para cada variante, {100 - sendForm.ab_test_percentage}% para el ganador</p>
                    <Slider
                      value={[sendForm.ab_test_percentage]}
                      onValueChange={v => setSendForm({ ...sendForm, ab_test_percentage: v[0] })}
                      min={2} max={50} step={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tiempo de evaluación</label>
                    <Select value={String(sendForm.ab_wait_hours)} onValueChange={v => setSendForm({ ...sendForm, ab_wait_hours: parseInt(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6">6 horas</SelectItem>
                        <SelectItem value="12">12 horas</SelectItem>
                        <SelectItem value="24">24 horas</SelectItem>
                        <SelectItem value="48">48 horas</SelectItem>
                        <SelectItem value="72">72 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Sender override */}
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-1">Remitente <span className="text-muted-foreground font-normal">(opcional)</span></p>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Input placeholder="Email remitente" value={sendForm.from_email} onChange={e => setSendForm({ ...sendForm, from_email: e.target.value })} />
                <Input placeholder="Nombre remitente" value={sendForm.from_name} onChange={e => setSendForm({ ...sendForm, from_name: e.target.value })} />
              </div>
            </div>

            <Button onClick={handleSend} disabled={sendLoading} className="w-full">
              {sendLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Encolando...</> : <><Send className="h-4 w-4 mr-2" />{sendForm.is_ab_test ? 'Lanzar A/B Test' : 'Lanzar envío'}</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Metrics Dialog */}
      <Dialog open={metricsOpen} onOpenChange={setMetricsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Métricas: {metricsCampaign?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {campaignSends.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No hay envíos para esta campaña</p>
            ) : (
              campaignSends.map((s: any) => {
                const metrics = trackingData[s.id] || { opens: 0, clicks: 0 };
                const progress = s.total_emails > 0 ? Math.round(((s.sent_count + s.failed_count) / s.total_emails) * 100) : 0;
                const openRate = s.sent_count > 0 ? ((metrics.opens / s.sent_count) * 100).toFixed(1) : '0';
                const clickRate = s.sent_count > 0 ? ((metrics.clicks / s.sent_count) * 100).toFixed(1) : '0';
                const isAB = s.is_ab_test;
                const canPickWinner = isAB && s.status === 'completed' && !s.ab_winner_sent;

                return (
                  <Card key={s.id} className={isAB ? 'border-primary/30' : ''}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isAB && <Badge variant="outline">Variante {s.ab_variant}</Badge>}
                          <Badge variant={s.status === 'completed' ? 'default' : s.status === 'processing' ? 'secondary' : 'destructive'}>
                            {s.status}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleString('es-ES')}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        <div className="text-center p-2 rounded bg-muted/50">
                          <p className="text-lg font-bold">{s.sent_count}</p>
                          <p className="text-xs text-muted-foreground">Enviados</p>
                        </div>
                        <div className="text-center p-2 rounded bg-muted/50">
                          <p className="text-lg font-bold flex items-center justify-center gap-1"><Eye className="h-4 w-4" />{metrics.opens}</p>
                          <p className="text-xs text-muted-foreground">{openRate}% aperturas</p>
                        </div>
                        <div className="text-center p-2 rounded bg-muted/50">
                          <p className="text-lg font-bold flex items-center justify-center gap-1"><MousePointerClick className="h-4 w-4" />{metrics.clicks}</p>
                          <p className="text-xs text-muted-foreground">{clickRate}% clicks</p>
                        </div>
                        <div className="text-center p-2 rounded bg-muted/50">
                          <p className="text-lg font-bold text-destructive">{s.failed_count}</p>
                          <p className="text-xs text-muted-foreground">Fallidos</p>
                        </div>
                      </div>

                      <Progress value={progress} className="h-1.5" />

                      {canPickWinner && (
                        <Button
                          variant="outline" size="sm"
                          className="w-full border-primary text-primary"
                          onClick={() => handleSelectWinner(s.id)}
                          disabled={winnerLoading}
                        >
                          {winnerLoading
                            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            : <Trophy className="h-4 w-4 mr-2" />
                          }
                          Elegir como ganadora y enviar al resto
                        </Button>
                      )}

                      {s.ab_winner_sent && (
                        <p className="text-xs text-center text-muted-foreground">✅ Ganador enviado al resto del segmento</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
