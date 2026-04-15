import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Mail } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  subject: string;
  created_at: string;
  updated_at: string;
}

export default function EmailTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);

  const fetchTemplates = async () => {
    if (!user) return;
    const { data } = await supabase.from('email_templates').select('id, name, subject, created_at, updated_at').order('updated_at', { ascending: false });
    setTemplates(data || []);
  };

  useEffect(() => { fetchTemplates(); }, [user]);

  const handleDelete = async (id: string) => {
    await supabase.from('email_templates').delete().eq('id', id);
    toast({ title: 'Plantilla eliminada' });
    fetchTemplates();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Builder</h1>
          <p className="text-muted-foreground">Crea y gestiona plantillas de email</p>
        </div>
        <Button onClick={() => navigate('/email-builder/new')}>
          <Plus className="h-4 w-4 mr-2" />Nueva Plantilla
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Asunto</TableHead>
                <TableHead>Modificada</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                    <Mail className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    No hay plantillas aún. Crea tu primera plantilla.
                  </TableCell>
                </TableRow>
              ) : templates.map((t) => (
                <TableRow key={t.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/email-builder/${t.id}`)}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.subject || '—'}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(t.updated_at).toLocaleDateString('es-ES')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/email-builder/${t.id}`); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
