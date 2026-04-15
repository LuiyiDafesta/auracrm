import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const short = id.slice(0, 8);

  const copy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground gap-1" onClick={copy}>
          {short}…
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="font-mono text-xs">{id}</TooltipContent>
    </Tooltip>
  );
}
