import { Type, Image, MousePointerClick, Minus, ArrowUpDown, Columns, Heading, Share2 } from 'lucide-react';
import { BlockType } from './types';

const blocks: { type: BlockType; label: string; icon: React.ReactNode }[] = [
  { type: 'heading', label: 'Título', icon: <Heading className="h-5 w-5" /> },
  { type: 'text', label: 'Texto', icon: <Type className="h-5 w-5" /> },
  { type: 'image', label: 'Imagen', icon: <Image className="h-5 w-5" /> },
  { type: 'button', label: 'Botón', icon: <MousePointerClick className="h-5 w-5" /> },
  { type: 'divider', label: 'Divisor', icon: <Minus className="h-5 w-5" /> },
  { type: 'spacer', label: 'Espaciador', icon: <ArrowUpDown className="h-5 w-5" /> },
  { type: 'columns', label: 'Columnas', icon: <Columns className="h-5 w-5" /> },
  { type: 'social', label: 'Redes', icon: <Share2 className="h-5 w-5" /> },
];

interface BlockToolbarProps {
  onAddBlock: (type: BlockType) => void;
}

export function BlockToolbar({ onAddBlock }: BlockToolbarProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Bloques</h3>
      <div className="grid grid-cols-2 gap-2">
        {blocks.map((b) => (
          <button
            key={b.type}
            onClick={() => onAddBlock(b.type)}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('block-type', b.type)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/30 transition-all cursor-grab active:cursor-grabbing text-xs font-medium"
          >
            {b.icon}
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
