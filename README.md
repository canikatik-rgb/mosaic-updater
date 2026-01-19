# Mosaic — Virtual Office & Remote Workspace

<p align="center">
  <strong>Ofisinizi bir node tuvaline dönüştürün. Beraber çalışın, paylaşın, üretin.</strong>
</p>

---

Mosaic, geleneksel işbirliği araçlarının ötesinde, P2P tabanlı bir **Sanal Ofis (Virtual Office)** ve **Uzak Çalışma Alanıdır**. Sonsuz bir tuval üzerinde, her biri bağımsız birer araç olarak çalışan "akıllı node'lar" ile çalışma ortamınızı kurabilir, sesli ve yazılı olarak ekibinizle anlık iletişimde kalabilirsiniz.

> **Vizyonumuz:** Discord'un iletişim gücünü Miro'nun görsel esnekliğiyle birleştirerek, fiziksel ofis hissini dijital dünyaya taşımak.

---

## 🧩 Web App Node Sistemi

Mosaic'in kalbinde **sandbox iframe** içinde çalışan, birbirinden bağımsız mini uygulamalar yatar. Her node:

- **Kendi state'ini yönetir** — Veri kaybetmeden kaydedilir ve yüklenir
- **Diğer node'larla iletişim kurar** — MessageChannel üzerinden güvenli veri alışverişi
- **Gerçek zamanlı güncellenir** — Kaynak değiştiğinde bağlı hedefler otomatik güncellenir

### Mevcut Node Tipleri

| Kategori | Node | Açıklama |
|----------|------|----------|
| **Temel** | 📝 Text Node | Zengin metin notları |
| | ✅ Checklist | Görev takibi |
| | ⏱️ Timer | Geri sayım zamanlayıcı |
| **Görsel** | 🎨 Canvas Node | 2D çizim ve kompozisyon |
| | 🧊 3D Canvas | Three.js ile 3D sahne editörü |
| | 📊 Presentation | Canvas slaytlarını sunum modunda gösterir |
| | 🖼️ Gallery | Görsel galerisi ve seçici |
| **İçerik** | 📄 Doc Editor | Quill.js tabanlı zengin metin (Görsel Sayfalama) |
| | 💻 Code Editor | Sözdizimi vurgulu kod editörü |
| | 🔗 URL Node | Web sayfası görüntüleyici + element inspector |
| **Araçlar** | 📤 QR Node | Metinden QR kod oluşturucu |
| | 🎨 Color Node | Renk seçici ve paletler |
| | 💾 Save Node | Dosya export (PDF, SVG, HTML, TXT, JSON) |
| | 🔄 Transform Node | Veri dönüştürme işlemleri |
| | 📦 HTML Embed | Özel HTML/CSS/JS içeriği |
| **Dekoratif** | 😊 Stickers | Sürükle-bırak sticker sistemi |

---

## 🔄 Node Bağlantıları = Veri Akışları

Node'ları pin'lerinden sürükleyerek birbirine bağlayabilirsiniz. Bağlantılar üzerinden akan veri tipleri:

- **image** — Base64 veya URL formatında görseller
- **text** — Düz metin içeriği
- **html** — HTML markup
- **svg** — Vektör grafikleri
- **url** — Web adresleri
- **color** — Renk değerleri

### Örnek Akışlar

```
📷 Gallery → 🎨 Canvas    # Galeri'den seçilen görsel Canvas'ta görünür
🧊 3D Canvas → 🎨 Canvas  # 3D snapshot Canvas'a gönderilir
📄 Doc Editor → 💾 Save   # Editör içeriği dosya olarak kaydedilir
🔗 URL → � QR            # Web adresi QR koda dönüşür
```

---

## ✨ Temel Özellikler

### 🌍 Sonsuz Tuval
Sınırsız pan ve zoom ile fikirlerinizi özgürce organize edin.

### 📦 Gruplama
İlişkili node'ları renkli gruplar halinde düzenleyin.

### ⏪ Undo/Redo
`Ctrl+Z` / `Ctrl+Y` ile her değişikliği geri alın.

### 🎨 Night Mode
Karanlık tema ile gece çalışmaları için göz konforu.

### 💾 Yerel Kayıt
Projelerinizi `.mosaic` formatında kaydedin, istediğiniz zaman açın.

### 🌐 Çoklu Dil
İngilizce, İspanyolca, Fransızca, Almanca ve Türkçe desteği.

### 😊 Sticker Sistemi
Kategori bazlı sticker paneli ile projelerinizi görsel olarak zenginleştirin.

### 💬 Dinamik Karşılama
Her yeni projede ilham verici rastgele alıntılarla karşılanın.

---

## 🚀 Başlarken

```bash
# Bağımlılıkları yükle
npm install

# Uygulamayı başlat
npm start
```

1. **Oluştur**: Çift tıklayarak text node ekleyin veya `Shift+A` ile gelişmiş node'lar
2. **Bağla**: Pin'lerden sürükleyerek node'ları birbirine bağlayın
3. **Grupla**: Birden fazla node seçip gruplandırın
4. **Kaydet**: `Cmd+S` ile projenizi kaydedin

---

## ⌨️ Klavye Kısayolları

| İşlem | Windows / Linux | Mac |
|-------|-----------------|-----|
| **Komut Paleti** | `Shift + A` | `Shift + A` |
| **Kaydet** | `Ctrl + S` | `Cmd + S` |
| **Aç** | `Ctrl + O` | `Cmd + O` |
| **Yeni Proje** | `Ctrl + N` | `Cmd + N` |
| **Geri Al** | `Ctrl + Z` | `Cmd + Z` |
| **Yinele** | `Ctrl + Y` | `Cmd + Shift + Z` |
| **Stickers** | Action Bar'dan 😊 | Action Bar'dan 😊 |
| **Sil** | `Del` / `Backspace` | `Del` / `Backspace` |

### 3D Canvas Özel Kısayolları
| İşlem | Kısayol |
|-------|---------|
| **Taşı (Move)** | `G` |
| **Döndür (Rotate)** | `R` |
| **Ölçekle (Scale)** | `S` |
| **Snapshot** | `Space` (Output gönderir) |

### Canvas Node Özel Kısayolları
| İşlem | Kısayol |
|-------|---------|
| **Yapıştır** | `Ctrl + V` (Resim/Metin) |
| **Sil** | `Del` / `Backspace` |
| **Zoom** | `Ctrl + Wheel` |
| **Pan** | `Space + Drag` |

---

## 🛠️ Teknik Mimari

```
┌─────────────────────────────────────────────────────────┐
│                 Electron Main Process                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   main.js   │  │  Clipboard  │  │   Native    │     │
│  │ (IPC Host)  │  │    API      │  │   Dialog    │     │
│  └──────┬──────┘  └─────────────┘  └─────────────┘     │
│         │                                                │
│         ▼ IPC Bridge                                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Renderer (index.html)               │   │
│  │  ┌─────────────┐  ┌─────────────┐               │   │
│  │  │ Node System │  │ Connections │               │   │
│  │  └──────┬──────┘  └──────┬──────┘               │   │
│  │         │                │                        │   │
│  │    ┌────▼────┐     ┌────▼────┐      ┌────────┐  │   │
│  │    │ iframe  │     │ webview │      │ iframe │  │   │
│  │    │ Canvas  │     │ URL Node│      │ 3D Node│  │   │
│  │    └─────────┘     └─────────┘      └────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

- **Electron** — Cross-platform desktop application
- **Webview** — URL Node için izole web tarayıcısı (Google Docs, Figma erişimi)
- **Sandbox iframe** — Dahili node'lar için güvenli çalışma ortamı
- **IPC + MessageChannel** — Güvenli process arası iletişim
- **Native Clipboard** — Görsel/metin enjeksiyonu için OS seviyesi erişim

---

## 📂 Proje Yapısı

```
/Mosaic
├── main.js              # Electron main process
├── preload.js           # Preload script (IPC bridge)
├── index.html           # Renderer entry point
├── package.json         # Electron & npm config
├── css/                 # Stiller (değişkenler, dark mode)
├── js/
│   ├── app.js           # Renderer uygulama başlatma
│   ├── nodes.js         # Node yönetimi
│   ├── node-loader.js   # iframe/webview node yükleyici
│   ├── node_system.js   # Veri akış yönetimi
│   ├── MosaicNode.js    # SDK (iframe içi API)
│   ├── SDP.js           # Semantic Data Protocol
│   ├── connections.js   # Bağlantı çizimi
│   ├── history.js       # Undo/Redo sistemi
│   └── ...
├── node_types/          # Web App Node'lar
│   ├── url_node/        # Webview tabanlı (harici siteler)
│   ├── 3d_canvas_node/  # iframe tabanlı
│   ├── canvas_node/
│   └── ...
├── stickers/            # Sticker kategorileri
└── SDK_README.md        # Node geliştirme kılavuzu
```

---

## 🔮 Gelecek Planları

### ✅ Tamamlanan
- **Semantic Data Protocol (SDP)** — Tip korumalı ve metadata zengini veri akışı
- **Cloud Sync Infrastructure** — Supabase entegrasyonu ve proje yükleme
- **Sharing UI** — Proje paylaşımı ve collaborators yönetimi
- **Objects Panel** — Title bar'a taşındı, sequential navigation, dropdown, focus mode navigation
- **Focus Mode Improvements** — Smooth node transitions, responsive I/O panels (initially pinned), preserved node dimensions on exit
- **Title Bar Polish** — Share button hidden when no project, Objects Panel flows with titlebar-left elements
- **Auth State Bug Fix** — Fixed sidebar/dashboard auto-show on app focus

### 🔄 Devam Eden
- **ZIP-Based Archive System** — Monolitik JSON'dan ZIP-tabanlı archive'a geçiş
  - ✅ Asset extraction (Base64 → dosya)
  - ✅ ZIP save/load with JSZip
  - 🔄 Lazy loading for large assets
  
- **File-backed Data Cards** — Gerçek dosya tabanlı veri kartları
  - 🔄 Harici uygulamalara (Figma, WeTransfer) evrensel sürükle-bırak
  - 🔄 Electron `startDrag()` ile native dosya sürükleme
  - 🔄 URL Node indirmelerini otomatik kart olarak yakalama
  
- **Realtime Multiplayer** — Canlı imleç takibi ve event broadcasting (Phase 1)
- **Bi-directional RPA** — Node'lardan harici web sitelerine veri yazma ve etkileşim

### 📋 Planlanan
- **Advanced Injection System v2** — Cross-origin uygulamalara (Google Docs, Figma vb.) güvenilir enjeksiyon
  - Electron Native Clipboard (`clipboard.writeImage` + `webview.paste()`)
  - Crosshair Overlay ile görsel pozisyon takibi
  - Zero-width marker'lar ve MutationObserver
  
- **Command-Based History** — İleri seviye undo/redo ve zaman yolculuğu
- **Smart Transformers** — Yapay zeka destekli veri işleme node'ları

---

## 📄 Lisans

Mosaic © by [Ad Nouveau](https://ad-nouveau.com/)

---

<p align="center">
  <strong>Fikirlerinizi bağlayın. Akışlarınızı görselleştirin. Mosaic ile.</strong>
</p>