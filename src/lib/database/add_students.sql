-- SUPABASE VERİLERİNİ TAMAMEN TEMİZLEME SCRIPTİ - TÜM VERİLERİ SİLER!
-- Bu script tüm kullanıcıları, profilleri ve mesajları siler

-- Önce RLS'yi devre dışı bırak (temizlik için)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE selected_students DISABLE ROW LEVEL SECURITY;

-- Tüm verileri sırayla sil (foreign key constraints için)
DELETE FROM messages;
DELETE FROM selected_students;
DELETE FROM profiles;

-- TÜM auth.users kayıtlarını sil! (DİKKAT: Bu tüm kullanıcıları siler!)
DELETE FROM auth.users;

-- RLS'yi tekrar aktif et
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE selected_students ENABLE ROW LEVEL SECURITY;

-- Temizlik sonrası kontrol
SELECT 'Users count:' as info, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'Profiles count:', COUNT(*) FROM profiles
UNION ALL
SELECT 'Messages count:', COUNT(*) FROM messages
UNION ALL
SELECT 'Selected students count:', COUNT(*) FROM selected_students;

-- Öğrenci listesi kontrol
SELECT
  COUNT(*) as total_students,
  COUNT(CASE WHEN last_name = '' THEN 1 END) as single_name_students,
  COUNT(CASE WHEN last_name != '' THEN 1 END) as full_name_students
FROM profiles
WHERE role = 'student';

-- Öğrenci listesini göster
SELECT first_name, last_name, role, class_section
FROM profiles
WHERE role = 'student'
ORDER BY first_name, last_name;
