import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Play, Pause, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-muted text-muted-foreground' },
  active: { label: 'Activa', color: 'bg-success/10 text-success' },
  paused: { label: 'Pausada', color: 'bg-warning/10 text-warning' },
};

export default function AutomationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [automations, setAutomations] = useState<any[]>([]);

  const fetchData = async () => {
    if (!user) return;
    const { data } = await (supabase.from('automations' as any).select('*').order('created_at', { ascending: false }) as any);
    setAutomations(data || []);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleDelete = async (id: string) => {
    await (supabase.from('automations' as any).delete().eq('id', id) as any);
    toast({ title: 'Automatización eliminada' });
    fetchData();
  };

  const toggleStatus = async (a: any) => {
    const newStatus = a.status === 'active' ? 'paused' : 'active';
    await (supabase.from('automations' as any).update({ status: newStatus }).eq('id', a.id) as any);
    toast({ title: newStatus === 'active' ? 'Automatización activada' : 'Automatización pausada' });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automatizaciones</h1>
          <p className="text-muted-foreground">Workflows automatizados con triggers, condiciones y acciones</p>
        </div>
        <Button onClick={() => navigate('/automatizaciones/nueva')}>
          <Plus className="h-4 w-4 mr-2" />Nueva Automatización
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ejecuciones</TableHead>
                <TableHead>Última ejecución</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No hay automatizaciones</TableCell></TableRow>
              ) : automations.map((a: any) => {
                const st = statusMap[a.status] || statusMap.draft;
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{a.name}</p>
                        {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        <span className="text-sm">{a.trigger_type}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge className={st.color} variant="secondary">{st.label}</Badge></TableCell>
                    <TableCell>{a.run_count}</TableCell>
                    <TableCell>{a.last_run_at ? new Date(a.last_run_at).toLocaleString('es-ES') : '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => toggleStatus(a)} title={a.status === 'active' ? 'Pausar' : 'Activar'}>
                          {a.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 text-success" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/automatizaciones/${a.id}`)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
