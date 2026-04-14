import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Mail, Send, Loader2 } from 'lucide-react';
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
  const [sendForm, setSendForm] = useState({ segment_id: '', template_id: '', emails_per_second: '1', from_email: '', from_name: '' });
  const [sendLoading, setSendLoading] = useState(false);

  // Active sends for progress
  const [activeSends, setActiveSends] = useState<any[]>([]);

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

  // Realtime subscription for campaign_sends progress
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
    setSendForm({ segment_id: '', template_id: '', emails_per_second: '1', from_email: (c as any).from_email || '', from_name: (c as any).from_name || '' });
    // Fetch segments and templates
    const [segRes, tmplRes] = await Promise.all([
      supabase.from('segments').select('id, name'),
      supabase.from('email_templates').select('id, name, subject').eq('campaign_id', c.id),
    ]);
    setSegments(segRes.data || []);
    // Also get templates without campaign_id
    const { data: allTemplates } = await supabase.from('email_templates').select('id, name, subject');
    setTemplates(allTemplates || []);
    setSendOpen(true);
  };

  const handleSend = async () => {
    if (!sendCampaign || !sendForm.segment_id || !sendForm.template_id) {
      toast({ title: 'Error', description: 'Selecciona segmento y plantilla', variant: 'destructive' });
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
        },
      });
      if (res.error) throw new Error(res.error.message);
      const result = res.data;
      if (result?.success) {
        toast({ title: '¡Campaña lanzada!', description: `${result.total_emails} emails en cola a ${result.emails_per_second}/seg` });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Campañas</h1><p className="text-muted-foreground">Gestiona tus campañas y envíos masivos</p></div>
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
          <CardHeader className="pb-3">
            <h3 className="text-sm font-medium">Envíos en curso</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeSends.map((s: any) => {
              const progress = s.total_emails > 0 ? Math.round(((s.sent_count + s.failed_count) / s.total_emails) * 100) : 0;
              const campaignName = campaigns.find(c => c.id === s.campaign_id)?.name || 'Campaña';
              return (
                <div key={s.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{campaignName}</span>
                    <span className="text-muted-foreground">
                      {s.sent_count} enviados · {s.failed_count} fallidos / {s.total_emails} total ({s.emails_per_second}/seg)
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
                <TableHead className="w-28"></TableHead>
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
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar Campaña: {sendCampaign?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Segmento de contactos *</label>
              <Select value={sendForm.segment_id} onValueChange={v => setSendForm({ ...sendForm, segment_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona un segmento" /></SelectTrigger>
                <SelectContent>
                  {segments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Plantilla de email *</label>
              <Select value={sendForm.template_id} onValueChange={v => setSendForm({ ...sendForm, template_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona una plantilla" /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name} — {t.subject}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Velocidad de envío</label>
              <Select value={sendForm.emails_per_second} onValueChange={v => setSendForm({ ...sendForm, emails_per_second: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 email/seg (~3,600/hora)</SelectItem>
                  <SelectItem value="2">2 emails/seg (~7,200/hora)</SelectItem>
                  <SelectItem value="5">5 emails/seg (~18,000/hora)</SelectItem>
                  <SelectItem value="10">10 emails/seg (~36,000/hora)</SelectItem>
                  <SelectItem value="20">20 emails/seg (~72,000/hora)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-1">Remitente <span className="text-muted-foreground font-normal">(opcional, sobreescribe el de la campaña)</span></p>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Input placeholder="Email remitente" value={sendForm.from_email} onChange={e => setSendForm({ ...sendForm, from_email: e.target.value })} />
                <Input placeholder="Nombre remitente" value={sendForm.from_name} onChange={e => setSendForm({ ...sendForm, from_name: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleSend} disabled={sendLoading} className="w-full">
              {sendLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Encolando...</> : <><Send className="h-4 w-4 mr-2" />Lanzar envío</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
