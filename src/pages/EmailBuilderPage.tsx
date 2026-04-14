import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, Eye, Monitor, Smartphone, Code } from 'lucide-react';
import { BlockToolbar } from '@/components/email-builder/BlockToolbar';
import { BlockRenderer } from '@/components/email-builder/BlockRenderer';
import { PropertiesPanel } from '@/components/email-builder/PropertiesPanel';
import { blocksToHtml } from '@/components/email-builder/htmlGenerator';
import { EmailBlock, BlockType, defaultBlockProps } from '@/components/email-builder/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function EmailBuilderPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaign');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState('Nueva Plantilla');
  const [subject, setSubject] = useState('');
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showPreview, setShowPreview] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;

  useEffect(() => {
    if (id && id !== 'new') {
      loadTemplate(id);
    }
  }, [id]);

  const loadTemplate = async (templateId: string) => {
    const { data } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    if (data) {
      setName(data.name);
      setSubject(data.subject);
      setBlocks((data.blocks as unknown as EmailBlock[]) || []);
    }
  };

  const addBlock = useCallback((type: BlockType) => {
    const newBlock: EmailBlock = {
      id: crypto.randomUUID(),
      type,
      props: { ...defaultBlockProps[type] },
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  }, []);

  const updateBlockProps = useCallback((blockId: string, props: Record<string, any>) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, props } : b)));
  }, []);

  const deleteBlock = useCallback((blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  }, [selectedBlockId]);

  const duplicateBlock = useCallback((blockId: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if (idx === -1) return prev;
      const dup = { ...prev[idx], id: crypto.randomUUID(), props: { ...prev[idx].props } };
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
  }, []);

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('block-type') as BlockType;
    if (type) addBlock(type);
  };

  const reorder = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const html = blocksToHtml(blocks);
    const payload = {
      name,
      subject,
      blocks: blocks as unknown as Record<string, any>[],
      html_content: html,
      user_id: user.id,
      campaign_id: campaignId || null,
    };

    let error;
    if (id && id !== 'new') {
      ({ error } = await supabase.from('email_templates').update(payload).eq('id', id));
    } else {
      const { data, error: e } = await supabase.from('email_templates').insert(payload).select('id').single();
      error = e;
      if (data) navigate(`/email-builder/${data.id}${campaignId ? `?campaign=${campaignId}` : ''}`, { replace: true });
    }
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Plantilla guardada' });
    }
  };

  const previewWidth = previewMode === 'desktop' ? 600 : 375;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top Bar */}
      <div className="flex items-center gap-3 border-b px-4 py-2 bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(campaignId ? '/campanas' : '/email-builder')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input className="h-8 text-sm max-w-[240px]" value={name} onChange={(e) => setName(e.target.value)} />
        <Input className="h-8 text-sm max-w-[300px]" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto del email" />
        <div className="flex-1" />
        <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as any)}>
          <TabsList className="h-8">
            <TabsTrigger value="desktop" className="h-6 text-xs px-2"><Monitor className="h-3.5 w-3.5" /></TabsTrigger>
            <TabsTrigger value="mobile" className="h-6 text-xs px-2"><Smartphone className="h-3.5 w-3.5" /></TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" onClick={() => setShowCode(true)}><Code className="h-3.5 w-3.5 mr-1" />HTML</Button>
        <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}><Eye className="h-3.5 w-3.5 mr-1" />Preview</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}><Save className="h-3.5 w-3.5 mr-1" />{saving ? 'Guardando...' : 'Guardar'}</Button>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Block palette */}
        <div className="w-52 border-r bg-card shrink-0">
          <ScrollArea className="h-full p-3">
            <BlockToolbar onAddBlock={addBlock} />
          </ScrollArea>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-auto bg-muted/50 p-6">
          <div
            className="mx-auto bg-white rounded-lg shadow-sm min-h-[400px] transition-all"
            style={{ maxWidth: previewWidth }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleCanvasDrop}
          >
            {blocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm gap-2">
                <p className="font-medium">Arrastra bloques aquí</p>
                <p className="text-xs">o haz clic en un bloque del panel izquierdo</p>
              </div>
            ) : (
              <div className="p-4 space-y-1">
                {blocks.map((block, idx) => (
                  <BlockRenderer
                    key={block.id}
                    block={block}
                    selected={block.id === selectedBlockId}
                    onSelect={() => setSelectedBlockId(block.id)}
                    onDelete={() => deleteBlock(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={() => { if (dragIdx !== null) reorder(dragIdx, idx); setDragIdx(null); }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Properties */}
        <div className="w-64 border-l bg-card shrink-0">
          <ScrollArea className="h-full p-3">
            <PropertiesPanel block={selectedBlock} onUpdate={updateBlockProps} />
          </ScrollArea>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader><DialogTitle>Vista previa</DialogTitle></DialogHeader>
          <iframe srcDoc={blocksToHtml(blocks, previewWidth)} className="w-full h-[70vh] border rounded" />
        </DialogContent>
      </Dialog>

      {/* Code Dialog */}
      <Dialog open={showCode} onOpenChange={setShowCode}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader><DialogTitle>Código HTML</DialogTitle></DialogHeader>
          <ScrollArea className="h-[65vh]">
            <pre className="text-xs whitespace-pre-wrap bg-muted p-4 rounded">{blocksToHtml(blocks, previewWidth)}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
