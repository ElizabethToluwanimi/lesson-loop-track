
-- ROLES
CREATE TYPE public.app_role AS ENUM ('student','instructor','admin');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  reminder_time TIME NOT NULL DEFAULT '19:00',
  daily_reminders BOOLEAN NOT NULL DEFAULT true,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','instructor'));
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email, NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id,'student') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CONTENT
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Data',
  thumbnail_url TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  duration_weeks INT NOT NULL DEFAULT 8,
  is_published BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT SELECT ON public.courses TO anon;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses public read" ON public.courses FOR SELECT USING (is_published OR public.is_staff(auth.uid()));
CREATE POLICY "courses staff write" ON public.courses FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modules TO authenticated;
GRANT SELECT ON public.modules TO anon;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules read" ON public.modules FOR SELECT USING (true);
CREATE POLICY "modules staff write" ON public.modules FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  video_url TEXT,
  duration_minutes INT NOT NULL DEFAULT 20,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT SELECT ON public.lessons TO anon;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons read" ON public.lessons FOR SELECT USING (true);
CREATE POLICY "lessons staff write" ON public.lessons FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.lesson_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  file_url TEXT NOT NULL,
  file_size_kb INT NOT NULL DEFAULT 0,
  downloadable BOOLEAN NOT NULL DEFAULT true,
  download_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_resources TO authenticated;
GRANT ALL ON public.lesson_resources TO service_role;
ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resources read" ON public.lesson_resources FOR SELECT TO authenticated USING (true);
CREATE POLICY "resources staff write" ON public.lesson_resources FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- LEARNER DATA
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
GRANT SELECT, INSERT, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrollments read" ON public.enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "enrollments insert" ON public.enrollments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "enrollments delete" ON public.enrollments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;
GRANT ALL ON public.lesson_progress TO service_role;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress read" ON public.lesson_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "progress write" ON public.lesson_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.learning_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  activity_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.learning_activity TO authenticated;
GRANT ALL ON public.learning_activity TO service_role;
ALTER TABLE public.learning_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity read" ON public.learning_activity FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "activity insert" ON public.learning_activity FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.learning_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_activity_date DATE
);
GRANT SELECT, INSERT, UPDATE ON public.learning_streaks TO authenticated;
GRANT ALL ON public.learning_streaks TO service_role;
ALTER TABLE public.learning_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streak read" ON public.learning_streaks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "streak write" ON public.learning_streaks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- streak maintenance on activity insert
CREATE OR REPLACE FUNCTION public.bump_streak()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev DATE; cur INT; best INT;
BEGIN
  SELECT last_activity_date, current_streak, longest_streak INTO prev, cur, best
    FROM public.learning_streaks WHERE user_id = NEW.user_id;
  IF NOT FOUND THEN
    INSERT INTO public.learning_streaks (user_id, current_streak, longest_streak, last_activity_date)
    VALUES (NEW.user_id, 1, 1, NEW.activity_date);
    RETURN NEW;
  END IF;
  IF prev = NEW.activity_date THEN RETURN NEW; END IF;
  IF prev = NEW.activity_date - 1 THEN cur := cur + 1; ELSE cur := 1; END IF;
  IF cur > best THEN best := cur; END IF;
  UPDATE public.learning_streaks
    SET current_streak = cur, longest_streak = best, last_activity_date = NEW.activity_date
    WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_bump_streak AFTER INSERT ON public.learning_activity
  FOR EACH ROW EXECUTE FUNCTION public.bump_streak();

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'announcement',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "notif update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif insert staff" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR user_id = auth.uid());

CREATE INDEX ON public.modules (course_id, sort_order);
CREATE INDEX ON public.lessons (module_id, sort_order);
CREATE INDEX ON public.lesson_progress (user_id);
CREATE INDEX ON public.learning_activity (user_id, activity_date);

-- SEED
INSERT INTO public.courses (id, slug, title, description, category, duration_weeks, sort_order) VALUES
 ('11111111-1111-4111-8111-111111111111','data-analysis','Data Analysis Program','Master Excel, SQL, Power BI, Python and AI for analytics with hands-on projects and real datasets.','Data Analytics',12,1),
 ('22222222-2222-4222-8222-222222222222','business-analytics','Business Analytics Essentials','Turn business questions into measurable insights with structured analysis frameworks.','Business',6,2);

INSERT INTO public.modules (id, course_id, title, description, sort_order) VALUES
 ('a0000001-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Introduction to Data Analysis','What data analysis is, the workflow, and the analyst mindset.',1),
 ('a0000002-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','Excel for Analysts','Formulas, lookups, pivot tables and dashboards.',2),
 ('a0000003-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','SQL','Querying relational databases with confidence.',3),
 ('a0000004-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','Power BI','Modelling and building interactive reports.',4),
 ('a0000005-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111','Python for Data','Pandas, cleaning and analysis in Python.',5),
 ('a0000006-0000-4000-8000-000000000006','11111111-1111-4111-8111-111111111111','Data Visualization','Charts that tell the truth clearly.',6),
 ('a0000007-0000-4000-8000-000000000007','11111111-1111-4111-8111-111111111111','AI for Data Analysis','Using AI tools responsibly in your analysis workflow.',7),
 ('a0000008-0000-4000-8000-000000000008','11111111-1111-4111-8111-111111111111','Final Project','End-to-end analysis and presentation.',8),
 ('b0000001-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Business Metrics','KPIs that actually matter.',1),
 ('b0000002-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','Reporting & Storytelling','Presenting findings to decision makers.',2);

INSERT INTO public.lessons (module_id, title, description, content, duration_minutes, sort_order) VALUES
 ('a0000001-0000-4000-8000-000000000001','What is Data Analysis?','The role of an analyst and the end-to-end workflow.','Data analysis turns raw records into decisions. In this lesson you will learn the six stages: ask, collect, clean, analyse, visualise and communicate.',15,1),
 ('a0000001-0000-4000-8000-000000000001','Types of Data','Qualitative, quantitative, structured and unstructured data.','Understanding data types determines which analysis techniques are valid.',18,2),
 ('a0000001-0000-4000-8000-000000000001','The Analysis Workflow','A repeatable process you will use in every project.','Define the question, prepare data, explore, model, and present.',20,3),
 ('a0000002-0000-4000-8000-000000000002','Excel Foundations','Navigating, formatting and structuring worksheets.','Clean spreadsheet structure is the foundation of reliable analysis.',22,1),
 ('a0000002-0000-4000-8000-000000000002','Essential Formulas','SUM, IF, COUNTIFS, SUMIFS and text functions.','Formulas are how you express business logic in Excel.',25,2),
 ('a0000002-0000-4000-8000-000000000002','VLOOKUP and XLOOKUP','Joining data across tables.','Lookups let you combine information from separate sheets.',24,3),
 ('a0000002-0000-4000-8000-000000000002','Pivot Tables & Dashboards','Summarising thousands of rows in seconds.','Build a sales dashboard from a raw transaction export.',30,4),
 ('a0000003-0000-4000-8000-000000000003','Databases and Tables','How relational data is organised.','Rows, columns, keys and relationships.',18,1),
 ('a0000003-0000-4000-8000-000000000003','SELECT and WHERE','Retrieving and filtering records.','Your first queries against a sales database.',22,2),
 ('a0000003-0000-4000-8000-000000000003','JOINs','Combining data from multiple tables.','Inner, left, right and full joins explained visually.',26,3),
 ('a0000003-0000-4000-8000-000000000003','GROUP BY and Aggregate Functions','Summarising data with SQL.','COUNT, SUM, AVG, MIN, MAX with GROUP BY and HAVING.',28,4),
 ('a0000004-0000-4000-8000-000000000004','Getting Started with Power BI','The Power BI interface and data import.','Connect to Excel and CSV sources.',20,1),
 ('a0000004-0000-4000-8000-000000000004','Data Modelling','Relationships and star schemas.','Model your tables before you build visuals.',26,2),
 ('a0000004-0000-4000-8000-000000000004','DAX Basics','Measures and calculated columns.','Write your first DAX measures.',24,3),
 ('a0000005-0000-4000-8000-000000000005','Python Setup','Notebooks and the analytics toolkit.','Install and run your first notebook.',20,1),
 ('a0000005-0000-4000-8000-000000000005','Pandas Fundamentals','DataFrames, selection and filtering.','Load a CSV and explore it with pandas.',28,2),
 ('a0000005-0000-4000-8000-000000000005','Cleaning Messy Data','Missing values, duplicates and types.','Real datasets are never clean.',30,3),
 ('a0000006-0000-4000-8000-000000000006','Choosing the Right Chart','Matching visuals to questions.','Bar, line, scatter and when not to use pie charts.',18,1),
 ('a0000006-0000-4000-8000-000000000006','Designing Clear Dashboards','Layout, colour and hierarchy.','Design principles for readable reports.',22,2),
 ('a0000007-0000-4000-8000-000000000007','AI in the Analyst Workflow','Where AI helps and where it misleads.','Practical, responsible uses of AI assistants.',20,1),
 ('a0000007-0000-4000-8000-000000000007','Prompting for Analysis','Getting useful output from AI tools.','Structured prompting for data tasks.',22,2),
 ('a0000008-0000-4000-8000-000000000008','Project Brief','Your capstone analysis.','Choose a dataset and define your question.',15,1),
 ('a0000008-0000-4000-8000-000000000008','Presenting Your Findings','Telling the story behind the numbers.','Build and deliver a five-minute analysis presentation.',30,2),
 ('b0000001-0000-4000-8000-000000000001','Defining KPIs','Metrics tied to business outcomes.','Choosing measures leadership will act on.',20,1),
 ('b0000001-0000-4000-8000-000000000001','Cohorts and Retention','Measuring customer behaviour over time.','Build a simple retention analysis.',25,2),
 ('b0000002-0000-4000-8000-000000000002','Structuring a Report','From findings to recommendations.','A repeatable report template.',20,1);
