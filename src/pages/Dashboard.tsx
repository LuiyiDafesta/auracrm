import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, CheckSquare, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ contacts: 0, opportunities: 0, tasks: 0, revenue: 0 });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const [contactsRes, oppsRes, tasksRes, revenueRes, activitiesRes] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase.from('opportunities').select('id', { count: 'exact', head: true }).not('stage', 'in', '(cerrado_ganado,cerrado_perdido)'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'pendiente'),
        supabase.from('opportunities').select('value').eq('stage', 'cerrado_ganado'),
        supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(5),
      ]);

      const totalRevenue = (revenueRes.data || []).reduce((sum, o) => sum + (Number(o.value) || 0), 0);

      setStats({
        contacts: contactsRes.count || 0,
        opportunities: oppsRes.count || 0,
        tasks: tasksRes.count || 0,
        revenue: totalRevenue,
      });
      setRecentActivities(activitiesRes.data || []);
    };

    fetchStats();
  }, [user]);

  const cards = [
    { title: 'Contactos', value: stats.contacts, icon: Users, color: 'text-primary' },
    { title: 'Oportunidades Activas', value: stats.opportunities, icon: TrendingUp, color: 'text-success' },
    { title: 'Tareas Pendientes', value: stats.tasks, icon: CheckSquare, color: 'text-warning' },
    { title: 'Ingresos', value: `$${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Resumen general de tu CRM</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay actividad reciente. Comienza agregando contactos y oportunidades.</p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 text-sm">
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  <span className="text-muted-foreground">{activity.type}:</span>
                  <span>{activity.description}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(activity.created_at).toLocaleDateString('es-ES')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
