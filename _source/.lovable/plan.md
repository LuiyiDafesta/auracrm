
# AuraCRM — CRM Completo en Español

## Resumen
Construir un CRM completo llamado **AuraCRM** con interfaz en español, autenticación de usuarios, base de datos con Lovable Cloud/Supabase, y todas las funcionalidades principales de un CRM profesional.

## Fase 1 — Autenticación y Layout Base
- Página de login/registro con email y contraseña (en español)
- Layout principal con sidebar de navegación (Dashboard, Contactos, Empresas, Oportunidades, Tareas, Calendario, Campañas, Reportes, Configuración)
- Rutas protegidas que requieren autenticación

## Fase 2 — Dashboard
- Tarjetas resumen: total contactos, oportunidades activas, tareas pendientes, ingresos estimados
- Gráfico de oportunidades por etapa
- Actividad reciente
- Tareas próximas a vencer

## Fase 3 — Contactos y Empresas
- **Contactos**: tabla con búsqueda/filtros, crear/editar/eliminar, detalle con historial de actividades, asociar a empresa
- **Empresas**: tabla con CRUD, asociar contactos, datos de la empresa (industria, tamaño, sitio web, etc.)

## Fase 4 — Pipeline de Ventas (Oportunidades)
- Vista Kanban con columnas arrastrables (Prospecto → Calificado → Propuesta → Negociación → Cerrado Ganado / Perdido)
- Crear/editar oportunidades con valor estimado, fecha de cierre, contacto/empresa asociados
- Vista de lista alternativa con filtros

## Fase 5 — Tareas y Calendario
- **Tareas**: CRUD con asignación, prioridad, fecha límite, estado, asociación a contacto/oportunidad
- **Calendario**: vista mensual/semanal con tareas y eventos

## Fase 6 — Campañas y Reportes
- **Campañas**: gestión básica de campañas (nombre, tipo, estado, fecha inicio/fin, notas)
- **Reportes**: dashboard analítico con métricas de ventas, conversión del pipeline, rendimiento por período

## Fase 7 — Configuración
- Perfil del usuario
- Personalización básica de la cuenta

## Base de datos (Lovable Cloud)
Tablas: contacts, companies, opportunities, tasks, campaigns, activities — todas con RLS por usuario autenticado.

## Diseño
- Estilo profesional y limpio, colores azul como primario (similar a NexusCRM)
- Sidebar colapsable, responsive
- Toda la UI en español
