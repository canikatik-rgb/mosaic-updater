# Mosaic - Future Goals & Vision

## 🚀 Vision: Mosaic (The Virtual Office)

Mosaic, bir otomasyon aracından evrilerek, **"Sanal Ofis" (Virtual Office)** ve **"Gerçek Uzak Çalışma Alanı" (Real Remote Workspace)** olarak konumlanmaktadır.

> **Yeni Vizyon:** Ekiplerin üzerinde beraber yaşadığı, konuştuğu, dosya paylaştığı ve çalıştığı sonsuz, canlı bir dijital ofis zemini. "Ofisinizi bir node tuvaline dönüştürün."

---

## 🏗️ Architectural Pillars (The Big 4)

### 1. Real-time Presence & Communication 🗣️
- **Discord-like Voice Channels:** Girilip çıkılabilen ses odaları.
- **Persistent Group Chat:** Proje içi kalıcı sohbet geçmişi.

### 2. Semantic Data Protocol (SDP) 🧠 ✅ IMPLEMENTED
- Her veri tipinin (SVG, Image, Text, JSON) zengin bir **Meta-Obje** olarak tanımlanması.
- Protokol dokümantasyonu: `Semantic_Protocol.md`

### 3. P2P Workspace (Local-First) 🏠
- **Local Doc Manager:** Dosyaların sunucuya uğramadan paylaşıldığı yapı.
- **Offline First:** İnternet yokken bile çalışma imkanı.

### 4. Bi-directional Automation (Legacy RPA) 🤖 🔄 PAUSED
- Node'ların hedef sitelere veri yazabilmesi (İkincil öncelik).

---

## 🛠️ CRITICAL BACKLOG (Immediate Fixes)

Yeni vizyona geçmeden önce sağlamlaştırılması gereken temel taşlar:

- [ ] **Inter-node Communication:** Node'lar arası veri akışının %100 kararlı hale getirilmesi.
- [ ] **WEB Inspector:** URL Node veri çekme hatalarının giderilmesi.
- [x] **Node Color:** Renk değiştirme özelliğinin düzeltilmesi.
- [x] **Objects Panel:** ✅ Title bar'a taşındı, navigation düzeltildi, dropdown çalışıyor.
- [ ] **History System Refactor:** Tüm hareketlerin (renk, konum, boyut) kayda alınması.
- [ ] **Electron Updater:** Dev/Prod ayrımı ve otomatik güncelleme altyapısının kurulması.

### Recently Completed ✅ (January 2026)
- [x] **Objects Panel Navigation:** Sequential navigation, dropdown, focus mode navigation
- [x] **Focus Mode Improvements:** Smooth node transitions, responsive I/O panels (initially pinned), preserved node dimensions on exit
- [x] **Title Bar Polish:** Share button hidden when no project, Objects Panel flows with titlebar-left
- [x] **Auth State Bug:** Fixed sidebar/dashboard auto-show on app focus (Supabase token refresh issue)
- [x] **Browser Fingerprint Spoofing:** Google/Figma/Adobe login works without security warnings
- [x] **I/O Panel Data Flow:** Incoming panel only shows connected node data, Outgoing shows self-produced data
- [x] **URL Node Default Dimensions:** 700x550 for better web content display
- [x] **Max Width:** 800px → 1400px for wide web content

### URL Node Browser UX 🌐

> **Hedef:** URL Node'lar gerçek bir tarayıcı gibi kullanılabilmeli.

#### Completed ✅
- [x] **Context Menu (Sağ-Click):** Right-click on images/SVG/text → "Add to Outgoing" or "Copy"
- [x] **Swipe Back/Forward:** Two-finger horizontal swipe for history navigation
- [x] **Pinch Zoom:** Ctrl+wheel for macOS trackpad pinch, Alt+wheel for manual zoom
- [x] **Keyboard Zoom:** Cmd+/Cmd-/Cmd+0 for zoom in/out/reset

#### Pending 🔄
- [x] **Webview → Panel Drag-Drop:** Drag image/SVG directly to Outgoing panel
- [x] **Cmd+V to Outgoing:** Paste clipboard content to Outgoing panel in focus mode
- [ ] **Panel → External App Drag:** Native file drag via Phase 4.6 File-backed Data Cards
- [ ] **URL Node Streaming:** P2P video stream of user's URL Node for multiplayer
- [ ] **Download Interception:** Otomatik olarak indirmeleri veri kartı olarak yakalama

---

## 📋 Mosaic 2.0 Roadmap

### Phase 1: Foundation ✅ COMPLETE
- [x] IPC & MessageChannel iletişim altyapısı
- [x] SDP şema tanımlaması
- [x] Node giriş/çıkış veri tipi validasyonu

### Phase 2: Data Intelligence ✅ COMPLETE
- [x] Otomatik veri analizi (Smart Parsing)
- [x] Metadata extraction (source, timestamp, selector)

### Phase 3: Native Experience (Pending)
- [ ] Frameless window (MacOS hiddenInset)
- [ ] Code signing & notarization
- [ ] Auto-updater entegrasyonu

### Phase 4: The Robot - Bi-directional 🔄 IN PROGRESS
- [x] Temel injection (insertText, clipboard)
- [x] FindInPage stratejisi ile replace
- [ ] Puppet Scripts (click, type, scroll atomik eylemler)
- [ ] Flow/Chain Execution

### Phase 4.5: ZIP-Based Archive System 📦 IN PROGRESS

> **Amaç:** Monolitik JSON + Base64 yapısından, endüstri standardı ZIP archive yapısına geçiş.

#### Motivasyon
- JSON.parse RAM darboğazlarını aşmak
- Dosya boyutlarını optimize etmek  
- Görsel/medya için Lazy Loading altyapısı

#### Yeni Dosya Yapısı
```
filename.mosaic (ZIP Archive)
├── project.json    # Sadece state ve referanslar (KB boyutunda)
├── metadata.json   # Versiyon, yazar, tarih
├── preview.png     # OS dosya gezgini önizlemesi
└── assets/         # Binary dosyalar
    ├── img_uuid.png
    └── doc_uuid.pdf
```

#### Implementation Status
- [x] JSZip kütüphanesi eklendi
- [x] `asset-manager.js` - Base64↔Buffer dönüşümü
- [x] Electron IPC handlers (save-zip-file, open-zip-file, extract-asset)
- [x] `saveProjectElectron()` - ZIP olarak kaydetme
- [x] `openProjectElectron()` - ZIP/JSON format detection
- [ ] Lazy loading with IntersectionObserver
- [ ] Büyük dosyalar için streaming

---

### Phase 4.6: File-backed Data Cards 📁 ✅ COMPLETE

> **Status:** Implemented.
> **Summary:** Data cards now support file-backed storage for large content, images, and binary files. They are stored in the project structure and can be dragged out to external applications.

#### Implementation Details
- Hybrid content strategy (<10KB inline, >10KB file).
- `DataCardStore` manages file paths.
- Electron IPC `writeCardFile` handles disk I/O.
- Native drag-and-drop integration.

---

### Phase 5: Advanced P2P Collaboration (CURRENT FOCUS) 🚀

> **Amaç:** Gerçek zamanlı, sunucusuz ve sınırsız işbirliği.

#### 5.1 P2P Data Card Sync (Processing)
- [ ] **Binary Sync:** File-backed kartların diğer kullanıcılara aktarılması.
- [ ] **Request-on-Demand:** Büyük dosyaların sadece ihtiyaç duyulduğunda çekilmesi.

#### 5.2 Communication Channels
- [ ] **Text Chat:** Unified Bar üzerinde anlık mesajlaşma.
- [ ] **Voice Channels:** Discord benzeri ses odaları.

---

## 💉 Phase 6: Advanced Injection System v2 (Planned) - "Smart Binding"

> **Amaç:** Cross-origin uygulamalara (Google Docs, Figma, Translate vb.) güvenilir veri enjeksiyonu ve **canlı güncelleme**.

### Mimari Bileşenler

#### 1. Invisible Anchor Technique (marker)
- **HTML:** `<span data-mosaic-binding="id" contenteditable="false">\u200B</span>`
- **Text:** Zero-width space (`\u200B`) takibi ve context-anchor (önceki/sonraki kelimeler).

#### 2. Injection Registry (The Brain)
Merkezi store üzerinde hangi node'un hangi elemente veri bastığının kaydı:

```javascript
{
  bindingId: "bind_xyz123",
  sourceNodeId: "node_A",
  targetUrl: "https://docs.google.com/...",
  targetSelector: "[data-mosaic-binding='bind_xyz123']",
  lastValue: "Updated Text",
  status: "connected" | "broken"
}
```

#### 3. Live Update Loop
1.  **Source Change:** Mosaic Text Node değişir.
2.  **Lookup:** Registry'den etkilenen bindingler bulunur.
3.  **Target Update:** WebView'a `postMessage` ile `{ update: bindingId, content: newValue }` gönderilir.
4.  **Execute:** Preload script, sayfadaki marker'ı bulup DOM'u günceller.

### Strateji Matrisi

| İçerik | Same-Origin | Cross-Origin |
|--------|-------------|--------------|
| Text | ✅ Marker span | 🔍 FindInPage + Context Anchor |
| SVG/Image | ✅ Wrapper element | 📋 Clipboard + Marker Attribute |

### Implementation Tasks
- [ ] **Proof of Concept:** Test sayfasında marker'lı veri güncelleme
- [ ] **Injection Registry:** Data Store yapısının kurulması
- [ ] **Clipboard Hook:** Sürükle-bırak (Drag-to-Paste) sırasında veriye otomatik marker ekleyen logic
- [ ] **WebView Bridge:** `postMessage` ile spesifik update komutları
- [ ] **UI:** Bağlantı koptuğunda (marker silindiğinde) kullanıcıya uyarı (Broken Link)

---

## 🔒 Phase 6: Professional App Lifecycle (IN PROGRESS)

> **Amaç:** Uygulamanın güvenli açılışı, lisans kontrolü, otomatik güncellenmesi ve hatasız proje yükleme sırası.

### 1. Auto-Updater & Code Signing
- **Library:** `electron-updater` entegrasyonu.
- **Provider:** GitHub Releases (şimdilik), S3 (ileride).
- **Security:** macOS için Apple Notarization, Windows için EV Certificate desteği altyapısı.

### 2. Startup Flow (Splash Screen)
- **Splash Window:** Hafif, çerçevesiz, logo içeren pencere.
- **Boot Sequence:**
  1.  Network Check
  2.  Auth/License Check (Supabase)
  3.  Update Check (Auto-Updater)
  4.  Main Window Creation

### 3. Project Initialization (Robust Loading)
- **Lifecycle Manager:** `js/app-lifecycle.js`
- **Init Sequence:** Settings -> Canvas -> P2P -> Nodes.
- **Event:** `MOSAIC_READY` event'i ile tüm sistemi senkron başlatma.

---

## ✅ Completed Milestones

### Core Features
- [x] Node arası MessageChannel iletişimi
- [x] Semantic Data Protocol (SDP) implementation
- [x] 3D Canvas Node (Three.js) & Model Persistence
- [x] URL Node Inspector & Region Selection
- [x] Save Node (Export capabilities)
- [x] Presentation Mode

### Injection System v1
- [x] Cursor-based injection (insertText)
- [x] Marker-based tracking (contenteditable)
- [x] Range-based tracking (input/textarea)
- [x] FindInPage replace strategy
- [x] Duplicate update prevention

### UX & Polish
- [x] Sticker System
- [x] Focus Mode
- [x] Dark/Light theme

---

## 🌐 Phase 6: Backend Infrastructure & Monetization (PLANNED)

> **Amaç:** Kullanıcı yönetimi, gerçek zamanlı işbirliği ve ödeme sistemi entegrasyonu.

### 6.1 Authentication & User Management (Supabase)

#### Temel Özellikler
- [ ] **Email/Password Auth** - Supabase Auth ile signup/login
- [ ] **OAuth Providers** - Google, GitHub, Apple Sign-In
- [ ] **User Profiles** - Avatar, kullanıcı adı, tercihler
- [ ] **Session Management** - Token refresh, logout all devices

#### Electron Entegrasyonu
```javascript
// Main process: OAuth callback handling
protocol.registerHttpProtocol('mosaic', (request) => {
  const url = new URL(request.url);
  if (url.pathname === '/auth/callback') {
    // Supabase session token extraction
    mainWindow.webContents.send('auth-callback', url.searchParams);
  }
});
```

#### Database Schema (PostgreSQL)
```sql
-- users (Supabase Auth tarafından yönetilir)
-- profiles (ek kullanıcı bilgileri)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  username TEXT UNIQUE,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- projects (cloud-synced)
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id),
  name TEXT,
  data JSONB,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.2 Real-time Collaboration & Canvas Sharing (P2P-First) 🔄 IN PROGRESS

> **Yeni Mimari:** Sunucu maliyetlerini azaltmak ve gizliliği artırmak için P2P-first yaklaşım.

#### Mimari Genel Bakış

```
┌────────────────────────────────────────────────────────┐
│                  TÜM KULLANICILAR                       │
│  • WebRTC P2P paylaşım (host online iken)              │
│  • Operation-based sync (veri kaybı yok)               │
│  • Online/Offline toggle                                │
│  • Node locking (çakışma önleme)                       │
└────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────┐
│              PRO / TEAM (Opsiyonel)                     │
│  • Cloud backup & sync                                  │
│  • Offline link paylaşımı                              │
│  • Versiyon geçmişi                                    │
└────────────────────────────────────────────────────────┘
```

#### Operation-Based Sync (OT-Lite)

**Neden?** Full-project sync veri kaybına yol açar. Node-level operasyonlar merge edilir:

```javascript
// Operasyon Tipleri
{ op: 'ADD_NODE', nodeId: 'xyz', data: {...}, ts: 1234, userId: 'abc' }
{ op: 'UPDATE_NODE', nodeId: 'xyz', changes: { x: 100 }, ts: 1235 }
{ op: 'DELETE_NODE', nodeId: 'xyz', ts: 1236 }
```

| Çakışma Durumu | Çözüm |
|----------------|-------|
| Farklı node'lar ekleniyor | Hepsi eklenir |
| Aynı node güncelleniyor | Per-property LWW |
| Biri siliyor, biri güncelliyor | Silme kazanır (tombstone) |

#### Node Locking Kuralları

| Durum | Davranış |
|-------|----------|
| Bir kullanıcı node'a focus | Node kilitlenir, diğerleri düzenleyemez |
| URL Node | Sadece yaratan düzenleyebilir, diğerleri stream eder |
| Focus kaybı | Kilit 2 saniye sonra otomatik açılır |

#### Sharing Modes

| Mode | Free | Pro | Team |
|------|------|-----|------|
| P2P Paylaşım (host online) | ✅ | ✅ | ✅ |
| Cloud Backup | ❌ | ✅ | ✅ |
| Offline Link Paylaşımı | ❌ | ✅ | ✅ |
| Versiyon Geçmişi | ❌ | 30 gün | 90 gün |

### 6.3 Subscription Tiers & Monetization

#### 🟢 FREE (The Viral Hook)
**Amaç:** Ürünü denettirmek ve yayılmasını sağlamak.

| Özellik | Limit |
|---------|-------|
| **Cloud Projeleri** | 3 adet (Drafts) |
| **Lokal Projeler** | Sınırsız |
| **Collaboration** | 1 editör davet edebilir (sınırsız davet alabilir) |
| **Depolama** | 100 MB (Asset upload) |
| **RPA/Write Nodes** | ❌ Kullanılamaz (sadece dahili node'lar) |

**Kısıtlama Stratejisi:**
- "Get Pro" butonları arayüzde görünür
- Gelişmiş özellikler görünür ama kilitli

---

#### 🔵 PRO (The Power User)
**Amaç:** Freelancer ve bireysel profesyonelleri yakalamak.
**Fiyat:** $9/ay

| Özellik | Limit |
|---------|-------|
| **Cloud Projeleri** | Sınırsız |
| **Collaboration** | 5 editör davet edebilir |
| **Depolama** | 5 GB |
| **RPA/Write Nodes** | ✅ Tam erişim |

**Killer Features:**
- 🤖 **RPA/Write Node'ları**: Google Docs'a yazı yazma, Figma'ya enjeksiyon
- ⏪ **Version History**: 30 gün öncesine dönebilme

---

#### 🟣 TEAM (The Agency)
**Amaç:** Ajansları ve Şirketleri yakalamak (B2B).
**Fiyat:** $29/ay (10 kişilik lisans)

> **Fark:** Kapasite değil, **Yönetim ve Varlık Paylaşımı**!

| Özellik | Limit |
|---------|-------|
| **Cloud Projeleri** | Sınırsız |
| **Collaboration** | Sınırsız |
| **Depolama** | 50 GB (Team shared) |

**Killer Features:**
- 📁 **Shared Assets Library**: Takım lideri Logo/Font klasörü oluşturur, tüm ekip node'larda görür
  - **TODO:** Team Files Node implementasyonu gerekli
- 🔐 **Role Based Access**: "Sadece Görüntüle", "Yorum Yap", "Düzenle" yetkileri
- 💳 **Shared Billing**: Tek fatura, 10 kişilik lisans

---

#### Veritabanı Kullanım Stratejisi

| Kullanım | Free | Pro | Team |
|----------|------|-----|------|
| **Dosya Yedekleme** | ❌ Asla | ✅ Cloud backup | ✅ Cloud backup |
| **Multiplayer Sync** | ❌ | ❌ | ✅ |
| **AI Araçları** | ❌ | ✅ | ✅ |
| **Presentation Live URL** | ❌ | ✅ | ✅ |

> ⚠️ **ÖNEMLİ:** Free kullanıcı dosyaları hiçbir zaman veritabanına yedeklenmez (DB şişmesini önlemek için).

---

#### LemonSqueezy Webhook Integration
```javascript
// Main process: Webhook handler
app.post('/api/webhooks/lemonsqueezy', async (req, res) => {
  const event = req.body;
  
  switch (event.meta.event_name) {
    case 'subscription_created':
      await supabase.from('profiles')
        .update({ subscription_tier: 'pro' })
        .eq('email', event.data.attributes.user_email);
      break;
    case 'subscription_cancelled':
      // Downgrade to free
      break;
  }
});
```

#### Feature Gating
- [ ] Node limit kontrolü (Free: 50 node/proje)
- [ ] Cloud sync lock (Free: yerel, Pro+: cloud)
- [ ] AI özellikleri lock (Pro+)
- [ ] Multiplayer lock (Team)

### 6.5 Advanced Multiplayer Scenarios (PLANNED)
- [ ] **Local-Host Realtime (P2P)**:
    -   Dosya sunucuya yüklenmeden, doğrudan WebRTC/Relay üzerinden paylaşım.
    -   Host bilgisayar "Server" görevi görür.
    -   Gizlilik odaklı şirketler için "Zero-Cloud-Persistence" modu.

---

## 🗨️ Phase 7: Communication Layer (PLANNED)

> **Amaç:** Aktif çoklu kullanıcı oturumlarında real-time iletişim altyapısı.

### 7.1 P2P File Sharing 📁

Asset node'ları (video, zip, document) sadece yerel dosya yolları tutmak yerine P2P üzerinden paylaşılabilmeli.

#### Mimari
```
┌─────────────────────────────────────────────────┐
│  File Node (Host)                                │
│  - Local file: /videos/demo.mp4                  │
│  - Asset ID: asset_xyz789                        │
└───────────────────┬─────────────────────────────┘
                    │ WebRTC DataChannel
                    ▼
┌─────────────────────────────────────────────────┐
│  Guest Client                                    │
│  - Request: asset_xyz789                         │
│  - Streaming chunked transfer                    │
│  - Local cache → Blob URL                        │
└─────────────────────────────────────────────────┘
```

#### Implementation Tasks
- [ ] Asset request/response protocol over P2P
- [ ] Chunked binary transfer via DataChannel
- [ ] Progress indicator for large files
- [ ] Guest-side caching with IndexedDB
- [ ] On-demand streaming vs. full download option

### 7.2 Real-time Group Chat 💬

Unified Bar üzerinde yalnızca çoklu kullanıcı oturumlarında görünen chat paneli.

#### UI/UX
- Chat sadece **2+ kullanıcı** bağlıyken görünür
- Unified Bar'ın sağ tarafında collapsible panel
- Mesajlar akan şekilde gösterilir
- Typing indicator ve read receipts

#### Features
- [ ] Text messages with sender avatar
- [ ] @mention system (kullanıcı etiketleme)
- [ ] Emoji reactions
- [ ] Message timestamps
- [ ] Chat history (session-based, not persisted)

#### Protocol
```javascript
// P2P Message Types
{ type: 'CHAT_MESSAGE', from: userId, text: '...', ts: 1234 }
{ type: 'CHAT_TYPING', from: userId }
{ type: 'CHAT_REACTION', messageId: '...', emoji: '👍' }
{ type: 'CHAT_MENTION', mentionedUserId: '...', messageId: '...' }
```

### 7.3 Voice Chat (Discord-like) 🎙️

Ses kanalı aktivasyonu ile grup voice chat.

#### Features
- [ ] Push-to-talk or voice activation
- [ ] Speaking indicator (avatar glow)
- [ ] Mute/Deafen controls
- [ ] Volume mixer per user
- [ ] Spatial audio (optional - 3D canvas proximity)

#### Technical Stack
- WebRTC Audio streams
- getUserMedia() API
- AudioContext for processing
- PeerConnection per participant (mesh for small groups)

#### UI Components
- Voice channel join/leave button
- Participant list with speaking indicators
- Individual volume sliders
- Noise suppression toggle

### 7.3 Voice Chat (Discord-like) 🎙️

Ses kanalı aktivasyonu ile grup voice chat. "Ofiste olma" hissini yaratan temel özellik.

#### Features
- [ ] **Always-on Voice Room:** Tek tıkla gir, konuş, çık.
- [ ] **Push-to-talk / Voice Activity**
- [ ] **Speaking Indicator:** Konuşan kişinin avatarında visual feedback.
- [ ] **Screen Sharing:** Ses kanalındayken ekran paylaşımı (WebRTC).

---

## 📂 Phase 8: Virtual Office Essentials (NEW)

### 8.1 Local Document Manager Node
- **Amaç:** Dosya sunucusu kullanmadan büyük dosyaları P2P üzerinden paylaşmak.
- **Özellikler:**
    - Sürükle-bırak dosya paylaşımı.
    - Transfer durumu (ProgressBar).
    - "Download" veya "Open" seçenekleri.

### 8.2 Advanced P2P & Permissions
- **Yetkilendirme:**
    - `Viewer`: Sadece izler, düzenleyemez.
    - `Editor`: Tam yetki.
- **Offline Mode:** İnternet kopsa bile localde çalışmaya devam edebilme, bağlanınca sync olma.

---

### 6.6 Implementation Roadmap

#### Phase 6.1: Auth Foundation (2 hafta)
- [ ] Supabase project setup
- [ ] Electron OAuth flow (deep linking)
- [ ] Login/Signup UI in sidebar
- [ ] Profile page

#### Phase 6.2: Cloud Sync (2 hafta)
- [ ] Project CRUD operations via Supabase
- [ ] Conflict resolution strategy
- [ ] Offline-first with sync queue

#### Phase 6.3: Sharing (1 hafta)
- [ ] Share modal UI
- [ ] Public link generation
- [ ] View-only embed mode

#### Phase 6.4: Payments (1 hafta)
- [ ] LemonSqueezy integration
- [ ] Subscription management UI
- [ ] Feature tier enforcement

#### Phase 6.5: Multiplayer (3 hafta)
- [ ] Realtime presence
- [ ] Cursor sharing
- [ ] Collaborative editing
- [ ] Conflict-free data sync (CRDT consideration)

---

**Last Updated:** 2026-01-19 (Phase 4.6: File-backed Data Cards Architecture)
