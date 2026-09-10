CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  blurb text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tools TO authenticated;
GRANT ALL ON public.tools TO service_role;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tools read" ON public.tools FOR SELECT TO authenticated USING (true);
CREATE POLICY "tools staff write" ON public.tools FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE TRIGGER update_tools_updated_at BEFORE UPDATE ON public.tools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tool_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text NOT NULL DEFAULT '',
  link_url text,
  link_label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_steps TO authenticated;
GRANT ALL ON public.tool_steps TO service_role;
ALTER TABLE public.tool_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tool_steps read" ON public.tool_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "tool_steps staff write" ON public.tool_steps FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE TRIGGER update_tool_steps_updated_at BEFORE UPDATE ON public.tool_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX tool_steps_tool_idx ON public.tool_steps(tool_id, sort_order);

CREATE TABLE public.tool_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'download' CHECK (kind IN ('download','video','tutorial','template')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_resources TO authenticated;
GRANT ALL ON public.tool_resources TO service_role;
ALTER TABLE public.tool_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tool_resources read" ON public.tool_resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "tool_resources staff write" ON public.tool_resources FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE TRIGGER update_tool_resources_updated_at BEFORE UPDATE ON public.tool_resources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX tool_resources_tool_idx ON public.tool_resources(tool_id, sort_order);

CREATE TABLE public.tool_step_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.tool_steps(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, step_id)
);
GRANT SELECT, INSERT, DELETE ON public.tool_step_progress TO authenticated;
GRANT ALL ON public.tool_step_progress TO service_role;
ALTER TABLE public.tool_step_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tool progress read" ON public.tool_step_progress FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_staff(auth.uid()));
CREATE POLICY "tool progress insert" ON public.tool_step_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "tool progress delete" ON public.tool_step_progress FOR DELETE TO authenticated USING (user_id = auth.uid());

INSERT INTO public.tools (slug, name, blurb, sort_order) VALUES
 ('excel', 'Excel', 'Microsoft Excel via Microsoft 365 for all Excel modules.', 1),
 ('power-bi', 'Power BI', 'Power BI Desktop for the Power BI, DAX and visualisation courses.', 2),
 ('sql', 'SQL (PostgreSQL)', 'PostgreSQL is the database used throughout the SQL course.', 3),
 ('python', 'Python', 'Python, Jupyter and pandas for the Python for Data Analysis course.', 4);

INSERT INTO public.tool_steps (tool_id, title, instructions, link_url, link_label, sort_order)
SELECT t.id, s.title, s.instructions, s.link_url, s.link_label, s.sort_order FROM public.tools t
JOIN (VALUES
 ('excel', 'Sign in to Microsoft 365', 'Use your Microsoft account (or create a free one) and choose a Microsoft 365 plan that includes Excel. A free 1-month trial is available.', 'https://www.microsoft.com/en-us/microsoft-365/download-office', 'Open Microsoft 365 download page', 1),
 ('excel', 'Download and install Office', 'Click Install Office, run the installer and wait for it to finish. Excel appears in your Start menu / Applications folder.', NULL, NULL, 2),
 ('excel', 'Open Excel and activate', 'Launch Excel, sign in with the same Microsoft account and confirm the product is activated (File > Account).', NULL, NULL, 3),
 ('excel', 'Enable the Analysis ToolPak', 'File > Options > Add-ins > Manage Excel Add-ins > Go, then tick Analysis ToolPak. You will need it for histograms and forecasting.', NULL, NULL, 4),
 ('power-bi', 'Download Power BI Desktop', 'Windows only. Download from the official Microsoft page (or install from the Microsoft Store to get automatic updates).', 'https://www.microsoft.com/en-us/power-platform/products/power-bi/desktop', 'Download Power BI Desktop', 1),
 ('power-bi', 'Run the installer', 'Accept the defaults. Installation takes a few minutes.', NULL, NULL, 2),
 ('power-bi', 'Open Power BI and skip sign-in', 'A work or school account is optional for Desktop — you can close the sign-in dialog and start building reports.', NULL, NULL, 3),
 ('power-bi', 'Open a sample PBIX', 'Download any .pbix file from the Power BI course materials and open it to confirm everything works.', NULL, NULL, 4),
 ('sql', 'Download PostgreSQL', 'Pick the latest version for your operating system from the EDB download page.', 'https://www.enterprisedb.com/downloads/postgres-postgresql-downloads', 'Download PostgreSQL', 1),
 ('sql', 'Watch the install walkthrough', 'Follow along with the video before you run the installer.', 'https://youtu.be/T1PrXly6kOs?si=UfHZJo7O2I3Csxk6', 'Watch: how to install PostgreSQL', 2),
 ('sql', 'Run the installer and set a password', 'Keep the default port 5432 and make sure pgAdmin 4 is ticked. Write down the postgres password — you will need it every time.', NULL, NULL, 3),
 ('sql', 'Open pgAdmin and connect', 'Launch pgAdmin, expand Servers and connect with the password you set. Create a database called arete_practice.', NULL, NULL, 4),
 ('python', 'Install Python (Anaconda)', 'Anaconda bundles Python, Jupyter and pandas in one install. Download the version for your operating system.', 'https://www.anaconda.com/download', 'Download Anaconda', 1),
 ('python', 'Follow the class setup notes', 'The Python folder of the Arete class content has the step-by-step setup notes and first notebook.', 'https://drive.google.com/drive/folders/1vn9UILmWcSOY5cSAsTrBxGtVcYnOLv4J?usp=drive_link', 'Open the Python setup folder', 2),
 ('python', 'Launch Jupyter Notebook', 'Open Anaconda Navigator and click Launch on Jupyter Notebook. A browser tab should open.', NULL, NULL, 3),
 ('python', 'Run your first cell', 'Create a new notebook and run: import pandas as pd; print(pd.__version__). If a version prints, you are ready.', NULL, NULL, 4)
) AS s(slug, title, instructions, link_url, link_label, sort_order) ON s.slug = t.slug;

INSERT INTO public.tool_resources (tool_id, kind, title, description, url, sort_order)
SELECT t.id, r.kind, r.title, r.description, r.url, r.sort_order FROM public.tools t
JOIN (VALUES
 ('excel', 'download', 'Microsoft 365 / Excel', 'Official download page for Excel.', 'https://www.microsoft.com/en-us/microsoft-365/download-office', 1),
 ('excel', 'tutorial', 'Excel help & learning', 'Microsoft''s official Excel training centre.', 'https://support.microsoft.com/en-us/excel', 2),
 ('power-bi', 'download', 'Power BI Desktop', 'Official Power BI Desktop download.', 'https://www.microsoft.com/en-us/power-platform/products/power-bi/desktop', 1),
 ('power-bi', 'tutorial', 'Power BI learning path', 'Microsoft Learn: get started with Power BI.', 'https://learn.microsoft.com/en-us/training/powerplatform/power-bi', 2),
 ('sql', 'download', 'PostgreSQL', 'Official PostgreSQL installer (includes pgAdmin).', 'https://www.enterprisedb.com/downloads/postgres-postgresql-downloads', 1),
 ('sql', 'video', 'How to install PostgreSQL', 'Step-by-step install video.', 'https://youtu.be/T1PrXly6kOs?si=UfHZJo7O2I3Csxk6', 2),
 ('sql', 'tutorial', 'PostgreSQL tutorial', 'Beginner-friendly SQL tutorials.', 'https://www.postgresqltutorial.com/', 3),
 ('python', 'download', 'Anaconda (Python + Jupyter)', 'All-in-one Python distribution.', 'https://www.anaconda.com/download', 1),
 ('python', 'template', 'Python setup folder', 'Class setup notes and starter notebook.', 'https://drive.google.com/drive/folders/1vn9UILmWcSOY5cSAsTrBxGtVcYnOLv4J?usp=drive_link', 2),
 ('python', 'tutorial', 'pandas getting started', 'Official pandas 10-minute intro.', 'https://pandas.pydata.org/docs/user_guide/10min.html', 3)
) AS r(slug, kind, title, description, url, sort_order) ON r.slug = t.slug;