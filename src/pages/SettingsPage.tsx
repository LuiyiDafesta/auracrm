import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Mail, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ full_name: '', phone: '' });
  const [loading, setLoading] = useState(false);

  // SMTP state
  const [smtp, setSmtp] = useState({
    host: '', port: '587', username: '', password: '',
    from_email: '', from_name: '', encryption: 'tls',
  });
  const [smtpId, setSmtpId] = useState<string | null>(null);
  const [smtpVerified, setSmtpVerified] = useState(false);
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Load profile
    supabase.from('profiles').select('*').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setForm({ full_name: data.full_name || '', phone: data.phone || '' });
    });
    // Load SMTP config
    supabase.from('smtp_config' as any).select('*').eq('user_id', user.id).single().then(({ data }: any) => {
      if (data) {
        setSmtpId(data.id);
        setSmtpVerified(data.is_verified);
        setSmtp({
          host: data.host || '', port: String(data.port || 587),
          username: data.username || '', password: data.password || '',
          from_email: data.from_email || '', from_name: data.from_name || '',
          encryption: data.encryption || 'tls',
        });
        setTestEmail(data.from_email || '');
      }
    });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('profiles').update(form).eq('user_id', user.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Perfil actualizado' });
    setLoading(false);
  };

  const handleSmtpSave = async () => {
    if (!user) return;
    if (!smtp.host || !smtp.username || !smtp.password || !smtp.from_email) {
      toast({ title: 'Error', description: 'Completa los campos obligatorios', variant: 'destructive' });
      return;
    }
    setSmtpLoading(true);
    const payload: any = {
      user_id: user.id,
      host: smtp.host.trim(),
      port: parseInt(smtp.port) || 587,
      username: smtp.username.trim(),
      password: smtp.password,
      from_email: smtp.from_email.trim(),
      from_name: smtp.from_name.trim(),
      encryption: smtp.encryption,
      is_verified: false,
    };
    let error;
    if (smtpId) {
      ({ error } = await supabase.from('smtp_config' as any).update(payload).eq('id', smtpId) as any);
    } else {
      const res = await (supabase.from('smtp_config' as any).insert(payload).select().single() as any);
      error = res.error;
      if (res.data) setSmtpId(res.data.id);
    }
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Configuración SMTP guardada' });
      setSmtpVerified(false);
    }
    setSmtpLoading(false);
  };

  const handleTestSmtp = async () => {
    if (!testEmail) {
      toast({ title: 'Error', description: 'Ingresa un email de destino', variant: 'destructive' });
      return;
    }
    setTestLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('send-test-email', {
        body: {
          to_email: testEmail,
          smtp_host: smtp.host,
          smtp_port: parseInt(smtp.port) || 587,
          smtp_username: smtp.username,
          smtp_password: smtp.password,
          from_email: smtp.from_email,
          from_name: smtp.from_name,
          encryption: smtp.encryption,
        },
      });
      if (res.error) throw new Error(res.error.message);
      const result = res.data;
      if (result?.success) {
        toast({ title: '¡Email de prueba enviado!', description: `Revisa ${testEmail}` });
        // Mark as verified
        if (smtpId) {
          await supabase.from('smtp_config' as any).update({ is_verified: true } as any).eq('id', smtpId);
          setSmtpVerified(true);
        }
      } else {
        throw new Error(result?.error || 'Error desconocido');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setTestLoading(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="text-3xl font-bold">Configuración</h1><p className="text-muted-foreground">Ajustes de tu cuenta y envíos</p></div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="smtp">SMTP / Email</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Perfil</CardTitle>
              <CardDescription>Actualiza tu información personal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Correo electrónico</label>
                <Input value={user?.email || ''} disabled />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre completo</label>
                <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Teléfono</label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <Button onClick={handleSave} disabled={loading}>{loading ? 'Guardando...' : 'Guardar cambios'}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smtp">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Configuración SMTP
                  </CardTitle>
                  <CardDescription>Conecta tu servidor SMTP para enviar emails de campañas</CardDescription>
                </div>
                {smtpId && (
                  <Badge variant={smtpVerified ? 'default' : 'secondary'} className="flex items-center gap-1">
                    {smtpVerified ? <><CheckCircle className="h-3 w-3" /> Verificado</> : <><XCircle className="h-3 w-3" /> Sin verificar</>}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Host SMTP *</label>
                  <Input placeholder="smtp.gmail.com" value={smtp.host} onChange={e => setSmtp({ ...smtp, host: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Puerto *</label>
                  <Input type="number" value={smtp.port} onChange={e => setSmtp({ ...smtp, port: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Usuario *</label>
                  <Input placeholder="user@example.com" value={smtp.username} onChange={e => setSmtp({ ...smtp, username: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contraseña *</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={smtp.password}
                      onChange={e => setSmtp({ ...smtp, password: e.target.value })}
                    />
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email remitente *</label>
                  <Input placeholder="noreply@tuempresa.com" value={smtp.from_email} onChange={e => setSmtp({ ...smtp, from_email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre remitente</label>
                  <Input placeholder="Mi Empresa" value={smtp.from_name} onChange={e => setSmtp({ ...smtp, from_name: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2 max-w-xs">
                <label className="text-sm font-medium">Encriptación</label>
                <Select value={smtp.encryption} onValueChange={v => setSmtp({ ...smtp, encryption: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tls">TLS (puerto 587)</SelectItem>
                    <SelectItem value="ssl">SSL (puerto 465)</SelectItem>
                    <SelectItem value="none">Ninguna (puerto 25)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSmtpSave} disabled={smtpLoading}>
                  {smtpLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</> : 'Guardar configuración'}
                </Button>
              </div>

              {smtpId && (
                <div className="border-t pt-4 mt-4 space-y-3">
                  <h4 className="text-sm font-medium">Probar conexión</h4>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Email de destino para la prueba"
                      value={testEmail}
                      onChange={e => setTestEmail(e.target.value)}
                      className="max-w-sm"
                    />
                    <Button variant="outline" onClick={handleTestSmtp} disabled={testLoading}>
                      {testLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</> : <><Mail className="h-4 w-4 mr-2" />Enviar prueba</>}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
