import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ full_name: '', phone: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setForm({ full_name: data.full_name || '', phone: data.phone || '' });
    });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('profiles').update(form).eq('user_id', user.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Perfil actualizado' }); }
    setLoading(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="text-3xl font-bold">Configuración</h1><p className="text-muted-foreground">Ajustes de tu cuenta</p></div>

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
    </div>
  );
}
