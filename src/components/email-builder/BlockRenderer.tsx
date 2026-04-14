import { EmailBlock } from './types';
import { GripVertical, Trash2, Copy } from 'lucide-react';

interface BlockRendererProps {
  block: EmailBlock;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

export function BlockRenderer({ block, selected, onSelect, onDelete, onDuplicate, onDragStart, onDragOver, onDrop }: BlockRendererProps) {
  const p = block.props;

  const renderContent = () => {
    switch (block.type) {
      case 'heading':
        return (
          <div style={{ textAlign: p.align, padding: `${p.padding}px`, color: p.color, fontSize: `${p.fontSize}px`, fontWeight: 700 }}>
            {p.content}
          </div>
        );
      case 'text':
        return (
          <div
            style={{ textAlign: p.align, padding: `${p.padding}px`, color: p.color, fontSize: `${p.fontSize}px`, lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: p.content }}
          />
        );
      case 'image':
        return (
          <div style={{ textAlign: p.align, padding: `${p.padding}px` }}>
            {p.src ? (
              <img src={p.src} alt={p.alt} style={{ maxWidth: `${p.width}%`, height: 'auto', display: 'inline-block' }} />
            ) : (
              <div className="flex items-center justify-center bg-muted rounded-lg h-32 text-muted-foreground text-sm">
                Arrastra o pega URL de imagen
              </div>
            )}
          </div>
        );
      case 'button':
        return (
          <div style={{ textAlign: p.align, padding: `${p.padding}px` }}>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{
                display: 'inline-block',
                backgroundColor: p.bgColor,
                color: p.textColor,
                padding: '12px 28px',
                borderRadius: `${p.borderRadius}px`,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: `${p.fontSize}px`,
              }}
            >
              {p.text}
            </a>
          </div>
        );
      case 'divider':
        return (
          <div style={{ padding: `${p.padding}px` }}>
            <hr style={{ borderColor: p.color, borderTopWidth: `${p.thickness}px` }} />
          </div>
        );
      case 'spacer':
        return <div style={{ height: `${p.height}px` }} />;
      case 'columns':
        return (
          <div style={{ display: 'flex', gap: `${p.gap}px`, padding: `${p.padding}px` }}>
            {Array.from({ length: p.columns }).map((_, i) => (
              <div key={i} className="flex-1 min-h-[60px] border border-dashed border-border rounded-md flex items-center justify-center text-xs text-muted-foreground">
                Columna {i + 1}
              </div>
            ))}
          </div>
        );
      case 'social':
        return (
          <div style={{ textAlign: p.align, padding: `${p.padding}px` }}>
            <div className="flex gap-3 justify-center">
              {(p.networks || []).map((n: string) => (
                <div key={n} className="w-8 h-8 rounded-full bg-muted-foreground/20 flex items-center justify-center text-xs font-bold uppercase">
                  {n[0]}
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return <div className="p-4 text-muted-foreground">Bloque desconocido</div>;
    }
  };

  return (
    <div
      className={`group relative border-2 rounded-lg transition-all cursor-pointer ${
        selected ? 'border-primary shadow-md' : 'border-transparent hover:border-primary/30'
      }`}
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Toolbar */}
      <div className={`absolute -top-3 right-2 flex gap-1 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button className="p-1 rounded bg-card border shadow-sm hover:bg-accent cursor-grab" onMouseDown={(e) => e.stopPropagation()}>
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button className="p-1 rounded bg-card border shadow-sm hover:bg-accent" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button className="p-1 rounded bg-card border shadow-sm hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </button>
      </div>
      {renderContent()}
    </div>
  );
}
