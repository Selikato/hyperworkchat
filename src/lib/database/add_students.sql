-- Öğrencileri yeniden ekleme scripti
-- Önce mevcut öğrenci kayıtlarını temizle ve mesajları sıfırla

-- Mesajları temizle (gereksiz mesajlar için)
DELETE FROM messages;

-- RLS'yi geçici olarak devre dışı bırak
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Mevcut öğrenci kayıtlarını sil
DELETE FROM profiles WHERE role = 'student';
DELETE FROM auth.users WHERE email LIKE 'student%@test.com';

-- Öğrenciler için test auth.users kayıtları oluştur - Rastgele UUID'lerle
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'student1@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Ahmet", "last_name": "Yavuz"}'),
  ('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'student2@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Ahmet", "last_name": "Hamza"}'),
  ('6ba7b811-9dad-11d1-80b4-00c04fd430c8', 'student3@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Berat", "last_name": ""}'),
  ('6ba7b812-9dad-11d1-80b4-00c04fd430c8', 'student4@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Çetin", "last_name": "Ali"}'),
  ('6ba7b813-9dad-11d1-80b4-00c04fd430c8', 'student5@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Ekrem", "last_name": ""}'),
  ('6ba7b814-9dad-11d1-80b4-00c04fd430c8', 'student6@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Emir", "last_name": ""}'),
  ('6ba7b815-9dad-11d1-80b4-00c04fd430c8', 'student7@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Eymen", "last_name": ""}'),
  ('6ba7b816-9dad-11d1-80b4-00c04fd430c8', 'student8@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Kayra", "last_name": "Emir"}'),
  ('6ba7b817-9dad-11d1-80b4-00c04fd430c8', 'student9@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Talha", "last_name": ""}'),
  ('6ba7b818-9dad-11d1-80b4-00c04fd430c8', 'student10@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Muhammed", "last_name": "Kerem(KETO)"}'),
  ('6ba7b819-9dad-11d1-80b4-00c04fd430c8', 'student11@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Ömer", "last_name": ""}'),
  ('6ba7b820-9dad-11d1-80b4-00c04fd430c8', 'student12@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Ömer", "last_name": "Asaf"}'),
  ('6ba7b821-9dad-11d1-80b4-00c04fd430c8', 'student13@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Selim", "last_name": "Kaan"}'),
  ('6ba7b822-9dad-11d1-80b4-00c04fd430c8', 'student14@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Yavuz", "last_name": "Selim"}'),
  ('6ba7b823-9dad-11d1-80b4-00c04fd430c8', 'student15@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Yusuf", "last_name": ""}'),
  ('6ba7b824-9dad-11d1-80b4-00c04fd430c8', 'student16@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Onur", "last_name": "Enes"}'),
  ('6ba7b825-9dad-11d1-80b4-00c04fd430c8', 'student17@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "İshak", "last_name": ""}'),
  ('6ba7b826-9dad-11d1-80b4-00c04fd430c8', 'student18@test.com', '$2a$10$dummy.hash.for.test', NOW(), NOW(), NOW(), '{"first_name": "Hamza", "last_name": ""}');

-- Şimdi profiles tablosuna öğrenci kayıtlarını ekle
INSERT INTO profiles (id, first_name, last_name, role, class_section, work_days, daily_work_minutes)
VALUES
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Ahmet', 'Yavuz', 'student', 'A', '{}', 0),
  ('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'Ahmet', 'Hamza', 'student', 'A', '{}', 0),
  ('6ba7b811-9dad-11d1-80b4-00c04fd430c8', 'Berat', '', 'student', 'A', '{}', 0),
  ('6ba7b812-9dad-11d1-80b4-00c04fd430c8', 'Çetin', 'Ali', 'student', 'A', '{}', 0),
  ('6ba7b813-9dad-11d1-80b4-00c04fd430c8', 'Ekrem', '', 'student', 'A', '{}', 0),
  ('6ba7b814-9dad-11d1-80b4-00c04fd430c8', 'Emir', '', 'student', 'A', '{}', 0),
  ('6ba7b815-9dad-11d1-80b4-00c04fd430c8', 'Eymen', '', 'student', 'A', '{}', 0),
  ('6ba7b816-9dad-11d1-80b4-00c04fd430c8', 'Kayra', 'Emir', 'student', 'A', '{}', 0),
  ('6ba7b817-9dad-11d1-80b4-00c04fd430c8', 'Talha', '', 'student', 'A', '{}', 0),
  ('6ba7b818-9dad-11d1-80b4-00c04fd430c8', 'Muhammed', 'Kerem(KETO)', 'student', 'A', '{}', 0),
  ('6ba7b819-9dad-11d1-80b4-00c04fd430c8', 'Ömer', '', 'student', 'A', '{}', 0),
  ('6ba7b820-9dad-11d1-80b4-00c04fd430c8', 'Ömer', 'Asaf', 'student', 'A', '{}', 0),
  ('6ba7b821-9dad-11d1-80b4-00c04fd430c8', 'Selim', 'Kaan', 'student', 'A', '{}', 0),
  ('6ba7b822-9dad-11d1-80b4-00c04fd430c8', 'Yavuz', 'Selim', 'student', 'A', '{}', 0),
  ('6ba7b823-9dad-11d1-80b4-00c04fd430c8', 'Yusuf', '', 'student', 'A', '{}', 0),
  ('6ba7b824-9dad-11d1-80b4-00c04fd430c8', 'Onur', 'Enes', 'student', 'A', '{}', 0),
  ('6ba7b825-9dad-11d1-80b4-00c04fd430c8', 'İshak', '', 'student', 'A', '{}', 0),
  ('6ba7b826-9dad-11d1-80b4-00c04fd430c8', 'Hamza', '', 'student', 'A', '{}', 0);

-- RLS'yi tekrar aktif et
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

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
