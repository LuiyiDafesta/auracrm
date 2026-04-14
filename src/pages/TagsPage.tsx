import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Trash2, Tag } from 'lucide-react';

const TAG_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

export default function TagsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tags, setTags] = useState<any[]>([]);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const fetchTags = async () => {
    if (!user) return;
    const { data } = await supabase.from('tags').select('*').order('name');
    setTags(data || []);

    if (data) {
      const counts: Record<string, number> = {};
      for (const tag of data) {
        const { count } = await supabase.from('contact_tags').select('id', { count: 'exact', head: true }).eq('tag_id', tag.id);
        counts[tag.id] = count || 0;
      }
      setTagCounts(counts);
    }
  };

  useEffect(() => { fetchTags(); }, [user]);

  const createTag = async () => {
    if (!user || !newName.trim()) return;
    const { error } = await supabase.from('tags').insert({ user_id: user.id, name: newName.trim(), color: newColor });
    if (error) {
      toast({ title: error.code === '23505' ? 'Esa etiqueta ya existe' : 'Error', description: error.code !== '23505' ? error.message : undefined, variant: 'destructive' });
      return;
    }
    setNewName('');
    setNewColor(TAG_COLORS[0]);
    toast({ title: 'Etiqueta creada' });
    fetchTags();
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('tags').update({ name: editName.trim(), color: editColor }).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setEditingId(null);
    toast({ title: 'Etiqueta actualizada' });
    fetchTags();
  };

  const deleteTag = async (id: string) => {
    await supabase.from('tags').delete().eq('id', id);
    toast({ title: 'Etiqueta eliminada' });
    fetchTags();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Etiquetas</h1>
        <p className="text-muted-foreground">Organiza y clasifica tus contactos</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Input className="max-w-xs" placeholder="Nueva etiqueta..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createTag()} />
            <div className="flex gap-1">
              {TAG_COLORS.map(c => (
                <button key={c} className={`h-6 w-6 rounded-full border-2 transition-all ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} onClick={() => setNewColor(c)} />
              ))}
            </div>
            <Button onClick={createTag} disabled={!newName.trim()}>Crear</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etiqueta</TableHead>
                <TableHead>Contactos</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No hay etiquetas</TableCell></TableRow>
              ) : tags.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    {editingId === t.id ? (
                      <div className="flex items-center gap-2">
                        <Input className="h-8 w-40" value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(t.id); if (e.key === 'Escape') setEditingId(null); }} autoFocus />
                        <div className="flex gap-1">
                          {TAG_COLORS.map(c => (
                            <button key={c} className={`h-5 w-5 rounded-full border-2 ${editColor === c ? 'border-foreground' : 'border-transparent'}`} style={{ backgroundColor: c }} onClick={() => setEditColor(c)} />
                          ))}
                        </div>
                        <Button size="sm" className="h-8" onClick={() => saveEdit(t.id)}>Ok</Button>
                      </div>
                    ) : (
                      <Badge variant="secondary" style={{ backgroundColor: t.color + '20', color: t.color, borderColor: t.color + '40' }}>
                        <Tag className="h-3 w-3 mr-1" />{t.name}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{tagCounts[t.id] ?? '...'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingId(t.id); setEditName(t.name); setEditColor(t.color); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteTag(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
