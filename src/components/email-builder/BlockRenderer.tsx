import { useRef, useEffect } from 'react';
import { EmailBlock, BlockType, defaultBlockProps } from './types';
import { GripVertical, Trash2, Copy, Plus } from 'lucide-react';

interface BlockRendererProps {
  block: EmailBlock;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdateProps: (props: Record<string, any>) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onAddChildBlock?: (columnIndex: number, type: BlockType) => void;
  onUpdateChildProps?: (columnIndex: number, childId: string, props: Record<string, any>) => void;
  onDeleteChild?: (columnIndex: number, childId: string) => void;
  onSelectChild?: (childId: string) => void;
  selectedChildId?: string | null;
}

export function BlockRenderer({
  block, selected, onSelect, onDelete, onDuplicate, onUpdateProps,
  onDragStart, onDragOver, onDrop,
  onAddChildBlock, onUpdateChildProps, onDeleteChild, onSelectChild, selectedChildId,
}: BlockRendererProps) {
  const p = block.props;

  const renderContent = () => {
    switch (block.type) {
      case 'heading':
        return <InlineEditable
          html={p.content}
          onChange={(val) => onUpdateProps({ ...p, content: val })}
          style={{ textAlign: p.align, padding: `${p.padding}px`, color: p.color, fontSize: `${p.fontSize}px`, fontWeight: 700, outline: 'none', minHeight: '1em' }}
          tag="div"
        />;
      case 'text':
        return <InlineEditable
          html={p.content}
          onChange={(val) => onUpdateProps({ ...p, content: val })}
          style={{ textAlign: p.align, padding: `${p.padding}px`, color: p.color, fontSize: `${p.fontSize}px`, lineHeight: 1.6, outline: 'none', minHeight: '1em' }}
          tag="div"
        />;
      case 'image':
        return (
          <div style={{ textAlign: p.align as any, padding: `${p.padding}px` }}>
            {p.src ? (
              <img src={p.src} alt={p.alt} style={{ maxWidth: `${p.width}%`, height: 'auto', display: 'inline-block' }} />
            ) : (
              <div className="flex items-center justify-center bg-muted rounded-lg h-32 text-muted-foreground text-sm">
                📷 Selecciona este bloque y agrega URL en propiedades →
              </div>
            )}
          </div>
        );
      case 'button':
        return (
          <div style={{ textAlign: p.align as any, padding: `${p.padding}px` }}>
            <span
              style={{
                display: 'inline-block', backgroundColor: p.bgColor, color: p.textColor,
                padding: '12px 28px', borderRadius: `${p.borderRadius}px`,
                fontWeight: 600, fontSize: `${p.fontSize}px`, cursor: 'default',
              }}
            >
              {p.text}
            </span>
          </div>
        );
      case 'divider':
        return (
          <div style={{ padding: `${p.padding}px` }}>
            <hr style={{ borderColor: p.color, borderTopWidth: `${p.thickness}px`, borderStyle: 'solid' }} />
          </div>
        );
      case 'spacer':
        return <div style={{ height: `${p.height}px` }} className="bg-muted/30 flex items-center justify-center text-[10px] text-muted-foreground">↕ {p.height}px</div>;
      case 'columns':
        return <ColumnsRenderer
          block={block}
          onAddChildBlock={onAddChildBlock}
          onUpdateChildProps={onUpdateChildProps}
          onDeleteChild={onDeleteChild}
          onSelectChild={onSelectChild}
          selectedChildId={selectedChildId}
        />;
      case 'social':
        return (
          <div style={{ textAlign: p.align as any, padding: `${p.padding}px` }}>
            <div style={{ display: 'flex', gap: '8px', justifyContent: p.align === 'left' ? 'flex-start' : p.align === 'right' ? 'flex-end' : 'center' }}>
              {(p.networks || []).map((n: string) => (
                <div key={n} style={{ width: `${p.iconSize}px`, height: `${p.iconSize}px`, borderRadius: '50%', background: '#CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' as const }}>
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
      className={`group relative border-2 rounded-lg transition-all ${
        selected ? 'border-primary shadow-md' : 'border-transparent hover:border-primary/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', ''); onDragStart(); }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Toolbar */}
      <div className={`absolute -top-3 right-2 z-10 flex gap-1 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <span className="p-1 rounded bg-card border shadow-sm cursor-grab active:cursor-grabbing">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
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

/* ---- Inline editable div for text/heading ---- */
function InlineEditable({ html, onChange, style, tag }: { html: string; onChange: (val: string) => void; style: React.CSSProperties; tag: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastHtml = useRef(html);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html;
    }
    lastHtml.current = html;
  }, [html]);

  const handleInput = () => {
    if (ref.current) {
      const newHtml = ref.current.innerHTML;
      if (newHtml !== lastHtml.current) {
        lastHtml.current = newHtml;
        onChange(newHtml);
      }
    }
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onBlur={handleInput}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ---- Columns with nested blocks ---- */
function ColumnsRenderer({
  block, onAddChildBlock, onUpdateChildProps, onDeleteChild, onSelectChild, selectedChildId,
}: {
  block: EmailBlock;
  onAddChildBlock?: (colIdx: number, type: BlockType) => void;
  onUpdateChildProps?: (colIdx: number, childId: string, props: Record<string, any>) => void;
  onDeleteChild?: (colIdx: number, childId: string) => void;
  onSelectChild?: (childId: string) => void;
  selectedChildId?: string | null;
}) {
  const p = block.props;
  const children: EmailBlock[][] = p.children || Array.from({ length: p.columns }, () => []);

  const handleColDrop = (colIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const type = e.dataTransfer.getData('block-type') as BlockType;
    if (type && type !== 'columns' && onAddChildBlock) {
      onAddChildBlock(colIdx, type);
    }
  };

  return (
    <div style={{ display: 'flex', gap: `${p.gap}px`, padding: `${p.padding}px` }}>
      {Array.from({ length: p.columns }).map((_, colIdx) => {
        const colBlocks: EmailBlock[] = children[colIdx] || [];
        return (
          <div
            key={colIdx}
            className="flex-1 min-h-[80px] border border-dashed border-border rounded-md p-2 transition-colors hover:border-primary/40 hover:bg-primary/5"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => handleColDrop(colIdx, e)}
          >
            {colBlocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[10px] text-muted-foreground gap-1 py-4">
                <Plus className="h-4 w-4" />
                <span>Arrastra bloque aquí</span>
              </div>
            ) : (
              <div className="space-y-1">
                {colBlocks.map((child) => (
                  <ChildBlockRenderer
                    key={child.id}
                    block={child}
                    selected={selectedChildId === child.id}
                    onSelect={() => onSelectChild?.(child.id)}
                    onDelete={() => onDeleteChild?.(colIdx, child.id)}
                    onUpdateProps={(props) => onUpdateChildProps?.(colIdx, child.id, props)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---- Simple child block inside columns ---- */
function ChildBlockRenderer({ block, selected, onSelect, onDelete, onUpdateProps }: {
  block: EmailBlock; selected: boolean; onSelect: () => void; onDelete: () => void; onUpdateProps: (props: Record<string, any>) => void;
}) {
  const p = block.props;

  const renderContent = () => {
    switch (block.type) {
      case 'heading':
        return <InlineEditable html={p.content} onChange={(v) => onUpdateProps({ ...p, content: v })} style={{ fontSize: `${p.fontSize}px`, fontWeight: 700, color: p.color, textAlign: p.align, padding: `${p.padding}px`, outline: 'none', minHeight: '1em' }} tag="div" />;
      case 'text':
        return <InlineEditable html={p.content} onChange={(v) => onUpdateProps({ ...p, content: v })} style={{ fontSize: `${p.fontSize}px`, color: p.color, textAlign: p.align, lineHeight: 1.6, padding: `${p.padding}px`, outline: 'none', minHeight: '1em' }} tag="div" />;
      case 'image':
        return p.src ? <img src={p.src} alt={p.alt} style={{ maxWidth: `${p.width}%` }} /> : <div className="h-16 bg-muted rounded flex items-center justify-center text-[10px] text-muted-foreground">📷 Imagen</div>;
      case 'button':
        return <div style={{ textAlign: p.align as any }}><span style={{ display: 'inline-block', backgroundColor: p.bgColor, color: p.textColor, padding: '8px 16px', borderRadius: `${p.borderRadius}px`, fontSize: `${Math.max(parseInt(p.fontSize) - 2, 10)}px`, fontWeight: 600 }}>{p.text}</span></div>;
      case 'divider':
        return <hr style={{ borderColor: p.color, borderTopWidth: `${p.thickness}px`, borderStyle: 'solid' }} />;
      case 'spacer':
        return <div style={{ height: `${p.height}px` }} />;
      case 'social':
        return <div style={{ textAlign: p.align as any, display: 'flex', gap: '4px', justifyContent: 'center' }}>{(p.networks || []).map((n: string) => <div key={n} style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#CBD5E1', fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{n[0].toUpperCase()}</div>)}</div>;
      default:
        return null;
    }
  };

  return (
    <div
      className={`relative border rounded transition-all cursor-pointer ${selected ? 'border-primary' : 'border-transparent hover:border-primary/30'}`}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {selected && (
        <button className="absolute -top-2 -right-2 z-10 p-0.5 rounded-full bg-destructive text-destructive-foreground shadow" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      {renderContent()}
    </div>
  );
}
