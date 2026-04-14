import {
  LayoutDashboard, Users, Building2, TrendingUp, CheckSquare,
  Calendar, Megaphone, BarChart3, Settings, LogOut, Zap, Tag, Filter, SlidersHorizontal, Mail, Workflow, Code2,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';

const items = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Contactos', url: '/contactos', icon: Users },
  { title: 'Empresas', url: '/empresas', icon: Building2 },
  { title: 'Etiquetas', url: '/etiquetas', icon: Tag },
  { title: 'Segmentos', url: '/segmentos', icon: Filter },
  { title: 'Campos', url: '/campos-personalizados', icon: SlidersHorizontal },
  { title: 'Oportunidades', url: '/oportunidades', icon: TrendingUp },
  { title: 'Tareas', url: '/tareas', icon: CheckSquare },
  { title: 'Calendario', url: '/calendario', icon: Calendar },
  { title: 'Campañas', url: '/campanas', icon: Megaphone },
  { title: 'Email Builder', url: '/email-builder', icon: Mail },
  { title: 'Automatizaciones', url: '/automatizaciones', icon: Workflow },
  { title: 'API & Webhooks', url: '/api', icon: Code2 },
  { title: 'Reportes', url: '/reportes', icon: BarChart3 },
  { title: 'Configuración', url: '/configuracion', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border">
        <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <Zap className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && <span className="text-lg font-bold text-sidebar-foreground">AuraCRM</span>}
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="px-2 py-2 text-xs text-sidebar-foreground/60 truncate">
            {user.email}
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="hover:bg-sidebar-accent text-sidebar-foreground/80">
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Cerrar sesión</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
