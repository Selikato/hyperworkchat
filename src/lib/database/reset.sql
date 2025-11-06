-- Database Reset Script - Sadece verileri temizle, şemayı koru

-- 1. Foreign key constraint'leri geçici olarak kaldır
ALTER TABLE work_sessions DROP CONSTRAINT work_sessions_user_id_fkey;
ALTER TABLE messages DROP CONSTRAINT messages_user_id_fkey;
ALTER TABLE selected_students DROP CONSTRAINT selected_students_teacher_id_fkey;
ALTER TABLE selected_students DROP CONSTRAINT selected_students_student_id_fkey;

-- 2. Tüm verileri temizle
TRUNCATE TABLE selected_students CASCADE;
TRUNCATE TABLE messages CASCADE;
TRUNCATE TABLE work_sessions CASCADE;
TRUNCATE TABLE profiles CASCADE;

-- 2.5. Messages tablosuna receiver_id alanı ekle (eğer yoksa)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Constraint varsa kaldır, sonra yeniden ekle
ALTER TABLE messages DROP CONSTRAINT IF EXISTS check_different_users;
ALTER TABLE messages ADD CONSTRAINT check_different_users CHECK (user_id != receiver_id);

-- 3. Foreign key constraint'leri geri ekle
ALTER TABLE work_sessions ADD CONSTRAINT work_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE selected_students ADD CONSTRAINT selected_students_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE selected_students ADD CONSTRAINT selected_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. Row Level Security politikalarını yeniden uygula
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE selected_students ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Work sessions policies
DROP POLICY IF EXISTS "Users can view their own work sessions" ON work_sessions;
DROP POLICY IF EXISTS "Users can insert their own work sessions" ON work_sessions;
DROP POLICY IF EXISTS "Users can update their own work sessions" ON work_sessions;

CREATE POLICY "Users can view their own work sessions" ON work_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own work sessions" ON work_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own work sessions" ON work_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Messages policies
DROP POLICY IF EXISTS "Users can view all messages" ON messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
DROP POLICY IF EXISTS "Users can view their DM messages" ON messages;
DROP POLICY IF EXISTS "Users can send DM messages" ON messages;

CREATE POLICY "Users can view their DM messages" ON messages FOR SELECT USING (auth.uid() = user_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send DM messages" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Selected students policies
DROP POLICY IF EXISTS "Teachers can view their selected students" ON selected_students;
DROP POLICY IF EXISTS "Teachers can insert selected students" ON selected_students;

CREATE POLICY "Teachers can view their selected students" ON selected_students FOR SELECT USING (auth.uid() = teacher_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'));
CREATE POLICY "Teachers can insert selected students" ON selected_students FOR INSERT WITH CHECK (auth.uid() = teacher_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'));

-- 5. Trigger'ları yeniden oluştur
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role_enum user_role := 'student';
BEGIN
  -- Yeni kullanıcı için profil oluştur
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (NEW.id, '', '', user_role_enum)
  ON CONFLICT (id) DO NOTHING;

  -- User preferences oluştur
  INSERT INTO public.user_preferences (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  -- User stats cache oluştur
  INSERT INTO public.user_stats_cache (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Updated_at trigger function
DROP TRIGGER IF EXISTS set_updated_at ON profiles;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- User preferences/settings tablosu (database'i doldurmadan özellik eklemek için)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  theme TEXT DEFAULT 'light', -- light/dark (ama biz sadece light kullanıyoruz)
  notifications_enabled BOOLEAN DEFAULT true,
  language TEXT DEFAULT 'tr',
  timezone TEXT DEFAULT 'Europe/Istanbul',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- User statistics cache (performans için)
CREATE TABLE IF NOT EXISTS user_stats_cache (
  id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  total_sessions INTEGER DEFAULT 0,
  total_minutes INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Achievement definitions (minimal)
CREATE TABLE IF NOT EXISTS achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT DEFAULT '🏆',
  points_required INTEGER DEFAULT 0,
  type TEXT DEFAULT 'points', -- points, streak, sessions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- User achievements (junction table)
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, achievement_id)
);

-- RLS policies for new tables
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- User preferences policies
CREATE POLICY "Users can view their own preferences" ON user_preferences FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = id);

-- User stats cache policies
CREATE POLICY "Users can view their own stats cache" ON user_stats_cache FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own stats cache" ON user_stats_cache FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own stats cache" ON user_stats_cache FOR UPDATE USING (auth.uid() = id);

-- Achievements policies (everyone can read)
CREATE POLICY "Everyone can view achievements" ON achievements FOR SELECT USING (true);

-- User achievements policies
CREATE POLICY "Users can view their own achievements" ON user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own achievements" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Insert some basic achievements
INSERT INTO achievements (name, description, points_required, type) VALUES
('İlk Adım', 'İlk çalışma oturumunu tamamladın!', 1, 'sessions'),
('Çalışkan Öğrenci', '100 puan kazandın!', 100, 'points'),
('Uzun Soluklu', '5 gün üst üste çalıştın!', 5, 'streak'),
('Süper Yıldız', '500 puan kazandın!', 500, 'points'),
('Maratoncu', '10 çalışma oturumu tamamladın!', 10, 'sessions')
ON CONFLICT DO NOTHING;

-- Function to update user stats cache
CREATE OR REPLACE FUNCTION update_user_stats_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stats cache when work sessions change
  INSERT INTO user_stats_cache (id, total_sessions, total_minutes, total_points, current_streak, best_streak, last_updated)
  SELECT
    p.id,
    COUNT(ws.id) as total_sessions,
    COALESCE(SUM(ws.actual_duration), 0) as total_minutes,
    COALESCE(SUM(ws.points_earned), 0) as total_points,
    0 as current_streak, -- TODO: Calculate streak
    0 as best_streak,    -- TODO: Calculate best streak
    NOW()
  FROM profiles p
  LEFT JOIN work_sessions ws ON ws.user_id = p.id AND ws.is_completed = true
  WHERE p.id = COALESCE(NEW.user_id, OLD.user_id)
  GROUP BY p.id
  ON CONFLICT (id) DO UPDATE SET
    total_sessions = EXCLUDED.total_sessions,
    total_minutes = EXCLUDED.total_minutes,
    total_points = EXCLUDED.total_points,
    last_updated = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for updating stats cache
CREATE TRIGGER update_stats_cache_trigger
  AFTER INSERT OR UPDATE OR DELETE ON work_sessions
  FOR EACH ROW EXECUTE PROCEDURE update_user_stats_cache();

-- Function to check and unlock achievements
CREATE OR REPLACE FUNCTION check_achievements()
RETURNS TRIGGER AS $$
DECLARE
  user_id_val UUID;
  user_stats RECORD;
BEGIN
  user_id_val := COALESCE(NEW.user_id, OLD.user_id);

  -- Get user stats
  SELECT * INTO user_stats FROM user_stats_cache WHERE id = user_id_val;

  IF user_stats IS NOT NULL THEN
    -- Check and unlock achievements based on stats
    -- First session achievement
    IF user_stats.total_sessions >= 1 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      SELECT user_id_val, id FROM achievements WHERE name = 'İlk Adım'
      ON CONFLICT DO NOTHING;
    END IF;

    -- Points achievements
    IF user_stats.total_points >= 100 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      SELECT user_id_val, id FROM achievements WHERE name = 'Çalışkan Öğrenci'
      ON CONFLICT DO NOTHING;
    END IF;

    IF user_stats.total_points >= 500 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      SELECT user_id_val, id FROM achievements WHERE name = 'Süper Yıldız'
      ON CONFLICT DO NOTHING;
    END IF;

    -- Sessions achievement
    IF user_stats.total_sessions >= 10 THEN
      INSERT INTO user_achievements (user_id, achievement_id)
      SELECT user_id_val, id FROM achievements WHERE name = 'Maratoncu'
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for checking achievements
CREATE TRIGGER check_achievements_trigger
  AFTER INSERT OR UPDATE ON user_stats_cache
  FOR EACH ROW EXECUTE PROCEDURE check_achievements();

-- Message cleanup kaldırıldı - artık tüm mesajlar korunacak
-- Eski mesajlar performans için virtual scrolling ile yönetilecek
