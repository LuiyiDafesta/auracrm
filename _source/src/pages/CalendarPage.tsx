import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchTasks = async () => {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();
      const { data } = await supabase.from('tasks').select('*').gte('due_date', start).lte('due_date', end);
      setTasks(data || []);
    };
    fetchTasks();
  }, [user, currentDate]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  const getTasksForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.filter(t => t.due_date && t.due_date.startsWith(dateStr));
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Calendario</h1>
        <p className="text-muted-foreground">Vista mensual de tus tareas</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <CardTitle className="capitalize">{monthName}</CardTitle>
            <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
              <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-card p-2 min-h-[80px]" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayTasks = getTasksForDay(day);
              const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
              return (
                <div key={day} className={`bg-card p-2 min-h-[80px] ${isToday ? 'ring-2 ring-primary ring-inset' : ''}`}>
                  <span className={`text-sm ${isToday ? 'font-bold text-primary' : 'text-foreground'}`}>{day}</span>
                  <div className="mt-1 space-y-1">
                    {dayTasks.slice(0, 2).map(t => (
                      <div key={t.id} className="text-xs bg-primary/10 text-primary rounded px-1 py-0.5 truncate">{t.title}</div>
                    ))}
                    {dayTasks.length > 2 && <div className="text-xs text-muted-foreground">+{dayTasks.length - 2} más</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
