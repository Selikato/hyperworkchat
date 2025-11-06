-- Enable Row Level Security
-- Note: app.jwt_secret is automatically handled by Supabase

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS selected_students CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS work_sessions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS work_days CASCADE;

-- Create custom types
CREATE TYPE user_role AS ENUM ('student', 'teacher');
CREATE TYPE work_days AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role user_role NOT NULL,
  class_section TEXT, -- e.g., "6/A", "6/B"
  work_days work_days[] DEFAULT '{}',
  daily_work_minutes INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Work sessions table
CREATE TABLE work_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  planned_duration INTEGER NOT NULL, -- in minutes
  actual_duration INTEGER DEFAULT 0, -- in minutes
  points_earned INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  was_paused BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Messages table for DM chat
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  -- Ensure users can't send messages to themselves
  CHECK (user_id != receiver_id)
);

-- Selected students table for teachers
CREATE TABLE selected_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  class_section TEXT NOT NULL,
  selected_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(teacher_id, student_id)
);

-- Row Level Security Policies

-- Profiles policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id OR auth.uid() IS NULL OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Work sessions policies
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own work sessions" ON work_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own work sessions" ON work_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own work sessions" ON work_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Messages policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their DM messages" ON messages
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send DM messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Selected students policies
ALTER TABLE selected_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view their selected students" ON selected_students
  FOR SELECT USING (
    auth.uid() = teacher_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  );

CREATE POLICY "Teachers can insert selected students" ON selected_students
  FOR INSERT WITH CHECK (
    auth.uid() = teacher_id AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
  );

-- Functions and Triggers

-- Function to handle new user signup (simplified)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Trigger SECURITY DEFINER ile çalışır, RLS bypass eder
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (NEW.id, '', '', 'student'::user_role)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Manual profile creation function (for fallback when trigger fails)
CREATE OR REPLACE FUNCTION public.create_profile_manual(
  user_id UUID,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  user_role user_role DEFAULT 'student',
  class_section TEXT DEFAULT NULL,
  work_days TEXT[] DEFAULT ARRAY[]::TEXT[],
  daily_work_minutes INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  -- SECURITY DEFINER ile RLS'yi bypass eder
  INSERT INTO public.profiles (
    id, first_name, last_name, role, class_section, work_days, daily_work_minutes
  ) VALUES (
    user_id, first_name, last_name, user_role, class_section, work_days, daily_work_minutes
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role,
    class_section = EXCLUDED.class_section,
    work_days = EXCLUDED.work_days,
    daily_work_minutes = EXCLUDED.daily_work_minutes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on profiles
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
