import { DollarSign, Users, Target, TrendingUp } from 'lucide-react';

interface Props {
  data: { totalRevenue: number; avgDealSize: number; conversionRate: number; totalContacts: number };
}

export function KpiCards({ data }: Props) {
  const items = [
    { label: 'Ingresos Totales', value: `$${data.totalRevenue.toLocaleString()}`, icon: DollarSign },
    { label: 'Tamaño Promedio', value: `$${Math.round(data.avgDealSize).toLocaleString()}`, icon: TrendingUp },
    { label: 'Tasa de Conversión', value: `${data.conversionRate.toFixed(1)}%`, icon: Target },
    { label: 'Total Contactos', value: data.totalContacts.toLocaleString(), icon: Users },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map(i => (
        <div key={i.label} className="rounded-lg border p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">{i.label}</span>
            <i.icon className="h-4 w-4 text-primary" />
          </div>
          <div className="text-xl font-bold">{i.value}</div>
        </div>
      ))}
    </div>
  );
}
