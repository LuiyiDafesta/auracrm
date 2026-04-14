import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, DollarSign, Target } from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  prospecto: 'Prospecto',
  calificado: 'Calificado',
  propuesta: 'Propuesta',
  negociacion: 'Negociación',
  cerrado_ganado: 'Cerrado Ganado',
  cerrado_perdido: 'Cerrado Perdido',
};

export default function Reports() {
  const { user } = useAuth();
  const [data, setData] = useState({ opportunities: [] as any[], contacts: 0, totalRevenue: 0, avgDealSize: 0, conversionRate: 0, pipelineByStage: {} as Record<string, { count: number; value: number }> });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [opps, contacts] = await Promise.all([
        supabase.from('opportunities').select('*'),
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
      ]);
      const allOpps = opps.data || [];
      const won = allOpps.filter(o => o.stage === 'cerrado_ganado');
      const lost = allOpps.filter(o => o.stage === 'cerrado_perdido');
      const totalRevenue = won.reduce((s, o) => s + (Number(o.value) || 0), 0);
      const avgDealSize = won.length > 0 ? totalRevenue / won.length : 0;
      const closed = won.length + lost.length;
      const conversionRate = closed > 0 ? (won.length / closed) * 100 : 0;

      const pipelineByStage: Record<string, { count: number; value: number }> = {};
      allOpps.forEach(o => {
        if (!pipelineByStage[o.stage]) pipelineByStage[o.stage] = { count: 0, value: 0 };
        pipelineByStage[o.stage].count++;
        pipelineByStage[o.stage].value += Number(o.value) || 0;
      });

      setData({ opportunities: allOpps, contacts: contacts.count || 0, totalRevenue, avgDealSize, conversionRate, pipelineByStage });
    };
    fetch();
  }, [user]);

  const summaryCards = [
    { title: 'Ingresos Totales', value: `$${data.totalRevenue.toLocaleString()}`, icon: DollarSign },
    { title: 'Tamaño Promedio', value: `$${Math.round(data.avgDealSize).toLocaleString()}`, icon: TrendingUp },
    { title: 'Tasa de Conversión', value: `${data.conversionRate.toFixed(1)}%`, icon: Target },
    { title: 'Total Contactos', value: data.contacts, icon: Users },
  ];

  const maxValue = Math.max(...Object.values(data.pipelineByStage).map(s => s.value), 1);

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Reportes</h1><p className="text-muted-foreground">Análisis y métricas de ventas</p></div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map(c => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Pipeline por Etapa</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(STAGE_LABELS).map(([key, label]) => {
              const stage = data.pipelineByStage[key];
              if (!stage) return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-sm"><span>{label}</span><span className="text-muted-foreground">0 · $0</span></div>
                  <div className="h-3 bg-muted rounded-full" />
                </div>
              );
              const pct = (stage.value / maxValue) * 100;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-sm"><span>{label}</span><span className="text-muted-foreground">{stage.count} · ${stage.value.toLocaleString()}</span></div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
