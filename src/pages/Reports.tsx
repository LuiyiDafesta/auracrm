import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Settings2, FileDown, Loader2, LayoutDashboard } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { ReportWidget } from '@/components/reports/ReportWidget';
import { KpiCards } from '@/components/reports/widgets/KpiCards';
import { PipelineChart } from '@/components/reports/widgets/PipelineChart';
import { CampaignMetrics } from '@/components/reports/widgets/CampaignMetrics';
import { ContactsByTag } from '@/components/reports/widgets/ContactsByTag';
import { ContactsBySegment } from '@/components/reports/widgets/ContactsBySegment';
import { CustomFieldsSummary } from '@/components/reports/widgets/CustomFieldsSummary';
import { TasksSummary } from '@/components/reports/widgets/TasksSummary';

type WidgetId = 'kpis' | 'pipeline' | 'campaigns' | 'tags' | 'segments' | 'custom_fields' | 'tasks';

const WIDGET_CATALOG: { id: WidgetId; label: string }[] = [
  { id: 'kpis', label: 'KPIs de Ventas' },
  { id: 'pipeline', label: 'Pipeline por Etapa' },
  { id: 'campaigns', label: 'Métricas de Campañas' },
  { id: 'tags', label: 'Contactos por Etiqueta' },
  { id: 'segments', label: 'Contactos por Segmento' },
  { id: 'custom_fields', label: 'Campos Personalizados' },
  { id: 'tasks', label: 'Resumen de Tareas' },
];

export default function Reports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Widget config
  const [activeWidgets, setActiveWidgets] = useState<WidgetId[]>(['kpis', 'pipeline', 'campaigns', 'tags', 'segments', 'custom_fields', 'tasks']);

  // Filters
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterSegment, setFilterSegment] = useState<string>('all');

  // Data
  const [data, setData] = useState<any>({
    kpis: { totalRevenue: 0, avgDealSize: 0, conversionRate: 0, totalContacts: 0 },
    pipelineByStage: {},
    campaigns: [],
    tags: [],
    segments: [],
    customFields: [],
    tasksByStatus: {},
    allTags: [],
    allSegments: [],
  });

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get filtered contact IDs if filtering
    let contactFilter: string[] | null = null;
    if (filterTag !== 'all') {
      const { data: ct } = await supabase.from('contact_tags').select('contact_id').eq('tag_id', filterTag);
      contactFilter = ct?.map(r => r.contact_id) || [];
    }
    if (filterSegment !== 'all') {
      const { data: sc } = await supabase.from('segment_contacts').select('contact_id').eq('segment_id', filterSegment);
      const segIds = sc?.map(r => r.contact_id) || [];
      contactFilter = contactFilter ? contactFilter.filter(id => segIds.includes(id)) : segIds;
    }

    const [oppsRes, contactsRes, tagsRes, segmentsRes, customFieldsRes, tasksRes, campaignsRes, campaignSendsRes, trackingRes, contactTagsRes, segContactsRes, customValuesRes] = await Promise.all([
      supabase.from('opportunities').select('*'),
      contactFilter ? supabase.from('contacts').select('*').in('id', contactFilter.length ? contactFilter : ['00000000-0000-0000-0000-000000000000']) : supabase.from('contacts').select('*'),
      supabase.from('tags').select('*'),
      supabase.from('segments').select('*'),
      supabase.from('custom_fields').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('campaigns').select('*'),
      supabase.from('campaign_sends').select('*'),
      supabase.from('email_tracking').select('*'),
      supabase.from('contact_tags').select('*'),
      supabase.from('segment_contacts').select('*'),
      supabase.from('contact_custom_values').select('*'),
    ]);

    const contacts = contactsRes.data || [];
    const contactIds = new Set(contacts.map(c => c.id));
    const allOpps = (oppsRes.data || []).filter(o => !contactFilter || (o.contact_id && contactIds.has(o.contact_id)) || !o.contact_id);
    const allTasks = (tasksRes.data || []).filter(t => !contactFilter || (t.contact_id && contactIds.has(t.contact_id)) || !t.contact_id);

    // KPIs
    const won = allOpps.filter(o => o.stage === 'cerrado_ganado');
    const lost = allOpps.filter(o => o.stage === 'cerrado_perdido');
    const totalRevenue = won.reduce((s, o) => s + (Number(o.value) || 0), 0);
    const avgDealSize = won.length > 0 ? totalRevenue / won.length : 0;
    const closed = won.length + lost.length;
    const conversionRate = closed > 0 ? (won.length / closed) * 100 : 0;

    // Pipeline
    const pipelineByStage: Record<string, { count: number; value: number }> = {};
    allOpps.forEach(o => {
      if (!pipelineByStage[o.stage]) pipelineByStage[o.stage] = { count: 0, value: 0 };
      pipelineByStage[o.stage].count++;
      pipelineByStage[o.stage].value += Number(o.value) || 0;
    });

    // Campaign metrics
    const allCampaigns = campaignsRes.data || [];
    const allSends = campaignSendsRes.data || [];
    const allTracking = trackingRes.data || [];
    const campaignMetrics = allCampaigns.map(c => {
      const sends = allSends.filter(s => s.campaign_id === c.id);
      const totalSent = sends.reduce((s, x) => s + x.sent_count, 0);
      const sendIds = new Set(sends.map(s => s.id));
      const tracking = allTracking.filter(t => sendIds.has(t.campaign_send_id));
      const opens = tracking.filter(t => t.event_type === 'open').length;
      const clicks = tracking.filter(t => t.event_type === 'click').length;
      return { name: c.name, totalSent, opens, clicks };
    }).filter(c => c.totalSent > 0);

    // Tags
    const allTagsData = tagsRes.data || [];
    const allContactTags = contactTagsRes.data || [];
    const tagCounts = allTagsData.map(tag => {
      const count = allContactTags.filter(ct => ct.tag_id === tag.id && (!contactFilter || contactIds.has(ct.contact_id))).length;
      return { name: tag.name, color: tag.color, count };
    }).filter(t => t.count > 0).sort((a, b) => b.count - a.count);

    // Segments
    const allSegmentsData = segmentsRes.data || [];
    const allSegContacts = segContactsRes.data || [];
    const segCounts = allSegmentsData.map(seg => {
      const count = allSegContacts.filter(sc => sc.segment_id === seg.id && (!contactFilter || contactIds.has(sc.contact_id))).length;
      return { name: seg.name, count };
    }).filter(s => s.count > 0).sort((a, b) => b.count - a.count);

    // Custom fields
    const allCustomFields = customFieldsRes.data || [];
    const allCustomValues = (customValuesRes.data || []).filter(v => !contactFilter || contactIds.has(v.contact_id));
    const fieldSummaries = allCustomFields.map(f => {
      const vals = allCustomValues.filter(v => v.custom_field_id === f.id && v.value);
      if (!vals.length) return null;
      if (f.field_type === 'number') {
        const nums = vals.map(v => Number(v.value)).filter(n => !isNaN(n));
        if (!nums.length) return null;
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const avg = nums.reduce((s, n) => s + n, 0) / nums.length;
        return { name: f.name, type: f.field_type, distribution: [{ value: 'Mín', count: min }, { value: 'Prom', count: Math.round(avg) }, { value: 'Máx', count: max }] };
      }
      const counts: Record<string, number> = {};
      vals.forEach(v => { counts[v.value!] = (counts[v.value!] || 0) + 1; });
      return { name: f.name, type: f.field_type, distribution: Object.entries(counts).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count) };
    }).filter(Boolean);

    // Tasks
    const tasksByStatus: Record<string, number> = {};
    allTasks.forEach(t => { tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1; });

    setData({
      kpis: { totalRevenue, avgDealSize, conversionRate, totalContacts: contacts.length },
      pipelineByStage,
      campaigns: campaignMetrics,
      tags: tagCounts,
      segments: segCounts,
      customFields: fieldSummaries,
      tasksByStatus,
      allTags: allTagsData,
      allSegments: allSegmentsData,
    });
    setLoading(false);
  }, [user, filterTag, filterSegment]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleWidget = (id: WidgetId) => {
    setActiveWidgets(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(activeWidgets);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setActiveWidgets(items);
  };

  const exportPdf = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      let y = margin;
      let remainingHeight = imgHeight;
      let sourceY = 0;

      while (remainingHeight > 0) {
        const sliceHeight = Math.min(remainingHeight, pageHeight - margin * 2);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = (sliceHeight / imgHeight) * canvas.height;
        const ctx = sliceCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);

        if (sourceY > 0) pdf.addPage();
        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, sliceHeight);

        sourceY += sliceCanvas.height;
        remainingHeight -= sliceHeight;
      }

      pdf.save(`Reporte_AuraCRM_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: 'PDF exportado correctamente' });
    } catch (e) {
      toast({ title: 'Error al exportar', variant: 'destructive' });
    }
    setExporting(false);
  };

  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case 'kpis': return <KpiCards data={data.kpis} />;
      case 'pipeline': return <PipelineChart pipelineByStage={data.pipelineByStage} />;
      case 'campaigns': return <CampaignMetrics campaigns={data.campaigns} />;
      case 'tags': return <ContactsByTag tags={data.tags} />;
      case 'segments': return <ContactsBySegment segments={data.segments} />;
      case 'custom_fields': return <CustomFieldsSummary fields={data.customFields} />;
      case 'tasks': return <TasksSummary byStatus={data.tasksByStatus} />;
    }
  };

  const getWidgetLabel = (id: WidgetId) => WIDGET_CATALOG.find(w => w.id === id)?.label || id;

  const activeFilters = (filterTag !== 'all' ? 1 : 0) + (filterSegment !== 'all' ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">Personaliza y exporta tus reportes</p>
        </div>
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4 mr-2" /> Personalizar
                {activeFilters > 0 && <Badge variant="secondary" className="ml-2">{activeFilters}</Badge>}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-80 overflow-y-auto">
              <SheetHeader><SheetTitle>Configurar Reporte</SheetTitle></SheetHeader>
              <div className="space-y-6 mt-4">
                {/* Filters */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Filtros</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Etiqueta</label>
                      <Select value={filterTag} onValueChange={setFilterTag}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {data.allTags.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Segmento</label>
                      <Select value={filterSegment} onValueChange={setFilterSegment}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {data.allSegments.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Widgets */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Widgets</h4>
                  <div className="space-y-2">
                    {WIDGET_CATALOG.map(w => (
                      <label key={w.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={activeWidgets.includes(w.id)} onCheckedChange={() => toggleWidget(w.id)} />
                        <span className="text-sm">{w.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Button size="sm" onClick={exportPdf} disabled={exporting || loading}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Active filter badges */}
      {activeFilters > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filtros activos:</span>
          {filterTag !== 'all' && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => setFilterTag('all')}>
              Etiqueta: {data.allTags.find((t: any) => t.id === filterTag)?.name} ✕
            </Badge>
          )}
          {filterSegment !== 'all' && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => setFilterSegment('all')}>
              Segmento: {data.allSegments.find((s: any) => s.id === filterSegment)?.name} ✕
            </Badge>
          )}
        </div>
      )}

      {/* Report content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : activeWidgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <LayoutDashboard className="h-12 w-12 mb-4" />
          <p>Selecciona widgets desde "Personalizar" para construir tu reporte</p>
        </div>
      ) : (
        <div ref={reportRef} className="space-y-4 bg-background p-4 rounded-lg">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="report-widgets">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                  {activeWidgets.map((wId, index) => (
                    <Draggable key={wId} draggableId={wId} index={index}>
                      {(prov) => (
                        <div ref={prov.innerRef} {...prov.draggableProps}>
                          <ReportWidget
                            title={getWidgetLabel(wId)}
                            onRemove={() => toggleWidget(wId)}
                            dragHandleProps={prov.dragHandleProps}
                          >
                            {renderWidget(wId)}
                          </ReportWidget>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      )}
    </div>
  );
}
