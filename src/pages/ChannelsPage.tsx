import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CopyId } from '@/components/CopyId';
import { Plus, Trash2, MessageSquare, Phone, Mail, Send, Bot, Globe, Copy, Check, RefreshCw } from 'lucide-react';

const CHANNEL_TYPES = [
  { value: 'whatsapp_evolution', label: 'WhatsApp (Evolution API)', icon: Phone, color: 'text-green-500' },
  { value: 'telegram', label: 'Telegram Bot', icon: Bot, color: 'text-blue-500' },
  { value: 'email', label: 'Email Entrante', icon: Mail, color: 'text-orange-500' },
  { value: 'facebook', label: 'Facebook Messenger', icon: MessageSquare, color: 'text-blue-600' },
  { value: 'instagram', label: 'Instagram DM', icon: MessageSquare, color: 'text-pink-500' },
  { value: 'webchat', label: 'Web Chat', icon: Globe, color: 'text-primary' },
];

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  active: { label: 'Activo', variant: 'default' },
  inactive: { label: 'Inactivo', variant: 'secondary' },
  error: { label: 'Error', variant: 'destructive' },
};

type Channel = {
  id: string; user_id: string; name: string; type: string; status: string;
  config: any; webhook_secret: string | null; created_at: string; updated_at: string;
};

export default function ChannelsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'whatsapp_evolution', api_url: '', instance_name: '', api_key: '', bot_token: '' });
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null);

  const fetchChannels = async () => {
    if (!user) return;
    const { data } = await supabase.from('channels').select('*').order('created_at', { ascending: false });
    setChannels((data as Channel[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchChannels(); }, [user]);

  const generateSecret = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  const handleCreate = async () => {
    if (!user || !form.name) return;
    const config: any = {};
    if (form.type === 'whatsapp_evolution') {
      config.api_url = form.api_url;
      config.instance_name = form.instance_name;
      config.api_key = form.api_key;
    } else if (form.type === 'telegram') {
      config.bot_token = form.bot_token;
    }

    const { error } = await supabase.from('channels').insert({
      user_id: user.id,
      name: form.name,
      type: form.type as any,
      status: 'active' as any,
      config,
      webhook_secret: generateSecret(),
    });

    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Canal creado' });
    setDialogOpen(false);
    setForm({ name: '', type: 'whatsapp_evolution', api_url: '', instance_name: '', api_key: '', bot_token: '' });
    fetchChannels();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('channels').delete().eq('id', id);
    toast({ title: 'Canal eliminado' });
    fetchChannels();
  };

  const toggleStatus = async (ch: Channel) => {
    const newStatus = ch.status === 'active' ? 'inactive' : 'active';
    await supabase.from('channels').update({ status: newStatus }).eq('id', ch.id);
    fetchChannels();
  };

  const getWebhookUrl = (ch: Channel) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const base = `https://${projectId}.supabase.co/functions/v1/channel-webhook/${ch.id}`;
    return ch.webhook_secret ? `${base}?secret=${ch.webhook_secret}` : base;
  };

  const copyWebhook = (ch: Channel) => {
    navigator.clipboard.writeText(getWebhookUrl(ch));
    setCopiedWebhook(ch.id);
    setTimeout(() => setCopiedWebhook(null), 2000);
  };

  const typeInfo = (type: string) => CHANNEL_TYPES.find(t => t.value === type) || CHANNEL_TYPES[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Canales</h1>
          <p className="text-muted-foreground">Configura tus canales de comunicación para capturar leads</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Agregar Canal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Canal</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Mi WhatsApp Business" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNEL_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <t.icon className={`h-4 w-4 ${t.color}`} />
                          {t.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.type === 'whatsapp_evolution' && (
                <>
                  <div><Label>URL de la API de Evolution</Label><Input value={form.api_url} onChange={e => setForm({ ...form, api_url: e.target.value })} placeholder="https://evolution.tudominio.com" /></div>
                  <div><Label>Nombre de Instancia</Label><Input value={form.instance_name} onChange={e => setForm({ ...form, instance_name: e.target.value })} placeholder="mi-instancia" /></div>
                  <div><Label>API Key</Label><Input type="password" value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} placeholder="Tu API key de Evolution" /></div>
                </>
              )}

              {form.type === 'telegram' && (
                <div><Label>Bot Token</Label><Input type="password" value={form.bot_token} onChange={e => setForm({ ...form, bot_token: e.target.value })} placeholder="123456:ABC-DEF..." /></div>
              )}

              <Button onClick={handleCreate} className="w-full">Crear Canal</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>
      ) : channels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4" />
            <p>No hay canales configurados</p>
            <p className="text-sm">Agrega un canal para empezar a capturar leads</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {channels.map(ch => {
            const info = typeInfo(ch.type);
            const statusBadge = STATUS_BADGES[ch.status] || STATUS_BADGES.inactive;
            return (
              <Card key={ch.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <info.icon className={`h-5 w-5 ${info.color}`} />
                      <div>
                        <CardTitle className="text-base">{ch.name}</CardTitle>
                        <CardDescription className="text-xs">{info.label}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">ID:</span>
                    <CopyId id={ch.id} />
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <code className="text-[10px] bg-muted p-1.5 rounded flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{getWebhookUrl(ch).slice(0, 60)}...</code>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyWebhook(ch)}>
                        {copiedWebhook === ch.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Configurá esta URL en tu {info.label} para recibir mensajes</p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => toggleStatus(ch)}>
                      {ch.status === 'active' ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(ch.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Setup instructions */}
      <Card>
        <CardHeader><CardTitle className="text-lg">¿Cómo funciona?</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</div>
            <div><strong className="text-foreground">Creá un canal</strong> — Seleccioná el tipo (WhatsApp, Telegram, Email, etc.) y configurá las credenciales.</div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</div>
            <div><strong className="text-foreground">Copiá la URL del webhook</strong> — Pegala en tu Evolution API, bot de Telegram, o servicio de email para recibir mensajes.</div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</div>
            <div><strong className="text-foreground">Los leads se crean solos</strong> — Cada mensaje entrante crea automáticamente un contacto en tu CRM si no existe.</div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</div>
            <div><strong className="text-foreground">Respondé desde el Inbox</strong> — Todos los mensajes llegan al inbox unificado donde podés ver y responder.</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
