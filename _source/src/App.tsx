import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import Companies from "./pages/Companies";
import Opportunities from "./pages/Opportunities";
import Tasks from "./pages/Tasks";
import CalendarPage from "./pages/CalendarPage";
import Campaigns from "./pages/Campaigns";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/SettingsPage";
import TagsPage from "./pages/TagsPage";
import Segments from "./pages/Segments";
import CustomFieldsPage from "./pages/CustomFieldsPage";
import ContactDetail from "./pages/ContactDetail";
import NotFound from "./pages/NotFound";
import EmailTemplates from "./pages/EmailTemplates";
import EmailBuilderPage from "./pages/EmailBuilderPage";
import AutomationsPage from "./pages/AutomationsPage";
import AutomationEditorPage from "./pages/AutomationEditorPage";
import ApiDocsPage from "./pages/ApiDocsPage";
import ChannelsPage from "./pages/ChannelsPage";
import InboxPage from "./pages/InboxPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/contactos" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
            <Route path="/empresas" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
            <Route path="/oportunidades" element={<ProtectedRoute><Opportunities /></ProtectedRoute>} />
            <Route path="/tareas" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/calendario" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
            <Route path="/campanas" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
            <Route path="/reportes" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/configuracion" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/etiquetas" element={<ProtectedRoute><TagsPage /></ProtectedRoute>} />
            <Route path="/segmentos" element={<ProtectedRoute><Segments /></ProtectedRoute>} />
            <Route path="/campos-personalizados" element={<ProtectedRoute><CustomFieldsPage /></ProtectedRoute>} />
            <Route path="/contactos/:id" element={<ProtectedRoute><ContactDetail /></ProtectedRoute>} />
            <Route path="/email-builder" element={<ProtectedRoute><EmailTemplates /></ProtectedRoute>} />
            <Route path="/email-builder/:id" element={<ProtectedRoute><EmailBuilderPage /></ProtectedRoute>} />
            <Route path="/automatizaciones" element={<ProtectedRoute><AutomationsPage /></ProtectedRoute>} />
            <Route path="/automatizaciones/:id" element={<ProtectedRoute><AutomationEditorPage /></ProtectedRoute>} />
            <Route path="/api" element={<ProtectedRoute><ApiDocsPage /></ProtectedRoute>} />
            <Route path="/canales" element={<ProtectedRoute><ChannelsPage /></ProtectedRoute>} />
            <Route path="/inbox" element={<ProtectedRoute><InboxPage /></ProtectedRoute>} />
            <Route path="/proyectos" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
            <Route path="/proyectos/:id" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
