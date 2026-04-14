
-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'activo',
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own projects"
  ON public.projects FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Project-Contacts junction
CREATE TABLE public.project_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, contact_id)
);

ALTER TABLE public.project_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own project_contacts"
  ON public.project_contacts FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_contacts.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_contacts.project_id AND projects.user_id = auth.uid()));

-- Project-Campaigns junction
CREATE TABLE public.project_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, campaign_id)
);

ALTER TABLE public.project_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own project_campaigns"
  ON public.project_campaigns FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_campaigns.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_campaigns.project_id AND projects.user_id = auth.uid()));

-- Project-Opportunities junction
CREATE TABLE public.project_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, opportunity_id)
);

ALTER TABLE public.project_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own project_opportunities"
  ON public.project_opportunities FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_opportunities.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_opportunities.project_id AND projects.user_id = auth.uid()));

-- Project-Tasks junction
CREATE TABLE public.project_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, task_id)
);

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own project_tasks"
  ON public.project_tasks FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_tasks.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_tasks.project_id AND projects.user_id = auth.uid()));
