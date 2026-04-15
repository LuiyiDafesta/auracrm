import { useState, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  segments: { id: string; name: string }[];
  tags: { id: string; name: string; color: string }[];
  customFields: { id: string; name: string; field_type: string }[];
  onComplete: () => void;
}

type Step = 'upload' | 'map' | 'options' | 'importing' | 'done';

const CRM_FIELDS = [
  { value: '__skip__', label: '— No importar —' },
  { value: 'first_name', label: 'Nombre' },
  { value: 'last_name', label: 'Apellido' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'position', label: 'Cargo' },
  { value: 'notes', label: 'Notas' },
  { value: 'status', label: 'Estado' },
];

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if ((ch === ',' || ch === ';') && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine).filter(r => r.some(c => c));
  return { headers, rows };
}

function guessMapping(csvHeader: string): string {
  const h = csvHeader.toLowerCase().trim();
  if (/^(nombre|first.?name|name|given)$/i.test(h)) return 'first_name';
  if (/^(apellido|last.?name|surname|family)$/i.test(h)) return 'last_name';
  if (/^(email|correo|e-?mail)$/i.test(h)) return 'email';
  if (/^(tel[eé]fono|phone|tel|mobile|celular)$/i.test(h)) return 'phone';
  if (/^(cargo|position|title|puesto|rol)$/i.test(h)) return 'position';
  if (/^(notas|notes|observ)$/i.test(h)) return 'notes';
  if (/^(estado|status)$/i.test(h)) return 'status';
  return '__skip__';
}

export function ImportContactsDialog({ open, onOpenChange, segments, tags, customFields, onComplete }: ImportContactsDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState('');
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState({ created: 0, skipped: 0, errors: 0 });

  const allFields = useMemo(() => [
    ...CRM_FIELDS,
    ...customFields.map(f => ({ value: `custom:${f.id}`, label: `📋 ${f.name}` })),
  ], [customFields]);

  const reset = () => {
    setStep('upload');
    setCsvHeaders([]);
    setCsvRows([]);
    setMapping({});
    setSelectedTagIds([]);
    setSelectedSegmentId('');
    setProgress(0);
    setImportResult({ created: 0, skipped: 0, errors: 0 });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0 || rows.length === 0) {
        toast({ title: 'Error', description: 'El archivo CSV está vacío o no tiene el formato correcto', variant: 'destructive' });
        return;
      }
      setCsvHeaders(headers);
      setCsvRows(rows);
      // Auto-guess mappings
      const auto: Record<number, string> = {};
      headers.forEach((h, i) => { auto[i] = guessMapping(h); });
      setMapping(auto);
      setStep('map');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const emailColIndex = Object.entries(mapping).find(([, v]) => v === 'email')?.[0];
  const hasEmail = emailColIndex !== undefined;

  const startImport = async () => {
    if (!user || !hasEmail) return;
    setStep('importing');
    let created = 0, skipped = 0, errors = 0;
    const total = csvRows.length;
    const emailIdx = parseInt(emailColIndex!);

    // Build custom field column indexes
    const customMappings: { colIdx: number; fieldId: string }[] = [];
    for (const [colStr, val] of Object.entries(mapping)) {
      if (val.startsWith('custom:')) {
        customMappings.push({ colIdx: parseInt(colStr), fieldId: val.replace('custom:', '') });
      }
    }

    const BATCH = 50;
    for (let i = 0; i < total; i += BATCH) {
      const batch = csvRows.slice(i, i + BATCH);
      for (const row of batch) {
        const email = row[emailIdx]?.trim();
        if (!email) { skipped++; continue; }

        const contact: Record<string, any> = { user_id: user.id, email };
        for (const [colStr, field] of Object.entries(mapping)) {
          if (field === '__skip__' || field.startsWith('custom:')) continue;
          const val = row[parseInt(colStr)]?.trim();
          if (val) contact[field] = val;
        }
        if (!contact.first_name) { contact.first_name = email.split('@')[0]; }

        const { data: inserted, error } = await supabase
          .from('contacts')
          .upsert(contact as any, { onConflict: 'user_id,email', ignoreDuplicates: false })
          .select('id')
          .single();

        if (error || !inserted) { errors++; continue; }
        created++;

        // Custom field values
        if (customMappings.length > 0) {
          const cfValues = customMappings
            .map(cm => ({ contact_id: inserted.id, custom_field_id: cm.fieldId, value: row[cm.colIdx]?.trim() || null }))
            .filter(v => v.value);
          if (cfValues.length > 0) {
            await supabase.from('contact_custom_values').upsert(cfValues, { onConflict: 'contact_id,custom_field_id' });
          }
        }

        // Tags
        if (selectedTagIds.length > 0) {
          const tagRows = selectedTagIds.map(tag_id => ({ contact_id: inserted.id, tag_id }));
          await supabase.from('contact_tags').upsert(tagRows, { onConflict: 'contact_id,tag_id', ignoreDuplicates: true });
        }

        // Segment
        if (selectedSegmentId) {
          await supabase.from('segment_contacts').upsert(
            { contact_id: inserted.id, segment_id: selectedSegmentId },
            { onConflict: 'contact_id,segment_id', ignoreDuplicates: true }
          );
        }
      }
      setProgress(Math.min(100, Math.round(((i + batch.length) / total) * 100)));
    }

    setImportResult({ created, skipped, errors });
    setStep('done');
  };

  const toggleTag = (id: string) => {
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Contactos desde CSV
          </DialogTitle>
        </DialogHeader>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {['Archivo', 'Mapeo', 'Opciones', 'Importar'].map((label, i) => {
            const stepIdx = ['upload', 'map', 'options', 'importing'].indexOf(step);
            const done = i < stepIdx || step === 'done';
            const active = i === stepIdx;
            return (
              <div key={label} className="flex items-center gap-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary/20 text-primary border border-primary' : 'bg-muted text-muted-foreground'}`}>
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span className={active ? 'font-medium text-foreground' : ''}>{label}</span>
                {i < 3 && <ArrowRight className="h-3 w-3 mx-1" />}
              </div>
            );
          })}
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="flex flex-col items-center gap-4 py-8 border-2 border-dashed rounded-lg">
            <Upload className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Arrastrá o seleccioná un archivo CSV</p>
              <p className="text-sm text-muted-foreground">Separado por comas o punto y coma, con encabezados</p>
            </div>
            <Button onClick={() => fileRef.current?.click()}>
              Seleccionar archivo
            </Button>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
          </div>
        )}

        {/* Step: Map columns */}
        {step === 'map' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {csvRows.length} filas encontradas. Asociá cada columna del CSV con un campo del CRM.
            </p>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {csvHeaders.map((header, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="min-w-[140px] text-sm font-medium truncate" title={header}>
                    {header}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select value={mapping[i] || '__skip__'} onValueChange={v => setMapping(prev => ({ ...prev, [i]: v }))}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allFields.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground truncate flex-1" title={csvRows[0]?.[i]}>
                    Ej: {csvRows[0]?.[i] || '—'}
                  </span>
                </div>
              ))}
            </div>
            {!hasEmail && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Debés mapear al menos una columna como "Email"
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>Atrás</Button>
              <Button disabled={!hasEmail} onClick={() => setStep('options')}>Siguiente</Button>
            </div>
          </div>
        )}

        {/* Step: Options (tag + segment) */}
        {step === 'options' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium">Agregar a segmento (opcional)</label>
              <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin segmento</SelectItem>
                  {segments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Asignar etiquetas (opcional)</label>
              <div className="flex flex-wrap gap-2">
                {tags.map(t => (
                  <Badge
                    key={t.id}
                    variant={selectedTagIds.includes(t.id) ? 'default' : 'outline'}
                    className="cursor-pointer transition-colors"
                    style={selectedTagIds.includes(t.id) ? { backgroundColor: t.color, borderColor: t.color } : { borderColor: t.color, color: t.color }}
                    onClick={() => toggleTag(t.id)}
                  >
                    {t.name}
                  </Badge>
                ))}
                {tags.length === 0 && <p className="text-sm text-muted-foreground">No hay etiquetas creadas</p>}
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p><strong>Resumen:</strong></p>
              <p>• {csvRows.length} contactos a importar</p>
              <p>• {Object.values(mapping).filter(v => v !== '__skip__').length} campos mapeados</p>
              {selectedSegmentId && selectedSegmentId !== '__none__' && (
                <p>• Segmento: {segments.find(s => s.id === selectedSegmentId)?.name}</p>
              )}
              {selectedTagIds.length > 0 && (
                <p>• Etiquetas: {selectedTagIds.map(id => tags.find(t => t.id === id)?.name).join(', ')}</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('map')}>Atrás</Button>
              <Button onClick={startImport}>
                <Upload className="h-4 w-4 mr-2" />
                Importar {csvRows.length} contactos
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="space-y-4 py-8">
            <p className="text-center font-medium">Importando contactos...</p>
            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="space-y-4 py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Importación completada</h3>
            <div className="space-y-1 text-sm">
              <p className="text-green-600">✓ {importResult.created} contactos importados</p>
              {importResult.skipped > 0 && <p className="text-yellow-600">⚠ {importResult.skipped} filas omitidas (sin email)</p>}
              {importResult.errors > 0 && <p className="text-destructive">✗ {importResult.errors} errores</p>}
            </div>
            <Button onClick={() => { onOpenChange(false); reset(); onComplete(); }}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
