import { EmailBlock, VARIABLE_LIST, CanvasSettings } from './types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';

interface PropertiesPanelProps {
  block: EmailBlock | null;
  onUpdate: (id: string, props: Record<string, any>) => void;
  canvasSelected?: boolean;
  canvasSettings?: CanvasSettings;
  onUpdateCanvas?: (settings: CanvasSettings) => void;
  customFieldVars?: { label: string; value: string }[];
}

export function PropertiesPanel({ block, onUpdate, canvasSelected, canvasSettings, onUpdateCanvas, customFieldVars = [] }: PropertiesPanelProps) {
  if (!block && canvasSelected && canvasSettings && onUpdateCanvas) {
    return (
      <div className="space-y-4 p-1">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Lienzo</h3>
        <div className="space-y-1">
          <Label className="text-xs">Color de fondo exterior</Label>
          <div className="flex gap-2">
            <input type="color" value={canvasSettings.bgColor} onChange={(e) => onUpdateCanvas({ ...canvasSettings, bgColor: e.target.value })} className="w-8 h-8 rounded border cursor-pointer" />
            <Input className="h-8 text-xs flex-1" value={canvasSettings.bgColor} onChange={(e) => onUpdateCanvas({ ...canvasSettings, bgColor: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Color de fondo contenido</Label>
          <div className="flex gap-2">
            <input type="color" value={canvasSettings.contentBgColor} onChange={(e) => onUpdateCanvas({ ...canvasSettings, contentBgColor: e.target.value })} className="w-8 h-8 rounded border cursor-pointer" />
            <Input className="h-8 text-xs flex-1" value={canvasSettings.contentBgColor} onChange={(e) => onUpdateCanvas({ ...canvasSettings, contentBgColor: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Padding contenido ({canvasSettings.contentPadding}px)</Label>
          <Slider value={[parseInt(canvasSettings.contentPadding) || 0]} min={0} max={160} step={4} onValueChange={([v]) => onUpdateCanvas({ ...canvasSettings, contentPadding: String(v) })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Radio borde ({canvasSettings.contentBorderRadius}px)</Label>
          <Slider value={[parseInt(canvasSettings.contentBorderRadius)]} min={0} max={24} step={2} onValueChange={([v]) => onUpdateCanvas({ ...canvasSettings, contentBorderRadius: String(v) })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nota al pie (desuscripción/legales)</Label>
          <Textarea 
            className="text-xs min-h-[80px]" 
            value={canvasSettings.footerText || ''} 
            onChange={(e) => onUpdateCanvas({ ...canvasSettings, footerText: e.target.value })} 
            placeholder="Estás recibiendo este correo porque..." 
          />
        </div>
      </div>
    );
  }

  if (!block) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <p className="mt-8">Selecciona un bloque o el lienzo para editar sus propiedades</p>
      </div>
    );
  }

  const update = (key: string, value: any) => onUpdate(block.id, { ...block.props, [key]: value });
  const p = block.props;

  const renderAlignField = () => (
    <div className="space-y-1">
      <Label className="text-xs">Alineación</Label>
      <Select value={p.align || 'left'} onValueChange={(v) => update('align', v)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Izquierda</SelectItem>
          <SelectItem value="center">Centro</SelectItem>
          <SelectItem value="right">Derecha</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const renderPaddingField = () => (
    <div className="space-y-1">
      <Label className="text-xs">Padding ({p.padding}px)</Label>
      <Slider value={[parseInt(p.padding || '10')]} min={0} max={120} step={5} onValueChange={([v]) => update('padding', String(v))} />
    </div>
  );

  const renderColorField = (label: string, key: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <input type="color" value={p[key] || '#333333'} onChange={(e) => update(key, e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
        <Input className="h-8 text-xs flex-1" value={p[key] || ''} onChange={(e) => update(key, e.target.value)} />
      </div>
    </div>
  );

  const renderFontSize = () => (
    <div className="space-y-1">
      <Label className="text-xs">Tamaño fuente ({p.fontSize}px)</Label>
      <Slider value={[parseInt(p.fontSize || '16')]} min={10} max={48} step={1} onValueChange={([v]) => update('fontSize', String(v))} />
    </div>
  );

  return (
    <div className="space-y-4 p-1">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Propiedades</h3>
      
      {/* Variables */}
      <div className="space-y-1">
        <Label className="text-xs">Variables disponibles</Label>
        <p className="text-[10px] text-muted-foreground">Haz clic para insertar en el bloque seleccionado</p>
        <div className="flex flex-wrap gap-1">
          {VARIABLE_LIST.map((v) => (
            <Badge key={v.value} variant="outline" className="text-[10px] cursor-pointer hover:bg-accent active:scale-95 transition-transform" onClick={() => {
              if (block.type === 'text' || block.type === 'heading') {
                update('content', (p.content || '') + v.value);
              } else if (block.type === 'button') {
                update('text', (p.text || '') + v.value);
              } else {
                navigator.clipboard.writeText(v.value);
              }
            }}>
              {v.label}
            </Badge>
          ))}
        </div>
        {customFieldVars.length > 0 && (
          <>
            <Label className="text-xs mt-2">Campos personalizados</Label>
            <div className="flex flex-wrap gap-1">
              {customFieldVars.map((v) => (
                <Badge key={v.value} variant="secondary" className="text-[10px] cursor-pointer hover:bg-accent active:scale-95 transition-transform" onClick={() => {
                  if (block.type === 'text' || block.type === 'heading') {
                    update('content', (p.content || '') + v.value);
                  } else if (block.type === 'button') {
                    update('text', (p.text || '') + v.value);
                  } else {
                    navigator.clipboard.writeText(v.value);
                  }
                }}>
                  {v.label}
                </Badge>
              ))}
            </div>
          </>
        )}
      </div>

      {block.type === 'heading' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Contenido</Label>
            <Input className="h-8 text-xs" value={p.content} onChange={(e) => update('content', e.target.value)} />
          </div>
          {renderFontSize()}
          {renderColorField('Color', 'color')}
          {renderAlignField()}
          {renderPaddingField()}
        </>
      )}

      {block.type === 'text' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Contenido HTML</Label>
            <Textarea className="text-xs min-h-[100px]" value={p.content} onChange={(e) => update('content', e.target.value)} />
          </div>
          {renderFontSize()}
          {renderColorField('Color', 'color')}
          {renderAlignField()}
          {renderPaddingField()}
        </>
      )}

      {block.type === 'image' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">URL de imagen</Label>
            <Input className="h-8 text-xs" value={p.src} onChange={(e) => update('src', e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Texto alternativo</Label>
            <Input className="h-8 text-xs" value={p.alt} onChange={(e) => update('alt', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Enlace</Label>
            <Input className="h-8 text-xs" value={p.link} onChange={(e) => update('link', e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ancho ({p.width}%)</Label>
            <Slider value={[parseInt(p.width || '100')]} min={10} max={100} step={5} onValueChange={([v]) => update('width', String(v))} />
          </div>
          {renderAlignField()}
          {renderPaddingField()}
        </>
      )}

      {block.type === 'button' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Texto</Label>
            <Input className="h-8 text-xs" value={p.text} onChange={(e) => update('text', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Enlace</Label>
            <Input className="h-8 text-xs" value={p.link} onChange={(e) => update('link', e.target.value)} placeholder="https://..." />
          </div>
          {renderColorField('Color fondo', 'bgColor')}
          {renderColorField('Color texto', 'textColor')}
          {renderFontSize()}
          <div className="space-y-1">
            <Label className="text-xs">Radio borde ({p.borderRadius}px)</Label>
            <Slider value={[parseInt(p.borderRadius || '6')]} min={0} max={30} step={2} onValueChange={([v]) => update('borderRadius', String(v))} />
          </div>
          {renderAlignField()}
          {renderPaddingField()}
        </>
      )}

      {block.type === 'divider' && (
        <>
          {renderColorField('Color', 'color')}
          <div className="space-y-1">
            <Label className="text-xs">Grosor ({p.thickness}px)</Label>
            <Slider value={[parseInt(p.thickness || '1')]} min={1} max={5} step={1} onValueChange={([v]) => update('thickness', String(v))} />
          </div>
          {renderPaddingField()}
        </>
      )}

      {block.type === 'spacer' && (
        <div className="space-y-1">
          <Label className="text-xs">Altura ({p.height}px)</Label>
          <Slider value={[parseInt(p.height || '30')]} min={10} max={100} step={5} onValueChange={([v]) => update('height', String(v))} />
        </div>
      )}

      {block.type === 'columns' && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Columnas</Label>
            <Select value={String(p.columns)} onValueChange={(v) => update('columns', parseInt(v))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 columnas</SelectItem>
                <SelectItem value="3">3 columnas</SelectItem>
                <SelectItem value="4">4 columnas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {renderPaddingField()}
        </>
      )}

      {block.type === 'social' && (
        <>
          {renderAlignField()}
          <div className="space-y-1">
            <Label className="text-xs">Tamaño ícono ({p.iconSize}px)</Label>
            <Slider value={[parseInt(p.iconSize || '32')]} min={20} max={48} step={4} onValueChange={([v]) => update('iconSize', String(v))} />
          </div>
          {renderPaddingField()}
        </>
      )}
    </div>
  );
}
