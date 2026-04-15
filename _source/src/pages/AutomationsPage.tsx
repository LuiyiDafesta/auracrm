import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Play, Pause, Zap, Activity, Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TRIGGER_TYPES } from '@/components/automations/types';

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-muted text-muted-foreground' },
  active: { label: 'Activa', color: 'bg-success/10 text-success' },
  paused: { label: 'Pausada', color: 'bg-warning/10 text-warning' },
};

const runStatusMap: Record<string, { label: string; icon: any; color: string }> = {
  running: { label: 'Ejecutando', icon: Loader2, color: 'text-blue-500' },
  waiting: { label: 'En espera', icon: Clock, color: 'text-amber-500' },
  completed: { label: 'Completada', icon: CheckCircle, color: 'text-green-500' },
  failed: { label: 'Fallida', icon: XCircle, color: 'text-red-500' },
  cancelled: { label: 'Cancelada', icon: AlertTriangle, color: 'text-muted-foreground' },
};

export default function AutomationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [automations, setAutomations] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, running: 0, waiting: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalRuns, setTotalRuns] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchAutomations = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase.from('automations' as any).select('*').order('created_at', { ascending: false }) as any);
    setAutomations(data || []);
  }, [user]);

  const fetchRuns = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch stats (counts by status)
    const [totalRes, runningRes, waitingRes, completedRes, failedRes] = await Promise.all([
      supabase.from('automation_runs' as any).select('id', { count: 'exact', head: true }) as any,
      supabase.from('automation_runs' as any).select('id', { count: 'exact', head: true }).eq('status', 'running') as any,
      supabase.from('automation_runs' as any).select('id', { count: 'exact', head: true }).eq('status', 'waiting') as any,
      supabase.from('automation_runs' as any).select('id', { count: 'exact', head: true }).eq('status', 'completed') as any,
      supabase.from('automation_runs' as any).select('id', { count: 'exact', head: true }).eq('status', 'failed') as any,
    ]);
    setStats({
      total: totalRes.count || 0,
      running: runningRes.count || 0,
      waiting: waitingRes.count || 0,
      completed: completedRes.count || 0,
      failed: failedRes.count || 0,
    });

    // Fetch paginated runs
    const from = page * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from('automation_runs' as any)
      .select('*, automations(name, trigger_type), contacts(first_name, last_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to) as any;
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    const { data, count } = await query;
    setRuns(data || []);
    setTotalRuns(count || 0);
    setLoading(false);
  }, [user, page, pageSize, statusFilter]);

  const fetchLogs = useCallback(async (runId: string) => {
    setSelectedRunId(runId);
    const { data } = await (supabase
      .from('automation_run_logs' as any)
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true }) as any);
    setLogs(data || []);
  }, []);

  useEffect(() => { fetchAutomations(); fetchRuns(); }, [fetchAutomations, fetchRuns]);

  // Auto-refresh runs every 15s
  useEffect(() => {
    const interval = setInterval(fetchRuns, 15000);
    return () => clearInterval(interval);
  }, [fetchRuns]);

  const handleDelete = async (id: string) => {
    await (supabase.from('automations' as any).delete().eq('id', id) as any);
    toast({ title: 'Automatización eliminada' });
    fetchAutomations();
  };

  const toggleStatus = async (a: any) => {
    const newStatus = a.status === 'active' ? 'paused' : 'active';
    await (supabase.from('automations' as any).update({ status: newStatus }).eq('id', a.id) as any);
    toast({ title: newStatus === 'active' ? 'Automatización activada' : 'Automatización pausada' });
    fetchAutomations();
  };

  const cancelRun = async (runId: string) => {
    await (supabase.from('automation_runs' as any).update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq('id', runId) as any);
    toast({ title: 'Ejecución cancelada' });
    fetchRuns();
  };

  const getTriggerLabel = (type: string) => {
    const t = TRIGGER_TYPES.find(t => t.value === type);
    return t ? `${t.icon} ${t.label}` : type;
  };

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'hace unos segundos';
    if (diff < 3600000) return `hace ${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)}h`;
    return `hace ${Math.floor(diff / 86400000)}d`;
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

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">
            <Zap className="h-4 w-4 mr-1" />Automatizaciones
          </TabsTrigger>
          <TabsTrigger value="monitor">
            <Activity className="h-4 w-4 mr-1" />Monitor de ejecuciones
            {stats.running + stats.waiting > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] bg-blue-500/10 text-blue-500">
                {stats.running + stats.waiting}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* LIST TAB */}
        <TabsContent value="list" className="mt-4">
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
                          <span className="text-sm">{getTriggerLabel(a.trigger_type)}</span>
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
        </TabsContent>

        {/* MONITOR TAB */}
        <TabsContent value="monitor" className="mt-4 space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total ejecuciones</p>
              </CardContent>
            </Card>
            <Card className="border-blue-500/30">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-500">{stats.running}</p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />Ejecutando
                </p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/30">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-500">{stats.waiting}</p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />En cola / espera
                </p>
              </CardContent>
            </Card>
            <Card className="border-green-500/30">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3" />Completadas
                </p>
              </CardContent>
            </Card>
            <Card className="border-red-500/30">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <XCircle className="h-3 w-3" />Fallidas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Runs Table */}
          <div className="flex gap-4">
            <Card className="flex-1">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-sm">Ejecuciones</CardTitle>
                    <select
                      className="text-xs border rounded px-2 py-1 bg-background"
                      value={statusFilter}
                      onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
                    >
                      <option value="all">Todos</option>
                      <option value="running">Ejecutando</option>
                      <option value="waiting">En espera</option>
                      <option value="completed">Completados</option>
                      <option value="failed">Fallidos</option>
                    </select>
                  </div>
                  <Button variant="ghost" size="sm" onClick={fetchRuns} disabled={loading}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />Actualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Automatización</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Inicio</TableHead>
                      <TableHead>Duración</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p>Sin ejecuciones aún</p>
                          <p className="text-xs">Las ejecuciones aparecerán aquí cuando se disparen los triggers</p>
                        </TableCell>
                      </TableRow>
                    ) : runs.map((r: any) => {
                      const rs = runStatusMap[r.status] || runStatusMap.running;
                      const Icon = rs.icon;
                      const contact = r.contacts;
                      const contactName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email : '—';
                      const duration = r.completed_at
                        ? `${Math.round((new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000)}s`
                        : r.status === 'waiting' ? `espera hasta ${new Date(r.wait_until).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : '...';
                      return (
                        <TableRow
                          key={r.id}
                          className={`cursor-pointer transition-colors ${selectedRunId === r.id ? 'bg-accent' : 'hover:bg-muted/50'}`}
                          onClick={() => fetchLogs(r.id)}
                        >
                          <TableCell>
                            <p className="font-medium text-sm">{(r as any).automations?.name || '—'}</p>
                            <p className="text-[10px] text-muted-foreground">{(r as any).automations?.trigger_type}</p>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="text-sm">{contactName}</span>
                                </TooltipTrigger>
                                <TooltipContent><p>{contact?.email}</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`${rs.color} gap-1`}>
                              <Icon className={`h-3 w-3 ${r.status === 'running' ? 'animate-spin' : ''}`} />
                              {rs.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{relativeTime(r.started_at)}</TableCell>
                          <TableCell className="text-xs">{duration}</TableCell>
                          <TableCell>
                            {(r.status === 'running' || r.status === 'waiting') && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); cancelRun(r.id); }}>
                                <XCircle className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Mostrando {runs.length} de {totalRuns}</span>
                    <span>·</span>
                    <select
                      className="border rounded px-2 py-1 bg-background text-xs"
                      value={pageSize}
                      onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
                    >
                      <option value={10}>10 por pág</option>
                      <option value={25}>25 por pág</option>
                      <option value={50}>50 por pág</option>
                      <option value={100}>100 por pág</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="text-xs h-7 px-2">
                      ← Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground px-2">
                      Pág {page + 1} / {Math.max(1, Math.ceil(totalRuns / pageSize))}
                    </span>
                    <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= totalRuns} onClick={() => setPage(p => p + 1)} className="text-xs h-7 px-2">
                      Siguiente →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Log Detail Panel */}
            {selectedRunId && (
              <Card className="w-80 shrink-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Detalle de pasos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {logs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Sin registros de pasos</p>
                  ) : logs.map((log: any, i: number) => (
                    <div key={log.id} className="relative pl-5 pb-3">
                      {/* Timeline line */}
                      {i < logs.length - 1 && <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border" />}
                      {/* Timeline dot */}
                      <div className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 ${log.error_message ? 'bg-red-500 border-red-500' : 'bg-green-500 border-green-500'}`} />
                      <div>
                        <p className="text-xs font-medium">{log.action}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleTimeString('es-ES')}</p>
                        {log.error_message && (
                          <p className="text-[10px] text-red-500 mt-0.5">❌ {log.error_message}</p>
                        )}
                        {log.result && Object.keys(log.result).length > 0 && (
                          <pre className="text-[10px] text-muted-foreground bg-muted rounded p-1 mt-1 overflow-x-auto max-w-full">
                            {JSON.stringify(log.result, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
