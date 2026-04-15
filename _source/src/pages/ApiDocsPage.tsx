import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Copy, Plus, Trash2, Key, Book, Webhook, Eye, EyeOff } from 'lucide-react';

const ALL_PERMISSIONS = [
  { value: 'contacts:read', label: 'Leer contactos' },
  { value: 'contacts:write', label: 'Crear/editar contactos' },
  { value: 'contacts:delete', label: 'Eliminar contactos' },
  { value: 'contacts:all', label: 'Acceso total a contactos' },
  { value: 'tags:read', label: 'Leer etiquetas' },
  { value: 'tags:write', label: 'Crear/editar/eliminar etiquetas' },
  { value: 'segments:read', label: 'Leer segmentos' },
  { value: 'segments:write', label: 'Crear/editar/eliminar segmentos' },
  { value: 'custom_fields:read', label: 'Leer campos personalizados' },
  { value: 'custom_fields:write', label: 'Crear/editar/eliminar campos personalizados' },
  { value: '*', label: 'Acceso total (todos los recursos)' },
];

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'aura_';
  let key = prefix;
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export default function ApiDocsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New key dialog
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPerms, setNewKeyPerms] = useState<string[]>(['contacts:read']);
  const [newKeyExpiry, setNewKeyExpiry] = useState('never');
  const [generatedKey, setGeneratedKey] = useState('');
  const [creating, setCreating] = useState(false);

  const baseUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

  useEffect(() => {
    if (user) loadKeys();
  }, [user]);

  const loadKeys = async () => {
    const { data } = await (supabase.from('api_keys' as any).select('*').order('created_at', { ascending: false }) as any);
    setApiKeys(data || []);
    setLoading(false);
  };

  const createKey = async () => {
    if (!user || !newKeyName.trim()) return;
    setCreating(true);

    const rawKey = generateApiKey();
    const keyHash = await hashKey(rawKey);
    const keyPreview = rawKey.slice(-4);

    let expiresAt = null;
    if (newKeyExpiry === '30d') expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
    if (newKeyExpiry === '90d') expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
    if (newKeyExpiry === '1y') expiresAt = new Date(Date.now() + 365 * 86400000).toISOString();

    const { error } = await (supabase.from('api_keys' as any).insert({
      user_id: user.id,
      name: newKeyName.trim(),
      key_hash: keyHash,
      key_preview: keyPreview,
      permissions: newKeyPerms,
      expires_at: expiresAt,
    }) as any);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setGeneratedKey(rawKey);
      loadKeys();
    }
    setCreating(false);
  };

  const deleteKey = async (id: string) => {
    await (supabase.from('api_keys' as any).delete().eq('id', id) as any);
    toast({ title: 'API key eliminada' });
    loadKeys();
  };

  const toggleKey = async (id: string, active: boolean) => {
    await (supabase.from('api_keys' as any).update({ is_active: active }).eq('id', id) as any);
    loadKeys();
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado al portapapeles' });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API & Webhooks</h1>
        <p className="text-muted-foreground">Gestiona tus API keys y consulta la documentación de la API pública.</p>
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys"><Key className="h-4 w-4 mr-1" />API Keys</TabsTrigger>
          <TabsTrigger value="api-docs"><Book className="h-4 w-4 mr-1" />API REST</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="h-4 w-4 mr-1" />Webhooks</TabsTrigger>
        </TabsList>

        {/* API KEYS TAB */}
        <TabsContent value="keys" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Crea API keys para autenticar tus integraciones.</p>
            <Dialog open={showNewKey} onOpenChange={v => { setShowNewKey(v); if (!v) { setGeneratedKey(''); setNewKeyName(''); setNewKeyPerms(['contacts:read']); } }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1" />Nueva API Key</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{generatedKey ? 'API Key generada' : 'Crear nueva API Key'}</DialogTitle>
                </DialogHeader>

                {generatedKey ? (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-amber-800 mb-2">⚠️ Guarda esta key ahora, no podrás verla de nuevo:</p>
                      <div className="flex gap-2">
                        <code className="flex-1 bg-white p-2 rounded text-xs break-all border">{generatedKey}</code>
                        <Button size="icon" variant="outline" onClick={() => copyText(generatedKey)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => { setShowNewKey(false); setGeneratedKey(''); setNewKeyName(''); }}>Entendido</Button>
                    </DialogFooter>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Nombre</label>
                      <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="ej: Integración n8n" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Permisos</label>
                      <div className="space-y-2 mt-1">
                        {ALL_PERMISSIONS.map(p => (
                          <label key={p.value} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={newKeyPerms.includes(p.value)}
                              onCheckedChange={checked => {
                                setNewKeyPerms(prev =>
                                  checked ? [...prev, p.value] : prev.filter(x => x !== p.value)
                                );
                              }}
                            />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Expiración</label>
                      <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">Sin expiración</SelectItem>
                          <SelectItem value="30d">30 días</SelectItem>
                          <SelectItem value="90d">90 días</SelectItem>
                          <SelectItem value="1y">1 año</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button onClick={createKey} disabled={creating || !newKeyName.trim()}>Generar Key</Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {apiKeys.map(k => (
            <Card key={k.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{k.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ****{k.key_preview} · Creada {new Date(k.created_at).toLocaleDateString()}
                      {k.last_used_at && ` · Último uso ${new Date(k.last_used_at).toLocaleDateString()}`}
                      {k.expires_at && ` · Expira ${new Date(k.expires_at).toLocaleDateString()}`}
                    </p>
                    <div className="flex gap-1 mt-1">
                      {(k.permissions || []).map((p: string) => (
                        <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => toggleKey(k.id, !k.is_active)} title={k.is_active ? 'Desactivar' : 'Activar'}>
                    {k.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteKey(k.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!loading && apiKeys.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No tienes API keys creadas.</p>
          )}
        </TabsContent>

        {/* API DOCS TAB */}
        <TabsContent value="api-docs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API REST</CardTitle>
              <CardDescription>Base URL de la API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <code className="flex-1 bg-muted p-2 rounded text-sm">{baseUrl}/public-api/v1/</code>
                <Button size="icon" variant="outline" onClick={() => copyText(`${baseUrl}/public-api/v1/`)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Recursos disponibles: <code>/contacts</code>, <code>/tags</code>, <code>/segments</code>, <code>/custom-fields</code></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Autenticación</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">Todas las peticiones requieren el header <code className="bg-muted px-1 rounded">x-api-key</code>:</p>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`curl -H "x-api-key: aura_tu_api_key_aqui" \\
  ${baseUrl}/public-api/v1/contacts`}</pre>
            </CardContent>
          </Card>

          {/* CONTACTS */}
          <h2 className="text-lg font-bold pt-4">📇 Contactos</h2>

          <EndpointDoc method="GET" path="/v1/contacts" description="Listar contactos con paginación, filtros, tags, segmentos y campos personalizados incluidos" permission="contacts:read"
            params={[
              { name: 'page', desc: 'Página (default: 1)' },
              { name: 'per_page', desc: 'Resultados por página (max 100, default: 50)' },
              { name: 'search', desc: 'Buscar por nombre o email' },
              { name: 'status', desc: 'Filtrar por estado' },
              { name: 'tag_id', desc: 'Filtrar por etiqueta (UUID)' },
              { name: 'segment_id', desc: 'Filtrar por segmento (UUID)' },
            ]}
            example={`curl -H "x-api-key: KEY" "${baseUrl}/public-api/v1/contacts?tag_id=UUID&page=1"`}
            response={`{
  "data": [{
    "id": "uuid", "first_name": "Juan", "email": "...",
    "tags": [{"id": "uuid", "name": "VIP"}],
    "segments": [{"id": "uuid", "name": "Activos"}],
    "custom_fields": { "Industria": "Tech" }
  }],
  "pagination": { "page": 1, "per_page": 50, "total": 120, "total_pages": 3 }
}`}
            baseUrl={baseUrl}
          />

          <EndpointDoc method="GET" path="/v1/contacts/search" description="Buscar contactos por cualquier campo estándar o personalizado. Múltiples parámetros actúan como AND." permission="contacts:read"
            params={[
              { name: '(campo estándar)', desc: 'email, phone, first_name, last_name, position, status, lead_score, etc.' },
              { name: '(campo personalizado)', desc: 'Nombre exacto del campo personalizado (ej: token, pais, smartscoring)' },
              { name: 'like', desc: 'true para búsqueda parcial (LIKE %valor%), default: coincidencia exacta' },
              { name: 'page', desc: 'Página (default: 1)' },
              { name: 'per_page', desc: 'Resultados por página (max 100, default: 50)' },
            ]}
            example={`# Buscar por email exacto:
curl -H "x-api-key: KEY" "${baseUrl}/public-api/v1/contacts/search?email=juan@email.com"

# Buscar por campo personalizado:
curl -H "x-api-key: KEY" "${baseUrl}/public-api/v1/contacts/search?token=abc123"

# Buscar parcial por nombre + campo custom:
curl -H "x-api-key: KEY" "${baseUrl}/public-api/v1/contacts/search?first_name=Jua&pais=Argentina&like=true"`}
            baseUrl={baseUrl}
          />

          <EndpointDoc method="GET" path="/v1/contacts/:id" description="Obtener contacto con tags, segmentos y campos personalizados integrados" permission="contacts:read"
            response={`{
  "data": {
    "id": "uuid",
    "first_name": "Juan",
    "last_name": "Pérez",
    "email": "juan@email.com",
    "phone": "+5491155...",
    "status": "activo",
    "lead_score": 50,
    "tags": [{"id": "uuid", "name": "VIP", "color": "#EF4444"}],
    "segments": [{"id": "uuid", "name": "Clientes activos"}],
    "custom_fields": {
      "Industria": "Tech",
      "Ciudad": "Buenos Aires"
    }
  }
}`}
            baseUrl={baseUrl}
          />

          <EndpointDoc method="POST" path="/v1/contacts" description="Crear contacto con tags, segmentos y campos personalizados. Retorna el contacto completo." permission="contacts:write"
            body={`{
  "first_name": "Juan",              // requerido
  "last_name": "Pérez",
  "email": "juan@email.com",
  "phone": "+5491155...",
  "status": "activo",
  "tag_ids": ["uuid-tag-1"],         // opcional: asignar etiquetas
  "segment_ids": ["uuid-seg-1"],     // opcional: agregar a segmentos
  "custom_fields": {                 // opcional: por nombre del campo
    "Industria": "Tech",
    "Ciudad": "Buenos Aires"
  }
}`}
            baseUrl={baseUrl}
          />

          <EndpointDoc method="PUT" path="/v1/contacts/:id" description="Actualizar contacto. Retorna el contacto completo actualizado. Tags/segmentos se reemplazan si se envían." permission="contacts:write"
            body={`{
  "lead_score": 80,
  "tag_ids": ["uuid-1", "uuid-2"],   // reemplaza todas las etiquetas
  "segment_ids": ["uuid-seg"],       // reemplaza todos los segmentos
  "custom_fields": {                 // upsert por nombre del campo
    "Industria": "nuevo valor",
    "Ciudad": "Córdoba"
  }
}`}
            baseUrl={baseUrl}
          />

          <EndpointDoc method="DELETE" path="/v1/contacts/:id" description="Eliminar contacto" permission="contacts:delete" baseUrl={baseUrl} />

          <h3 className="text-sm font-semibold pt-2">Sub-recursos de contacto</h3>

          <EndpointDoc method="GET" path="/v1/contacts/:id/tags" description="Listar etiquetas del contacto" permission="contacts:read" baseUrl={baseUrl} />
          <EndpointDoc method="POST" path="/v1/contacts/:id/tags" description="Agregar etiqueta al contacto" permission="contacts:write" body={`{ "tag_id": "uuid" }`} baseUrl={baseUrl} />
          <EndpointDoc method="DELETE" path="/v1/contacts/:id/tags?tag_id=UUID" description="Quitar etiqueta del contacto" permission="contacts:write" baseUrl={baseUrl} />

          <EndpointDoc method="GET" path="/v1/contacts/:id/segments" description="Listar segmentos del contacto" permission="contacts:read" baseUrl={baseUrl} />
          <EndpointDoc method="POST" path="/v1/contacts/:id/segments" description="Agregar contacto a segmento" permission="contacts:write" body={`{ "segment_id": "uuid" }`} baseUrl={baseUrl} />
          <EndpointDoc method="DELETE" path="/v1/contacts/:id/segments?segment_id=UUID" description="Quitar contacto de segmento" permission="contacts:write" baseUrl={baseUrl} />

          <EndpointDoc method="GET" path="/v1/contacts/:id/custom-fields" description="Listar valores de campos personalizados como objeto clave-valor" permission="contacts:read"
            response={`{ "data": { "Industria": "Tech", "Ciudad": "BA" } }`} baseUrl={baseUrl} />
          <EndpointDoc method="POST" path="/v1/contacts/:id/custom-fields" description="Establecer valores de campos personalizados por nombre" permission="contacts:write"
            body={`{ "Industria": "Tech", "Ciudad": "Buenos Aires" }`} baseUrl={baseUrl} />

          {/* TAGS */}
          <h2 className="text-lg font-bold pt-4">🏷️ Etiquetas</h2>
          <EndpointDoc method="GET" path="/v1/tags" description="Listar todas las etiquetas" permission="tags:read" baseUrl={baseUrl} />
          <EndpointDoc method="GET" path="/v1/tags/:id" description="Obtener etiqueta por ID" permission="tags:read" baseUrl={baseUrl} />
          <EndpointDoc method="POST" path="/v1/tags" description="Crear etiqueta" permission="tags:write" body={`{ "name": "VIP", "color": "#EF4444" }`} baseUrl={baseUrl} />
          <EndpointDoc method="PUT" path="/v1/tags/:id" description="Actualizar etiqueta" permission="tags:write" body={`{ "name": "Premium", "color": "#8B5CF6" }`} baseUrl={baseUrl} />
          <EndpointDoc method="DELETE" path="/v1/tags/:id" description="Eliminar etiqueta" permission="tags:write" baseUrl={baseUrl} />

          {/* SEGMENTS */}
          <h2 className="text-lg font-bold pt-4">📋 Segmentos</h2>
          <EndpointDoc method="GET" path="/v1/segments" description="Listar todos los segmentos" permission="segments:read" baseUrl={baseUrl} />
          <EndpointDoc method="GET" path="/v1/segments/:id" description="Obtener segmento por ID" permission="segments:read" baseUrl={baseUrl} />
          <EndpointDoc method="GET" path="/v1/segments/:id/contacts" description="Listar contactos del segmento" permission="segments:read" baseUrl={baseUrl} />
          <EndpointDoc method="POST" path="/v1/segments" description="Crear segmento" permission="segments:write" body={`{ "name": "Clientes Gold", "description": "..." }`} baseUrl={baseUrl} />
          <EndpointDoc method="POST" path="/v1/segments/:id/contacts" description="Agregar contacto al segmento" permission="segments:write" body={`{ "contact_id": "uuid" }`} baseUrl={baseUrl} />
          <EndpointDoc method="DELETE" path="/v1/segments/:id" description="Eliminar segmento" permission="segments:write" baseUrl={baseUrl} />
          <EndpointDoc method="DELETE" path="/v1/segments/:id/contacts?contact_id=UUID" description="Quitar contacto del segmento" permission="segments:write" baseUrl={baseUrl} />

          {/* CUSTOM FIELDS */}
          <h2 className="text-lg font-bold pt-4">✏️ Campos Personalizados</h2>
          <EndpointDoc method="GET" path="/v1/custom-fields" description="Listar campos personalizados" permission="custom_fields:read" baseUrl={baseUrl} />
          <EndpointDoc method="GET" path="/v1/custom-fields/:id" description="Obtener campo personalizado por ID" permission="custom_fields:read" baseUrl={baseUrl} />
          <EndpointDoc method="POST" path="/v1/custom-fields" description="Crear campo personalizado" permission="custom_fields:write"
            body={`{
  "name": "Industria",
  "field_type": "text",       // text, number, select, date, checkbox
  "is_required": false,
  "options": ["Tech", "Finance", "Health"]  // solo para tipo select
}`}
            baseUrl={baseUrl}
          />
          <EndpointDoc method="PUT" path="/v1/custom-fields/:id" description="Actualizar campo personalizado" permission="custom_fields:write" baseUrl={baseUrl} />
          <EndpointDoc method="DELETE" path="/v1/custom-fields/:id" description="Eliminar campo personalizado" permission="custom_fields:write" baseUrl={baseUrl} />
        </TabsContent>

        {/* WEBHOOKS TAB */}
        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Webhooks Entrantes</CardTitle>
              <CardDescription>Recibe datos de aplicaciones externas (n8n, Zapier, Make, etc.)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <code className="flex-1 bg-muted p-2 rounded text-sm">{baseUrl}/webhook-receiver</code>
                <Button size="icon" variant="outline" onClick={() => copyText(`${baseUrl}/webhook-receiver`)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Envía un POST con tu <code className="bg-muted px-1 rounded">x-api-key</code> y los datos del contacto.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Eventos soportados</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <WebhookEventDoc
                event="contact.create"
                description="Crear un contacto"
                body={`{
  "event": "contact.create",
  "data": {
    "first_name": "María",
    "last_name": "García",
    "email": "maria@email.com",
    "phone": "+5491155...",
    "tag_ids": ["uuid-de-tag"]
  }
}`}
              />
              <WebhookEventDoc
                event="contact.update"
                description="Actualizar un contacto"
                body={`{
  "event": "contact.update",
  "data": {
    "id": "uuid-del-contacto",
    "lead_score": 90,
    "status": "cliente"
  }
}`}
              />
              <WebhookEventDoc
                event="contact.delete"
                description="Eliminar un contacto"
                body={`{
  "event": "contact.delete",
  "data": {
    "id": "uuid-del-contacto"
  }
}`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhooks Salientes</CardTitle>
              <CardDescription>Envía datos a aplicaciones externas desde automatizaciones</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Usa la acción <strong>"Enviar webhook"</strong> en el editor de automatizaciones para enviar datos del contacto
                a una URL externa cuando se dispare un evento. Configura la URL destino, método HTTP, headers y body adicional.
              </p>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto mt-3">{`// Payload enviado automáticamente:
{
  "event": "automation.webhook",
  "automation_id": "uuid",
  "contact": {
    "id": "uuid",
    "first_name": "...",
    "email": "...",
    ...
  },
  ...body_adicional
}`}</pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EndpointDoc({ method, path, description, permission, params, body, example, response, baseUrl }: any) {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-100 text-emerald-700',
    POST: 'bg-blue-100 text-blue-700',
    PUT: 'bg-amber-100 text-amber-700',
    DELETE: 'bg-red-100 text-red-700',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge className={colors[method]}>{method}</Badge>
          <code className="text-sm font-medium">{path}</code>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge variant="outline" className="text-xs">Permiso: {permission}</Badge>
        {params && (
          <div>
            <p className="text-xs font-medium mb-1">Query params:</p>
            <div className="space-y-1">
              {params.map((p: any) => (
                <p key={p.name} className="text-xs"><code className="bg-muted px-1 rounded">{p.name}</code> — {p.desc}</p>
              ))}
            </div>
          </div>
        )}
        {body && (
          <div>
            <p className="text-xs font-medium mb-1">Body (JSON):</p>
            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">{body}</pre>
          </div>
        )}
        <div>
          <p className="text-xs font-medium mb-1">Ejemplo:</p>
          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">{example}</pre>
        </div>
        {response && (
          <div>
            <p className="text-xs font-medium mb-1">Respuesta:</p>
            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">{response}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WebhookEventDoc({ event, description, body }: any) {
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{event}</Badge>
        <span className="text-sm">{description}</span>
      </div>
      <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">{body}</pre>
    </div>
  );
}
