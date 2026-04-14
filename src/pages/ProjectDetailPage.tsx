import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Users, Megaphone, TrendingUp, CheckSquare, X, DollarSign } from 'lucide-react';

interface Project { id: string; name: string; description: string | null; client_name: string | null; status: string; color: string; }

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  // All available for linking
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
  const [allOpportunities, setAllOpportunities] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);

  // Link dialogs
  const [linkType, setLinkType] = useState<'contacts' | 'campaigns' | 'opportunities' | 'tasks' | null>(null);
  const [linkId, setLinkId] = useState('');

  const fetchData = async () => {
    if (!user || !id) return;
    const { data: p } = await supabase.from('projects').select('*').eq('id', id).single();
    setProject(p as any);

    const [pc, pca, po, pt] = await Promise.all([
      supabase.from('project_contacts').select('contact_id').eq('project_id', id),
      supabase.from('project_campaigns').select('campaign_id').eq('project_id', id),
      supabase.from('project_opportunities').select('opportunity_id').eq('project_id', id),
      supabase.from('project_tasks').select('task_id').eq('project_id', id),
    ]);

    const contactIds = ((pc.data || []) as any[]).map(r => r.contact_id);
    const campaignIds = ((pca.data || []) as any[]).map(r => r.campaign_id);
    const oppIds = ((po.data || []) as any[]).map(r => r.opportunity_id);
    const taskIds = ((pt.data || []) as any[]).map(r => r.task_id);

    const [cAll, caAll, oAll, tAll] = await Promise.all([
      supabase.from('contacts').select('id, first_name, last_name, email, status'),
      supabase.from('campaigns').select('id, name, status'),
      supabase.from('opportunities').select('id, name, value, stage'),
      supabase.from('tasks').select('id, title, status, priority'),
    ]);

    setAllContacts(cAll.data || []);
    setAllCampaigns(caAll.data || []);
    setAllOpportunities(oAll.data || []);
    setAllTasks(tAll.data || []);

    setContacts((cAll.data || []).filter((c: any) => contactIds.includes(c.id)));
    setCampaigns((caAll.data || []).filter((c: any) => campaignIds.includes(c.id)));
    setOpportunities((oAll.data || []).filter((o: any) => oppIds.includes(o.id)));
    setTasks((tAll.data || []).filter((t: any) => taskIds.includes(t.id)));
  };

  useEffect(() => { fetchData(); }, [user, id]);

  const linkEntity = async () => {
    if (!linkType || !linkId || !id) return;
    const table = linkType === 'contacts' ? 'project_contacts'
      : linkType === 'campaigns' ? 'project_campaigns'
      : linkType === 'opportunities' ? 'project_opportunities'
      : 'project_tasks';
    const fk = linkType === 'contacts' ? 'contact_id'
      : linkType === 'campaigns' ? 'campaign_id'
      : linkType === 'opportunities' ? 'opportunity_id'
      : 'task_id';
    const { error } = await supabase.from(table).insert({ project_id: id, [fk]: linkId } as any);
    if (error) {
      toast({ title: 'Error', description: error.message.includes('duplicate') ? 'Ya está vinculado' : error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Vinculado correctamente' });
    }
    setLinkType(null); setLinkId('');
    fetchData();
  };

  const unlinkEntity = async (type: string, entityId: string) => {
    if (!id) return;
    const table = type === 'contacts' ? 'project_contacts'
      : type === 'campaigns' ? 'project_campaigns'
      : type === 'opportunities' ? 'project_opportunities'
      : 'project_tasks';
    const fk = type === 'contacts' ? 'contact_id'
      : type === 'campaigns' ? 'campaign_id'
      : type === 'opportunities' ? 'opportunity_id'
      : 'task_id';
    await supabase.from(table).delete().eq('project_id', id).eq(fk as any, entityId);
    toast({ title: 'Desvinculado' });
    fetchData();
  };

  const getAvailable = () => {
    if (linkType === 'contacts') return allContacts.filter(c => !contacts.some(x => x.id === c.id)).map(c => ({ id: c.id, label: `${c.first_name} ${c.last_name || ''} (${c.email})` }));
    if (linkType === 'campaigns') return allCampaigns.filter(c => !campaigns.some(x => x.id === c.id)).map(c => ({ id: c.id, label: c.name }));
    if (linkType === 'opportunities') return allOpportunities.filter(o => !opportunities.some(x => x.id === o.id)).map(o => ({ id: o.id, label: o.name }));
    if (linkType === 'tasks') return allTasks.filter(t => !tasks.some(x => x.id === t.id)).map(t => ({ id: t.id, label: t.title }));
    return [];
  };

  const totalValue = opportunities.reduce((s, o) => s + (Number(o.value) || 0), 0);

  if (!project) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/proyectos')}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <Badge variant={project.status === 'activo' ? 'default' : 'secondary'}>{project.status}</Badge>
          </div>
          {project.client_name && <p className="text-muted-foreground ml-6">Cliente: {project.client_name}</p>}
          {project.description && <p className="text-sm text-muted-foreground ml-6 mt-1">{project.description}</p>}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10"><Users className="h-5 w-5 text-blue-500" /></div>
          <div><p className="text-2xl font-bold">{contacts.length}</p><p className="text-xs text-muted-foreground">Contactos</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10"><Megaphone className="h-5 w-5 text-purple-500" /></div>
          <div><p className="text-2xl font-bold">{campaigns.length}</p><p className="text-xs text-muted-foreground">Campañas</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10"><DollarSign className="h-5 w-5 text-green-500" /></div>
          <div><p className="text-2xl font-bold">${totalValue.toLocaleString()}</p><p className="text-xs text-muted-foreground">{opportunities.length} Oportunidades</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10"><CheckSquare className="h-5 w-5 text-orange-500" /></div>
          <div><p className="text-2xl font-bold">{tasks.length}</p><p className="text-xs text-muted-foreground">Tareas</p></div>
        </CardContent></Card>
      </div>

      {/* Link dialog */}
      <Dialog open={!!linkType} onOpenChange={(v) => { if (!v) { setLinkType(null); setLinkId(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Vincular {linkType === 'contacts' ? 'contacto' : linkType === 'campaigns' ? 'campaña' : linkType === 'opportunities' ? 'oportunidad' : 'tarea'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={linkId} onValueChange={setLinkId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {getAvailable().map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={linkEntity} className="w-full" disabled={!linkId}>Vincular</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contacts section */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Contactos</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setLinkType('contacts')}><Plus className="h-4 w-4 mr-1" />Vincular</Button>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Sin contactos vinculados</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Email</TableHead><TableHead>Estado</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
              <TableBody>
                {contacts.map(c => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/contactos/${c.id}`)}>
                    <TableCell className="font-medium">{c.first_name} {c.last_name}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => unlinkEntity('contacts', c.id)}><X className="h-3.5 w-3.5 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Campaigns section */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4" />Campañas</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setLinkType('campaigns')}><Plus className="h-4 w-4 mr-1" />Vincular</Button>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Sin campañas vinculadas</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Estado</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
              <TableBody>
                {campaigns.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => unlinkEntity('campaigns', c.id)}><X className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Opportunities section */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Oportunidades</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setLinkType('opportunities')}><Plus className="h-4 w-4 mr-1" />Vincular</Button>
        </CardHeader>
        <CardContent>
          {opportunities.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Sin oportunidades vinculadas</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Valor</TableHead><TableHead>Etapa</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
              <TableBody>
                {opportunities.map(o => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell>${Number(o.value || 0).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="secondary">{o.stage}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => unlinkEntity('opportunities', o.id)}><X className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tasks section */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><CheckSquare className="h-4 w-4" />Tareas</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setLinkType('tasks')}><Plus className="h-4 w-4 mr-1" />Vincular</Button>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Sin tareas vinculadas</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Estado</TableHead><TableHead>Prioridad</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
              <TableBody>
                {tasks.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell><Badge variant="secondary">{t.status}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{t.priority}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => unlinkEntity('tasks', t.id)}><X className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
