import { Mail, Send, Eye, MousePointerClick } from 'lucide-react';

interface CampaignData {
  name: string;
  totalSent: number;
  opens: number;
  clicks: number;
}

interface Props {
  campaigns: CampaignData[];
}

export function CampaignMetrics({ campaigns }: Props) {
  if (!campaigns.length) return <p className="text-sm text-muted-foreground">No hay campañas con envíos.</p>;

  return (
    <div className="space-y-3">
      {campaigns.map((c, i) => {
        const openRate = c.totalSent > 0 ? ((c.opens / c.totalSent) * 100).toFixed(1) : '0';
        const clickRate = c.totalSent > 0 ? ((c.clicks / c.totalSent) * 100).toFixed(1) : '0';
        return (
          <div key={i} className="rounded-lg border p-3">
            <div className="font-medium text-sm mb-2">{c.name}</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><Send className="h-4 w-4 mx-auto text-muted-foreground mb-1" /><div className="text-sm font-bold">{c.totalSent}</div><div className="text-[10px] text-muted-foreground">Enviados</div></div>
              <div><Eye className="h-4 w-4 mx-auto text-blue-500 mb-1" /><div className="text-sm font-bold">{c.opens}</div><div className="text-[10px] text-muted-foreground">{openRate}% abiertos</div></div>
              <div><MousePointerClick className="h-4 w-4 mx-auto text-green-500 mb-1" /><div className="text-sm font-bold">{c.clicks}</div><div className="text-[10px] text-muted-foreground">{clickRate}% clicks</div></div>
              <div><Mail className="h-4 w-4 mx-auto text-orange-500 mb-1" /><div className="text-sm font-bold">{c.totalSent - c.opens}</div><div className="text-[10px] text-muted-foreground">Sin abrir</div></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
