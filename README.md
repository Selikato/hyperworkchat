# HyperWorkChat - Ödev Çalışma Uygulaması

Modern, responsive ve Türkçe bir ödev çalışma uygulaması. Next.js, Supabase ve TailwindCSS ile geliştirilmiştir.

## ✨ Özellikler

### 🎯 Temel Özellikler
- **Pomodoro Timer**: 20 dakika çalışma + 5 dakika mola sistemi
- **Puanlama Sistemi**: Düzenli çalışma için 100/50/0 puan
- **Realtime Chat**: Öğretmen ve öğrenciler arası canlı mesajlaşma
- **Lider Tablosu**: Öğrenciler ve öğretmenler için ayrı sıralamalar
- **Rol Bazlı Erişim**: Öğrenci ve öğretmen rolleri

### 👨‍🎓 Öğrenci Özellikleri
- Pomodoro çalışma timer'ı
- Kişisel çalışma istatistikleri
- Profil yönetimi
- Çalışma geçmişi
- Genel sohbet katılımı

### 👨‍🏫 Öğretmen Özellikleri
- Öğrenci seçme paneli (sınıf bazlı rastgele seçim)
- Öğrenci istatistiklerine erişim
- Genel sohbet moderasyonu
- Sınıf yönetimi

## 🚀 Kurulum ve Çalıştırma

### 1. Gereksinimler
- Node.js 18+
- npm veya yarn

### 2. Projeyi Klonlayın
```bash
git clone <repository-url>
cd hyperworkchat
```

### 3. Bağımlılıkları Yükleyin
```bash
npm install
```

### 4. Supabase Kurulumu

#### a. Supabase Proje Oluşturun
1. [Supabase](https://supabase.com) hesabınıza giriş yapın
2. Yeni bir proje oluşturun
3. Proje ayarlarından URL ve API anahtarlarını alın

#### b. Environment Variables
`.env.local` dosyasını oluşturun ve aşağıdaki bilgileri ekleyin:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

#### c. Database Schema
Supabase SQL Editor'da `src/lib/database/schema.sql` dosyasının içeriğini çalıştırın.

### 5. Uygulamayı Başlatın
```bash
npm run dev
```

Uygulama http://localhost:3000 adresinde çalışacaktır.

## 🏗️ Teknik Altyapı

### Frontend
- **Next.js 15**: React framework
- **TypeScript**: Tip güvenliği
- **TailwindCSS**: Utility-first CSS framework
- **Responsive Design**: Mobil uyumlu tasarım

### Backend & Database
- **Supabase**: PostgreSQL database, Auth, Realtime
- **Row Level Security**: Veri güvenliği
- **Realtime Subscriptions**: Canlı chat

### Ana Bileşenler
- `AuthContext`: Kullanıcı yönetimi
- `PomodoroTimer`: Çalışma timer'ı
- `Chat`: Realtime mesajlaşma
- `Leaderboard`: Puan sıralaması
- `TeacherPanel`: Öğretmen kontrol paneli

## 📁 Proje Yapısı
```
src/
├── app/                    # Next.js app router
│   ├── layout.tsx         # Ana layout
│   └── page.tsx           # Ana sayfa
├── components/            # UI bileşenleri
│   ├── AuthModal.tsx      # Giriş/kayıt modal'ı
│   ├── Chat.tsx          # Sohbet bileşeni
│   ├── Dashboard.tsx     # Ana dashboard
│   ├── Leaderboard.tsx   # Lider tablosu
│   ├── Navigation.tsx    # Navigasyon
│   ├── PomodoroTimer.tsx # Timer bileşeni
│   ├── Profile.tsx       # Profil sayfası
│   ├── TeacherPanel.tsx  # Öğretmen paneli
│   └── WorkHistory.tsx   # Çalışma geçmişi
├── contexts/             # React contexts
│   └── AuthContext.tsx   # Auth context
└── lib/                  # Yardımcı kütüphaneler
    ├── database/         # Database şeması ve tipler
    └── supabase.ts       # Supabase client
```

## 🔧 Yapılandırma

### Database Tabloları
- `profiles`: Kullanıcı profilleri
- `work_sessions`: Çalışma oturumları
- `messages`: Chat mesajları
- `selected_students`: Öğretmenlerin seçtiği öğrenciler

### Güvenlik Politikaları
- Kullanıcılar sadece kendi verilerini görebilir ve düzenleyebilir
- Öğretmenler öğrenci istatistiklerine erişebilir
- Tüm mesajlar genel sohbet için herkese açık

## 📱 Kullanım

### Öğrenci Kaydı
1. Ana sayfadan "Kayıt Ol" butonuna tıklayın
2. Kişisel bilgileri girin
3. Rol olarak "Öğrenci" seçin
4. Sınıf ve çalışma tercihlerini belirtin

### Öğretmen Kaydı
1. Ana sayfadan "Kayıt Ol" butonuna tıklayın
2. Rol olarak "Öğretmen" seçin
3. Kayıt sonrası öğretmen paneline erişim

### Çalışma Sistemi
1. Ana sayfadan timer'ı başlatın
2. 20 dakika çalışın
3. 5 dakika mola verin
4. Puanlar otomatik hesaplanır

## 🚀 Deployment

### Vercel Deployment
1. [Vercel](https://vercel.com) hesabınıza bağlanın
2. Projeyi import edin
3. Environment variables'ları ayarlayın
4. Deploy edin

### Environment Variables (Vercel)
Vercel dashboard'dan şu değişkenleri ekleyin:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 📞 İletişim

Sorularınız için issue açabilir veya [email] adresinden iletişime geçebilirsiniz.

---

**Geliştirici**: AI Assistant
**Teknoloji**: Next.js + Supabase + TailwindCSS
**Durum**: ✅ Production Ready