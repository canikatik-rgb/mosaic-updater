/**
 * UI Management
 * Handles user interface elements like modals, night mode, fullscreen, and menu
 */

// Get current language from storage
let currentLanguage = localStorage.getItem('language') || 'en';

// Expose globally BEFORE translations object
window.currentLanguage = currentLanguage;

// UI translations - ONLY for UI elements (menu, toolbar, etc.)
// Node-specific translations should be in each node's HTML file!
const translations = {
    en: {
        welcome: "Welcome to Mosaic",
        welcomeDescription: "Create meaningful concept maps with Mosaic's intuitive interface.",
        newProject: "Create New Project",
        openProject: "Open Existing Project",
        createNewProject: "Create New Project",
        projectName: "Project Name:",
        projectNamePlaceholder: "Enter a name for your project",
        create: "Create",
        newMosaic: "New Mosaic",
        saveProject: "Save Project",
        openFile: "Open Project",
        exportImage: "Export as Image",
        resetView: "Reset View",
        exportPDF: "Export as PDF", // Added PDF export text
        firstNode: "Double Click to Edit Text",
        renameProject: "Rename Project",
        save: "Save",
        cancel: "Cancel",
        // Welcome Node Content
        welcomeTitle: "Welcome to Mosaic!",
        welcomeIntro: "This is your first node. You can:",
        welcomeFeature1: "Double-click anywhere to create more nodes",
        welcomeFeature2: "Drag from pins to connect nodes",
        welcomeFeature3: "Alt+drag connection to remove it",
        welcomeFeature4: "Click & hold to move a node",
        welcomeFeature5: "Double-click a node to edit its content",
        welcomeColorTip: "Click the node header to change its color!",
        // Tooltips
        toggleNightMode: "Toggle Night Mode",
        toggleFullscreen: "Toggle Fullscreen",
        closeProject: "Close Project",
        nodePlaceholder: "Double Click to Edit Text", // Default placeholder
        // Checklist Node
        checklistAddItem: "Add Item",
        checklistItemRemove: "Remove Item",
        // Timer Node
        timerSetTime: "Set Time",
        timerChangeTime: "Change Time",
        timerPause: "Pause",
        timerResume: "Resume",
        timerExpired: "Time's Up!",
        timerDays: "Days",
        timerHours: "Hours",
        timerMinutes: "Mins",
        timerSeconds: "Secs",
        timerNodeName: "Timer",
        timerSetTargetLabel: "Set Target Date & Time:",
        changeNodeTypeTitle: "Change Node Type",
        // Google Drive Integration
        googleDriveProjectsTitle: "Google Drive Projects",
        driveLoadingProjects: "Loading projects...",
        driveNewProject: "New Project",
        signOut: "Sign Out",
        driveEmpty: "No Mosaic projects found in your Google Drive.",
        driveUploadProject: "Upload Project",
        // Action Bar
        actionBarSpotlight: "Wizard (Shift+A)",
        actionBarColor: "Change Color",
        actionBarVisibility: "Toggle Visibility",
        actionBarGroup: "Group Nodes",
        actionBarDelete: "Delete Selected",
        actionBarSelected: "Selected",
        // Command Palette
        cpPlaceholder: "Type to search or create...",
        cpCreateNew: "Create New",
        cpGoToNode: "Go to Node",
        cpNoResults: "No results found",
        cpTextNode: "Text Node",
        cpChecklist: "Checklist",
        cpTimer: "Timer",
        cpTextNodeDesc: "Simple text note",
        cpChecklistDesc: "Track tasks",
        cpChecklistDesc: "Track tasks",
        cpTimerDesc: "Countdown timer",
        cpCanvas: "Canvas",
        cpCanvasDesc: "Render content",
        cpTransform: "Transform",
        cpTransformDesc: "Position & Scale",
        objectsPanelTitle: "Objects",
        lockNodes: "Lock",
        unlockNodes: "Unlock",
        locked: "Locked",
        cpGoToNode: "NODE'A GIT",
        cpGoToGroup: "GRUBA GIT",
        cpGoToNode: "NODE'A GIT",
        cpGoToGroup: "GRUBA GIT",
        nodesAlreadyGrouped: "Some nodes are already in a group. Ungroup them first.",
        // New Node Types
        cpQrNode: "QR Code",
        cpQrNodeDesc: "Generate QR Codes",
        cpHtmlEmbedNode: "HTML Embed",
        cpHtmlEmbedNodeDesc: "Embed custom HTML/JS",
        cpUrlNode: "URL Embed",
        cpUrlNodeDesc: "Embed a website iframe",
        cpCodeEditorNode: "Code Editor",
        cpCodeEditorNodeDesc: "Edit code with syntax highlighting",
        cpDocEditorNode: "Document Editor",
        cpDocEditorNodeDesc: "Rich text document",
        cpTransformNode: "Transform Node",
        cpTransformNodeDesc: "Container for layout & transform",
        cpCanvasNode: "Canvas Node",
        cpCanvasNodeDesc: "Infinite canvas for composition",
        cpGalleryNode: "Gallery",
        cpGalleryNodeDesc: "Image carousel/grid",
        cpSaveNode: "Save Node",
        cpSaveNodeDesc: "Export content to file",
        // Unified Bar Menu
        objects: "Objects",
        noObjects: "No objects",
        saveAsTemplate: "Save as Template"
    },
    es: {
        welcome: "Bienvenido a Mosaic",
        // ...
        objectsPanelTitle: "Objetos",
        welcomeDescription: "Crea mapas conceptuales significativos con la interfaz intuitiva de Mosaic.",
        newProject: "Crear Nuevo Proyecto",
        openProject: "Abrir Proyecto Existente",
        createNewProject: "Crear Nuevo Proyecto",
        projectName: "Nombre del Proyecto:",
        projectNamePlaceholder: "Introduce un nombre para tu proyecto",
        create: "Crear",
        newMosaic: "Nuevo Mosaico",
        saveProject: "Guardar Proyecto",
        openFile: "Abrir Proyecto",
        exportImage: "Exportar como Imagen",
        resetView: "Reiniciar Vista",
        exportPDF: "Exportar como PDF", // Added PDF export text
        firstNode: "Doble Clic para Editar Texto",
        renameProject: "Renombrar Proyecto",
        save: "Guardar",
        cancel: "Cancelar",
        // Welcome Node Content (Spanish)
        welcomeTitle: "¡Bienvenido a Mosaic!",
        welcomeIntro: "Este es tu primer nodo. Puedes:",
        welcomeFeature1: "Hacer doble clic en cualquier lugar para crear más nodos",
        welcomeFeature2: "Arrastrar desde los pines para conectar nodos",
        welcomeFeature3: "Alt+arrastrar para eliminar una conexión",
        welcomeFeature4: "Hacer clic y mantener para mover un nodo",
        welcomeFeature5: "Hacer doble clic en un nodo para editar su contenido",
        welcomeColorTip: "¡Haz clic en el encabezado del nodo para cambiar su color!",
        // Tooltips (Spanish)
        toggleNightMode: "Alternar Modo Noche",
        toggleFullscreen: "Alternar Pantalla Completa",
        closeProject: "Cerrar Proyecto",
        nodePlaceholder: "Haz doble clic para editar", // Spanish placeholder
        // Checklist Node (Spanish)
        checklistAddItem: "Añadir Elemento",
        checklistItemRemove: "Eliminar Elemento",
        // Timer Node (Spanish)
        timerSetTime: "Establecer Hora",
        timerChangeTime: "Cambiar Hora",
        timerPause: "Pausa",
        timerResume: "Reanudar",
        timerExpired: "¡Se acabó el tiempo!",
        timerDays: "Días",
        timerHours: "Horas",
        timerMinutes: "Mins",
        timerSeconds: "Segs",
        timerNodeName: "Temporizador",
        timerSetTargetLabel: "Establecer Fecha y Hora Objetivo:",
        changeNodeTypeTitle: "Cambiar Tipo de Nodo",
        // Google Drive Integration
        googleDriveProjectsTitle: "Proyectos de Google Drive",
        driveLoadingProjects: "Cargando proyectos...",
        driveNewProject: "Nuevo Proyecto",
        signOut: "Cerrar Sesión",
        driveEmpty: "No se encontraron proyectos Mosaic en tu Google Drive.",
        driveUploadProject: "Subir Proyecto",
        // Action Bar (Spanish)
        actionBarSpotlight: "Mago (Shift+A)",
        actionBarColor: "Cambiar Color",
        actionBarVisibility: "Alternar Visibilidad",
        actionBarGroup: "Agrupar Nodos",
        actionBarDelete: "Eliminar Seleccionados",
        actionBarSelected: "Seleccionado",
        // Command Palette (Spanish)
        cpPlaceholder: "Escribe para buscar o crear...",
        cpCreateNew: "Crear Nuevo",
        cpGoToNode: "Ir al Nodo",
        cpNoResults: "No se encontraron resultados",
        cpTextNode: "Nodo de Texto",
        cpChecklist: "Lista de Verificación",
        cpTimer: "Temporizador",
        cpTextNodeDesc: "Nota de texto simple",
        cpChecklistDesc: "Seguimiento de tareas",
        cpChecklistDesc: "Seguimiento de tareas",
        cpTimerDesc: "Cuenta atrás",
        cpCanvas: "Lienzo",
        cpCanvasDesc: "Renderizar contenido",
        cpTransform: "Transformar",
        cpTransformDesc: "Posición y Escala",
        lockNodes: "Bloquear",
        unlockNodes: "Desbloquear",
        locked: "Bloqueado",
        cpGoToNode: "IR AL NODO",
        cpGoToGroup: "IR AL GRUPO",
        cpGoToNode: "IR AL NODO",
        cpGoToGroup: "IR AL GRUPO",
        nodesAlreadyGrouped: "Algunos nodos ya están en un grupo. Desagrúpalos primero.",
        // New Node Types (Spanish)
        cpQrNode: "Código QR",
        cpQrNodeDesc: "Generar Códigos QR",
        cpHtmlEmbedNode: "Incrustar HTML",
        cpHtmlEmbedNodeDesc: "Incrustar HTML/JS personalizado",
        cpUrlNode: "Incrustar URL",
        cpUrlNodeDesc: "Incrustar un sitio web",
        cpCodeEditorNode: "Editor de Código",
        cpCodeEditorNodeDesc: "Editar código con resaltado",
        cpDocEditorNode: "Editor de Documentos",
        cpDocEditorNodeDesc: "Documento de texto enriquecido",
        cpTransformNode: "Nodo de Transformación",
        cpTransformNodeDesc: "Contenedor para diseño y transformación",
        cpCanvasNode: "Nodo Lienzo",
        cpCanvasNodeDesc: "Lienzo infinito para composición",
        cpGalleryNode: "Galería",
        cpGalleryNodeDesc: "Carrusel/cuadrícula de imágenes",
        cpSaveNode: "Nodo Guardar",
        cpSaveNodeDesc: "Exportar contenido a archivo"

    },
    fr: {
        welcome: "Bienvenue à Mosaic",
        welcomeDescription: "Créez des cartes conceptuelles significatives avec l'interface intuitive de Mosaic.",
        newProject: "Créer Nouveau Projet",
        openProject: "Ouvrir un Projet Existant",
        createNewProject: "Créer un Nouveau Projet",
        projectName: "Nom du Projet:",
        projectNamePlaceholder: "Entrez un nom pour votre projet",
        create: "Créer",
        newMosaic: "Nouvelle Mosaïque",
        saveProject: "Enregistrer le Projet",
        openFile: "Ouvrir le Projet",
        exportImage: "Exporter en Image",
        resetView: "Réinitialiser la Vue",
        exportPDF: "Exporter en PDF", // Added PDF export text
        firstNode: "Double-cliquez pour Modifier le Texte",
        renameProject: "Renommer le Projet",
        save: "Enregistrer",
        cancel: "Annuler",
        // Welcome Node Content (French)
        welcomeTitle: "Bienvenue à Mosaic!",
        welcomeIntro: "Ceci est votre premier nœud. Vous pouvez:",
        welcomeFeature1: "Double-cliquer n'importe où pour créer plus de nœuds",
        welcomeFeature2: "Faire glisser à partir des épingles pour connecter les nœuds",
        welcomeFeature3: "Alt+glisser pour supprimer une connexion",
        welcomeFeature4: "Cliquer et maintenir pour déplacer un nœud",
        welcomeFeature5: "Double-cliquer sur un nœud pour éditer son contenu",
        welcomeColorTip: "Cliquez sur l'en-tête du nœud pour changer sa couleur!",
        // Tooltips (French)
        toggleNightMode: "Basculer Mode Nuit",
        toggleFullscreen: "Basculer Plein Écran",
        closeProject: "Fermer le projet",
        nodePlaceholder: "Double-cliquer pour éditer", // French placeholder
        // Checklist Node (French)
        checklistAddItem: "Ajouter un élément",
        checklistItemRemove: "Supprimer l'élément",
        // Timer Node (French)
        timerSetTime: "Régler l'heure",
        timerChangeTime: "Changer l'heure",
        timerPause: "Pause",
        timerResume: "Reprendre",
        timerExpired: "Temps écoulé !",
        timerDays: "Jours",
        timerHours: "Heures",
        timerMinutes: "Mins",
        timerSeconds: "Secs",
        timerNodeName: "Minuteur",
        timerSetTargetLabel: "Définir Date et Heure Cibles:",
        changeNodeTypeTitle: "Changer le Type de Nœud",
        // Google Drive Integration
        googleDriveProjectsTitle: "Projets Google Drive",
        driveLoadingProjects: "Chargement des projets...",
        driveNewProject: "Nouveau Projet",
        signOut: "Se Déconnecter",
        driveEmpty: "Aucun projet Mosaic trouvé dans votre Google Drive.",
        driveUploadProject: "Téléverser Projet",
        // Action Bar (French)
        actionBarSpotlight: "Sorcier (Shift+A)",
        actionBarColor: "Changer Couleur",
        actionBarVisibility: "Basculer Visibilité",
        actionBarGroup: "Grouper Nœuds",
        actionBarDelete: "Supprimer Sélection",
        actionBarSelected: "Sélectionné",
        // Command Palette (French)
        cpPlaceholder: "Tapez pour chercher ou créer...",
        cpCreateNew: "Créer Nouveau",
        cpGoToNode: "Aller au Nœud",
        cpNoResults: "Aucun résultat trouvé",
        cpTextNode: "Nœud Texte",
        cpChecklist: "Liste de Contrôle",
        cpTimer: "Minuteur",
        cpTextNodeDesc: "Note textuelle simple",
        cpChecklistDesc: "Suivi des tâches",
        cpChecklistDesc: "Suivi des tâches",
        cpTimerDesc: "Compte à rebours",
        cpCanvas: "Toile",
        cpCanvasDesc: "Rendu de contenu",
        cpTransform: "Transformer",
        cpTransformDesc: "Position et Échelle",
        objectsPanelTitle: "Objets",
        lockNodes: "Verrouiller",
        unlockNodes: "Déverrouiller",
        locked: "Verrouillé",
        cpGoToNode: "ALLER AU NŒUD",
        cpGoToGroup: "ALLER AU GROUPE",
        nodesAlreadyGrouped: "Certains nœuds sont déjà dans un groupe. Dégroupez-les d'abord.",
        // New Node Types (French)
        cpQrNode: "Code QR",
        cpQrNodeDesc: "Générer des Codes QR",
        cpHtmlEmbedNode: "Intégration HTML",
        cpHtmlEmbedNodeDesc: "Intégrer HTML/JS personnalisé",
        cpUrlNode: "Intégration URL",
        cpUrlNodeDesc: "Intégrer un site web",
        cpCodeEditorNode: "Éditeur de Code",
        cpCodeEditorNodeDesc: "Éditer du code avec coloration syntaxique",
        cpDocEditorNode: "Éditeur de Documents",
        cpDocEditorNodeDesc: "Document texte enrichi",
        cpTransformNode: "Nœud de Transformation",
        cpTransformNodeDesc: "Conteneur pour mise en page",
        cpCanvasNode: "Nœud Toile",
        cpCanvasNodeDesc: "Toile infinie pour composition",
        cpGalleryNode: "Galerie",
        cpGalleryNodeDesc: "Carrousel/grille d'images"
    },
    de: {
        welcome: "Willkommen bei Mosaic",
        welcomeDescription: "Erstellen Sie aussagekräftige Konzeptkarten mit der intuitiven Benutzeroberfläche von Mosaic.",
        newProject: "Neues Projekt Erstellen",
        openProject: "Vorhandenes Projekt öffnen",
        createNewProject: "Neues Projekt erstellen",
        projectName: "Projektname:",
        projectNamePlaceholder: "Geben Sie einen Namen für Ihr Projekt ein",
        create: "Erstellen",
        newMosaic: "Neues Mosaik",
        saveProject: "Projekt speichern",
        openFile: "Projekt öffnen",
        exportImage: "Als Bild exportieren",
        resetView: "Ansicht zurücksetzen",
        exportPDF: "Als PDF exportieren", // Added PDF export text
        firstNode: "Doppelklicken zum Bearbeiten des Texts",
        renameProject: "Projekt umbenennen",
        save: "Speichern",
        cancel: "Abbrechen",
        // Welcome Node Content (German)
        welcomeTitle: "Willkommen bei Mosaic!",
        welcomeIntro: "Dies ist Ihr erster Knoten. Sie können:",
        welcomeFeature1: "Doppelklicken Sie irgendwo, um weitere Knoten zu erstellen",
        welcomeFeature2: "Ziehen Sie von den Pins, um Knoten zu verbinden",
        welcomeFeature3: "Alt+ziehen, um eine Verbindung zu entfernen",
        welcomeFeature4: "Klicken und halten, um einen Knoten zu bewegen",
        welcomeFeature5: "Doppelklicken Sie auf einen Knoten, um dessen Inhalt zu bearbeiten",
        welcomeColorTip: "Klicken Sie auf die Knotenüberschrift, um ihre Farbe zu ändern!",
        // Tooltips (German)
        toggleNightMode: "Nachtmodus umschalten",
        toggleFullscreen: "Vollbild umschalten",
        closeProject: "Projekt schließen",
        nodePlaceholder: "Doppelklicken zum Bearbeiten", // German placeholder
        // Checklist Node (German)
        checklistAddItem: "Element hinzufügen",
        checklistItemRemove: "Element entfernen",
        // Timer Node (German)
        timerSetTime: "Zeit einstellen",
        timerChangeTime: "Zeit ändern",
        timerPause: "Pause",
        timerResume: "Fortsetzen",
        timerExpired: "Zeit abgelaufen!",
        timerDays: "Tage",
        timerHours: "Std",
        timerMinutes: "Min",
        timerSeconds: "Sek",
        timerNodeName: "Timer",
        timerSetTargetLabel: "Zieldatum und -zeit festlegen:",
        changeNodeTypeTitle: "Knotentyp ändern",
        // Google Drive Integration
        googleDriveProjectsTitle: "Google Drive-Projekte",
        driveLoadingProjects: "Projekte werden geladen...",
        driveNewProject: "Neues Projekt",
        signOut: "Abmelden",
        driveEmpty: "Keine Mosaic-Projekte in Ihrem Google Drive gefunden.",
        driveUploadProject: "Projekt hochladen",
        // Action Bar (German)
        actionBarSpotlight: "Zauberer (Shift+A)",
        actionBarColor: "Farbe ändern",
        actionBarVisibility: "Sichtbarkeit umschalten",
        actionBarGroup: "Knoten gruppieren",
        actionBarDelete: "Ausgewählte löschen",
        actionBarSelected: "Ausgewählt",
        // Command Palette (German)
        cpPlaceholder: "Tippen zum Suchen oder Erstellen...",
        cpCreateNew: "Neu erstellen",
        cpGoToNode: "Gehe zu Knoten",
        cpNoResults: "Keine Ergebnisse gefunden",
        cpTextNode: "Textknoten",
        cpChecklist: "Checkliste",
        cpTimer: "Timer",
        cpTextNodeDesc: "Einfache Textnotiz",
        cpChecklistDesc: "Aufgaben verfolgen",
        cpChecklistDesc: "Aufgaben verfolgen",
        cpTimerDesc: "Countdown-Timer",
        cpCanvas: "Leinwand",
        cpCanvasDesc: "Inhalt rendern",
        cpTransform: "Transformieren",
        cpTransformDesc: "Position & Skalierung",
        objectsPanelTitle: "Objekte",
        lockNodes: "Sperren",
        unlockNodes: "Entsperren",
        locked: "Gesperrt",
        cpGoToNode: "ZUM KNOTEN GEHEN",
        cpGoToGroup: "ZUR GRUPPE GEHEN",
        nodesAlreadyGrouped: "Einige Knoten sind bereits in einer Gruppe. Gruppieren Sie sie zuerst auf.",
        // New Node Types (German)
        cpQrNode: "QR-Code",
        cpQrNodeDesc: "QR-Codes generieren",
        cpHtmlEmbedNode: "HTML-Einbettung",
        cpHtmlEmbedNodeDesc: "Benutzerdefiniertes HTML/JS einbetten",
        cpUrlNode: "URL-Einbettung",
        cpUrlNodeDesc: "Website einbetten",
        cpCodeEditorNode: "Code-Editor",
        cpCodeEditorNodeDesc: "Code mit Syntax-Highlighting bearbeiten",
        cpDocEditorNode: "Dokumenten-Editor",
        cpDocEditorNodeDesc: "Rich-Text-Dokument",
        cpTransformNode: "Transformations-Knoten",
        cpTransformNodeDesc: "Container für Layout & Transformation",
        cpCanvasNode: "Leinwand-Knoten",
        cpCanvasNodeDesc: "Unendliche Leinwand für Komposition",
        cpGalleryNode: "Galerie",
        cpGalleryNodeDesc: "Bildkarussell/-raster"
    },
    tr: {
        welcome: "Mosaic'e Hoş Geldiniz",
        welcomeDescription: "Mosaic'in sezgisel arayüzü ile anlamlı kavram haritaları oluşturun.",
        newProject: "Yeni Proje Oluştur",
        openProject: "Mevcut Projeyi Aç",
        createNewProject: "Yeni Proje Oluştur",
        projectName: "Proje Adı:",
        projectNamePlaceholder: "Projeniz için bir isim girin",
        create: "Oluştur",
        newMosaic: "Yeni Mozaik",
        saveProject: "Projeyi Kaydet",
        openFile: "Projeyi Aç",
        exportImage: "Resim Olarak Dışa Aktar",
        resetView: "Görünümü Sıfırla",
        exportPDF: "PDF Olarak Dışa Aktar", // Added PDF export text
        firstNode: "Metni Düzenlemek için Çift Tıklayın",
        renameProject: "Projeyi Yeniden Adlandır",
        save: "Kaydet",
        cancel: "İptal",
        // Welcome Node Content (Turkish)
        welcomeTitle: "Mosaic'e Hoş Geldiniz!",
        welcomeIntro: "Bu ilk karonuz. Şunları yapabilirsiniz:",
        welcomeFeature1: "Daha fazla karo oluşturmak için herhangi bir yere çift tıklayın",
        welcomeFeature2: "Karoları bağlamak için pinlerden sürükleyin",
        welcomeFeature3: "Bir bağlantıyı kaldırmak için Alt/Opt+sürükleyin",
        welcomeFeature4: "Bir karoyu taşımak için tutun ve sürükleyin",
        welcomeFeature5: "İçeriğini düzenlemek için bir karoya çift tıklayın",
        welcomeColorTip: "Rengini değiştirmek için karo başlığına çift tıklayın!",
        // Tooltips (Turkish)
        toggleNightMode: "Gece Modunu Değiştir",
        toggleFullscreen: "Tam Ekranı Değiştir",
        closeProject: "Projeyi Kapat",
        nodePlaceholder: "Düzenlemek için çift tıklayın", // Turkish placeholder
        // Checklist Node (Turkish)
        checklistAddItem: "Öğe Ekle",
        checklistItemRemove: "Öğeyi Kaldır",
        // Timer Node (Turkish)
        timerSetTime: "Zamanı Ayarla",
        timerChangeTime: "Zamanı Değiştir",
        timerPause: "Duraklat",
        timerResume: "Devam Et",
        timerExpired: "Süre Doldu!",
        timerDays: "Gün",
        timerHours: "Saat",
        timerMinutes: "Dak",
        timerSeconds: "Sn",
        timerNodeName: "Zamanlayıcı",
        timerSetTargetLabel: "Hedef Tarih ve Saati Ayarla:",
        changeNodeTypeTitle: "Düğüm Türünü Değiştir",
        // Google Drive Integration
        googleDriveProjectsTitle: "Google Drive Projeleri",
        driveLoadingProjects: "Projeler yükleniyor...",
        driveNewProject: "Yeni Proje",
        signOut: "Oturumu Kapat",
        driveEmpty: "Google Drive'ınızda Mosaic projesi bulunamadı.",
        driveUploadProject: "Proje Yükle",
        // Action Bar (Turkish)
        actionBarSpotlight: "Sihirbaz (Shift+A)",
        actionBarColor: "Rengi Değiştir",
        actionBarVisibility: "Görünürlüğü Aç/Kapat",
        actionBarGroup: "Grupla",
        actionBarDelete: "Seçilenleri Sil",
        actionBarSelected: "Seçildi",
        // Command Palette (Turkish)
        cpPlaceholder: "Aramak veya oluşturmak için yazın...",
        cpCreateNew: "Yeni Oluştur",
        cpGoToNode: "Node'a Git",
        cpNoResults: "Sonuç bulunamadı",
        cpTextNode: "Metin Node",
        cpTextNodeDesc: "Basit metin notu",
        cpCanvas: "Kanvas",
        cpCanvasDesc: "İçerik oluştur",
        cpTransform: "Dönüştür",
        cpTransformDesc: "Konum ve Ölçek",
        // Objects Panel (Turkish)
        objectsPanelTitle: "Nesneler",
        objectsPanelEmpty: "Nesne bulunamadı",
        focus: "Odakla",
        download: "İndir",
        lockNodes: "Kilitle",
        unlockNodes: "Kilidi Aç",
        locked: "Kilitli",
        cpGoToNode: "NODE'A GİT",
        cpGoToGroup: "GRUBA GİT",
        nodesAlreadyGrouped: "Bazı node'lar zaten bir grupta. Önce grubunu kaldırın.",
        // New Node Types (Turkish)
        cpQrNode: "QR Kod",
        cpQrNodeDesc: "QR Kod Oluştur",
        cpHtmlEmbedNode: "HTML Gömme",
        cpHtmlEmbedNodeDesc: "Özel HTML/JS gömün",
        cpUrlNode: "URL Gömme",
        cpUrlNodeDesc: "Web sitesi gömün",
        cpCodeEditorNode: "Kod Editörü",
        cpCodeEditorNodeDesc: "Sözdizimi vurgulamalı kod editörü",
        cpDocEditorNode: "Belge Editörü",
        cpDocEditorNodeDesc: "Zengin metin belgesi",
        cpTransformNode: "Dönüştürme Node'u",
        cpTransformNodeDesc: "Düzen ve dönüştürme için kapsayıcı",
        cpCanvasNode: "Kanvas Node'u",
        cpCanvasNodeDesc: "Kompozisyon için sonsuz kanvas",
        cpGalleryNode: "Galeri",
        cpGalleryNodeDesc: "Resim karuseli/ızgarası",
        timerSeconds: "Saniye",
        timerCountdown: "Geri Sayım",
        timerStopwatch: "Kronometre",
        timerLoop: "Döngü",
        timerEvery: "Her",
        timerAutoStart: "Yüklendiğinde otomatik başlat",
        timerLoopSecond: "Saniye",
        timerLoopMinute: "Dakika",
        timerLoopHour: "Saat",
        timerLoopHelp: "Her döngüde sinyal gönder.",
        // Checklist Node Internals
        checklistPlaceholder: "Yeni görev ekle...",
        checklistNoTasks: "Görev Yok",
        checklistCompleted: "Tamamlandı",
        // Save Node Internals
        saveFormat: "Format",
        saveDownload: "Kaydet / İndir",
        saveNoContent: "Kaydedilecek bağlı içerik yok!",
        // Unified Bar Menu
        objects: "Nesneler",
        noObjects: "Nesne yok",
        saveAsTemplate: "Şablon Olarak Kaydet"
    }
};

// Make translations available globally for nodes EARLY
window.translations = translations;
window.currentLanguage = currentLanguage;

// Get text based on current language
function getText(key) {
    return translations[currentLanguage][key] || translations['en'][key];
}

// Expose globally for use in other modules (like auth.js)
window.getText = getText;
window.getWelcomeNodeContent = getWelcomeNodeContent; // Already defined in nodes.js, ensure it uses getText

// Initialize UI elements
function initUI() {
    // Get UI elements
    const welcomeModal = document.getElementById('welcome-modal');
    const newProjectModal = document.getElementById('new-project-modal');
    const closeModalButtons = document.querySelectorAll('.close-modal');
    const newProjectBtn = document.getElementById('new-project-btn');
    const openProjectBtn = document.getElementById('open-project-btn');
    const createProjectBtn = document.getElementById('create-project-btn');
    const projectNameInput = document.getElementById('project-name');
    const fileNameDisplay = document.getElementById('file-name-display');
    const nightModeToggle = document.getElementById('night-mode-toggle');
    const fullscreenToggle = document.getElementById('fullscreen-toggle');
    const menuButton = document.getElementById('menu-button');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const newMosaicBtn = document.getElementById('new-mosaic-btn');
    const saveButton = document.getElementById('save-button');
    const uploadButton = document.getElementById('upload-button');
    const exportButton = document.getElementById('export-button');
    const exportPdfButton = document.getElementById('export-pdf-button'); // Get PDF export button
    const resetCanvasBtn = document.getElementById('reset-canvas');
    const backToWelcomeBtn = document.querySelector('#new-project-modal .back-to-welcome');

    // Initialize with browser language if possible
    initLanguage();

    // Setup welcome modal and project creation workflow
    // showModal(welcomeModal); // Don't show modal here, it starts active in HTML
    // if (welcomeModal.id === 'welcome-modal') { // Remove this block as well
    //     document.body.classList.add('showing-modal');
    // }

    // Close modal buttons - Updated logic for new-project-modal close
    closeModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (!modal) return;

            // Special handling for the new project modal close button
            if (modal.id === 'new-project-modal') {
                const appContainer = document.getElementById('app-container');
                // Check if the main app is hidden (i.e., we are in the initial welcome flow)
                if (appContainer && appContainer.style.display === 'none') {
                    hideModal(newProjectModal);
                    showModal(welcomeModal); // Go back to welcome modal
                } else {
                    hideModal(newProjectModal); // Just hide if app is already visible
                }
            } else {
                // Default behavior for other close buttons
                hideModal(modal);
            }
        });
    });

    // Removed event listener for backToWelcomeBtn as the button is removed from HTML
    // if (backToWelcomeBtn) { ... }

    // New project button in welcome modal
    newProjectBtn.addEventListener('click', () => {
        hideModal(welcomeModal);
        showModal(newProjectModal);
        projectNameInput.focus();
    });

    // Open existing project button in welcome modal
    openProjectBtn.addEventListener('click', () => {
        hideModal(welcomeModal);
        if (window.openProject) {
            openProject();
        }
    });

    // Google Sign-In button removed - using Supabase now

    // Create project button in new project modal
    createProjectBtn.addEventListener('click', async () => {
        const projectName = projectNameInput.value.trim();
        if (projectName) {
            hideModal(newProjectModal);
            // Create local project
            if (window.createNewProject) {
                createNewProject(projectName);
            }
        } else {
            projectNameInput.classList.add('error');
            setTimeout(() => projectNameInput.classList.remove('error'), 500);
        }
    });

    // Handle Enter key in project name input
    projectNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            createProjectBtn.click();
        }
    });

    // Night mode toggle
    nightModeToggle.addEventListener('click', toggleNightMode);

    // Fullscreen toggle
    fullscreenToggle.addEventListener('click', toggleFullscreen);

    // Initialize language selector - Refactored
    setupLanguageSelectorLogic(document.getElementById('welcome-language-selector-clone'), true);

    // Initialize menu button
    setupMenuButton();

    // New mosaic button
    newMosaicBtn.addEventListener('click', () => {
        dropdownMenu.classList.remove('show');

        // --- MODIFICATION: Check for Google Sign-In ---
        console.log('[New Mosaic Btn] Checking googleAccessToken:', window.googleAccessToken);
        if (window.googleAccessToken) {
            // If signed in, show Welcome Modal with Drive Dashboard ON TOP
            const welcomeModal = document.getElementById('welcome-modal');
            // REMOVED: Lines hiding appContainer and backgroundVideo
            // const appContainer = document.getElementById('app-container');
            // const backgroundVideo = document.getElementById('background-video');
            // if (appContainer) appContainer.style.display = 'none'; 
            // if (backgroundVideo) backgroundVideo.style.display = 'none';
            // document.body.classList.remove('app-active');

            if (welcomeModal) {
                // Ensure Drive Dashboard is shown and welcome options are hidden
                if (window.updateSignInStatus) {
                    updateSignInStatus(true); // Make sure drive dashboard is visible
                }
                // Refresh file list when showing the modal this way
                if (window.listDriveFiles && window.showDriveDashboard) {
                    window.listDriveFiles().then(files => window.showDriveDashboard(files)).catch(err => console.error("Error refreshing drive list:", err));
                }
                // Show modal ON TOP, and request close button visibility
                showModal(welcomeModal, true);
            }
        } else {
            // Original behavior: Show new project modal for local creation
            showModal(newProjectModal);
            projectNameInput.value = '';
            projectNameInput.focus();
            // Ensure creating for drive flag is false
            if (window.hasOwnProperty('isCreatingForDrive')) {
                window.isCreatingForDrive = false;
            }
        }
        // --- END MODIFICATION ---
    });

    // Save button
    saveButton.addEventListener('click', () => {
        dropdownMenu.classList.remove('show');
        if (window.saveProject) {
            saveProject();
        }
    });

    // Open button
    uploadButton.addEventListener('click', () => {
        dropdownMenu.classList.remove('show');

        // --- MODIFICATION: Check for Google Sign-In ---
        console.log('[Open Project Btn] Checking googleAccessToken:', window.googleAccessToken);
        if (window.googleAccessToken) {
            // If signed in, show Welcome Modal with Drive Dashboard ON TOP
            const welcomeModal = document.getElementById('welcome-modal');
            // REMOVED: Lines hiding appContainer and backgroundVideo
            // const appContainer = document.getElementById('app-container');
            // const backgroundVideo = document.getElementById('background-video');
            // if (appContainer) appContainer.style.display = 'none'; 
            // if (backgroundVideo) backgroundVideo.style.display = 'none';
            // document.body.classList.remove('app-active');

            if (welcomeModal) {
                // Ensure Drive Dashboard is shown and welcome options are hidden
                if (window.updateSignInStatus) {
                    updateSignInStatus(true); // Make sure drive dashboard is visible
                }
                // Refresh file list when showing the modal this way
                if (window.listDriveFiles && window.showDriveDashboard) {
                    window.listDriveFiles().then(files => window.showDriveDashboard(files)).catch(err => console.error("Error refreshing drive list:", err));
                }
                // Show modal ON TOP, and request close button visibility
                showModal(welcomeModal, true);
            }
        } else {
            // Original behavior: Trigger local file open dialog
            if (window.openProject) {
                openProject();
            }
        }
        // --- END MODIFICATION ---
    });

    // Export button (Image)
    exportButton.addEventListener('click', () => {
        dropdownMenu.classList.remove('show');
        if (window.exportAsImage) {
            exportAsImage();
        }
    });

    // Export PDF button
    exportPdfButton.addEventListener('click', () => {
        dropdownMenu.classList.remove('show');
        if (window.exportAsPDF) { // Call the new export function
            exportAsPDF();
        }
    });

    // Reset canvas view
    if (resetCanvasBtn) {
        resetCanvasBtn.addEventListener('click', () => {
            dropdownMenu.classList.remove('show');
            if (window.resetCanvasView) {
                resetCanvasView();
            }
        });
    }

    // Double click on canvas to create a new node
    canvas.addEventListener('dblclick', function (e) {
        if (e.target === canvas || e.target === canvasBackground || e.target === canvasContent) {
            const pos = getCanvasPosition(e);
            if (window.createNode) {
                window.createNode(pos.x, pos.y);
            }
        }
    });

    // Click on canvas to clear selection (if not panning)
    canvas.addEventListener('click', function (e) {
        if (e.target === canvas || e.target === canvasBackground || e.target === canvasContent) {
            // Only clear if we didn't just pan (check isPanning or hasDragged logic if needed)
            // But click usually fires after mouseup, so isPanning is already false.
            // We can check if mouse moved significantly?
            // For now, simple click clears selection.
            if (window.clearSelectedNodes) {
                window.clearSelectedNodes();
            }
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Save with Ctrl+S / Cmd+S
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            console.log('[UI] Ctrl/Cmd+S pressed, saveProject exists?', !!window.saveProject);
            if (window.saveProject) {
                saveProject();
            } else {
                console.error('[UI] saveProject function not found!');
            }
        }

        // Open with Ctrl+O / Cmd+O
        if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
            e.preventDefault();

            // --- MODIFICATION: Check for Google Sign-In ---
            console.log('[Ctrl+O] Checking googleAccessToken:', window.googleAccessToken);
            if (window.googleAccessToken) {
                // If signed in, show Welcome Modal with Drive Dashboard
                const welcomeModal = document.getElementById('welcome-modal');
                const appContainer = document.getElementById('app-container');
                const backgroundVideo = document.getElementById('background-video');

                if (appContainer) appContainer.style.display = 'none'; // Hide main app
                if (backgroundVideo) backgroundVideo.style.display = 'none'; // Hide background video
                document.body.classList.remove('app-active');

                if (welcomeModal) {
                    if (window.updateSignInStatus) {
                        updateSignInStatus(true);
                    }
                    if (window.listDriveFiles && window.showDriveDashboard) {
                        window.listDriveFiles().then(files => window.showDriveDashboard(files)).catch(err => console.error("Error refreshing drive list:", err));
                    }
                    showModal(welcomeModal);
                }
            } else {
                // Original behavior: Trigger local file open dialog
                if (window.openProject) {
                    openProject();
                }
            }
            // --- END MODIFICATION ---
        }

        // New with Ctrl+N / Cmd+N
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();

            // --- MODIFICATION: Check for Google Sign-In ---
            console.log('[Ctrl+N] Checking googleAccessToken:', window.googleAccessToken);
            if (window.googleAccessToken) {
                // If signed in, show Welcome Modal with Drive Dashboard ON TOP
                const welcomeModal = document.getElementById('welcome-modal');
                // REMOVED: Lines hiding appContainer and backgroundVideo
                // const appContainer = document.getElementById('app-container');
                // const backgroundVideo = document.getElementById('background-video');
                // if (appContainer) appContainer.style.display = 'none';
                // if (backgroundVideo) backgroundVideo.style.display = 'none';
                // document.body.classList.remove('app-active');

                if (welcomeModal) {
                    if (window.updateSignInStatus) {
                        updateSignInStatus(true);
                    }
                    if (window.listDriveFiles && window.showDriveDashboard) {
                        window.listDriveFiles().then(files => window.showDriveDashboard(files)).catch(err => console.error("Error refreshing drive list:", err));
                    }
                    // Show modal ON TOP, and request close button visibility
                    showModal(welcomeModal, true);
                }
            } else {
                // Original behavior: Show new project modal for local creation
                showModal(newProjectModal);
                projectNameInput.value = '';
                projectNameInput.focus();
                if (window.hasOwnProperty('isCreatingForDrive')) {
                    window.isCreatingForDrive = false;
                }
            }
            // --- END MODIFICATION ---
        }

        // Exit fullscreen with Escape
        if (e.key === 'Escape' && document.fullscreenElement) {
            document.exitFullscreen();
        }

        // Arrow Key Navigation between nodes
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            console.log('[UI] Arrow key pressed:', e.key);
            console.log('[UI] Selected nodes:', window.selectedNodes ? window.selectedNodes.size : 'null');
            console.log('[UI] Active element:', document.activeElement);

            // Only if we have exactly one node selected and not editing text
            if (window.selectedNodes && window.selectedNodes.size === 1 &&
                (document.activeElement === document.body || document.activeElement === document.documentElement)) { // Relaxed check

                e.preventDefault();
                const current = Array.from(window.selectedNodes)[0];
                const currentRect = current.getBoundingClientRect();
                const currentCenterX = currentRect.left + currentRect.width / 2;
                const currentCenterY = currentRect.top + currentRect.height / 2;

                let bestCandidate = null;
                let minDistance = Infinity;

                const allNodes = document.querySelectorAll('.node');
                allNodes.forEach(node => {
                    if (node === current) return;

                    const rect = node.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;

                    const dx = centerX - currentCenterX;
                    const dy = centerY - currentCenterY;

                    let isValid = false;
                    switch (e.key) {
                        case 'ArrowUp': isValid = dy < -10 && Math.abs(dx) < Math.abs(dy) * 2; break;
                        case 'ArrowDown': isValid = dy > 10 && Math.abs(dx) < Math.abs(dy) * 2; break;
                        case 'ArrowLeft': isValid = dx < -10 && Math.abs(dy) < Math.abs(dx) * 2; break;
                        case 'ArrowRight': isValid = dx > 10 && Math.abs(dy) < Math.abs(dx) * 2; break;
                    }

                    if (isValid) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < minDistance) {
                            minDistance = dist;
                            bestCandidate = node;
                        }
                    }
                });

                if (bestCandidate) {
                    console.log('[UI] Jumping to node:', bestCandidate.id);
                    if (window.selectNode) window.selectNode(bestCandidate);
                    if (window.viewportManager && window.viewportManager.panToNode) {
                        window.viewportManager.panToNode(bestCandidate, true);
                    }
                } else {
                    console.log('[UI] No candidate found');
                }
            } else {
                console.log('[UI] Arrow key ignored: conditions not met');
            }
        }
    });

    // Update fullscreen button on fullscreen change
    document.addEventListener('fullscreenchange', updateFullscreenButton);

    // --- MODIFICATION: Moved and Enhanced Global Click Listener --- 
    document.addEventListener('click', (e) => {
        const dropdownMenu = document.getElementById('dropdown-menu');
        const menuButton = document.getElementById('menu-button');

        // Debug click target for "0 Selected" issue
        console.log('[UI] Global click:', e.target);

        if (dropdownMenu.classList.contains('show') &&
            !menuButton.contains(e.target) &&
            !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }

        // Close welcome modal when clicking outside (if projects are open)
        const activeWelcomeModal = document.getElementById('welcome-modal');
        if (activeWelcomeModal && activeWelcomeModal.classList.contains('active')) {
            // --- MODIFICATION: Check if projects exist --- 
            const projectsExist = window.projects && window.projects.length > 0;

            // Check if projects exist AND the click is outside the modal content
            if (projectsExist &&
                !activeWelcomeModal.querySelector('.modal-content').contains(e.target)) {

                // Check if the click was NOT on a known trigger element (logic remains the same)
                // ...
                const newTabButton = document.querySelector('.project-tab.new-tab');
                if (!menuButton.contains(e.target) &&
                    !(newTabButton && newTabButton.contains(e.target)) &&
                    !document.getElementById('new-mosaic-btn').contains(e.target) &&
                    !document.getElementById('upload-button').contains(e.target)
                ) {
                    console.log('[Global Click] Closing welcome modal on outside click (projects exist).');
                    hideModal(activeWelcomeModal);
                }
            }
            // --- END MODIFICATION --- 
        }

        // Close language dropdowns (logic remains the same)
        // ...
        document.querySelectorAll('.language-selector, .welcome-lang-clone').forEach(selector => {
            const optionsContainer = selector.querySelector('.language-options');
            if (optionsContainer?.classList.contains('show') && !selector.contains(e.target)) {
                optionsContainer.classList.remove('show');
            }
        });
    });
    // --- END MODIFICATION ---
}

// Refactored: Sets up logic for a language selector element
function setupLanguageSelectorLogic(selectorElement, isWelcomeClone = false) {
    if (!selectorElement) return;

    const currentLangDisplay = selectorElement.querySelector('.current-language');
    const languageOptionsContainer = selectorElement.querySelector('.language-options');
    const languageOptions = selectorElement.querySelectorAll('.language-option');

    // Update initial display based on currentLanguage
    if (currentLangDisplay && window.currentLanguage) {
        currentLangDisplay.textContent = window.currentLanguage.toUpperCase();
    }

    // Toggle dropdown on click
    selectorElement.addEventListener('click', (e) => {
        // Prevent welcome modal clone from closing dropdown when clicking inside
        if (e.target.closest('.language-option')) return;
        languageOptionsContainer.classList.toggle('show');
    });

    // Handle language selection
    languageOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent parent click handler
            const selectedLang = option.getAttribute('data-lang');
            languageOptionsContainer.classList.remove('show');

            if (isWelcomeClone) {
                // Welcome clone: Just set language dynamically for this session
                console.log(`Welcome language selected: ${selectedLang}. Setting dynamically.`);
                if (window.setLanguage) {
                    setLanguage(selectedLang);
                }
            } else {
                // Original selector (shouldn't exist anymore, but keeping logic safe)
                if (window.setLanguage) {
                    setLanguage(selectedLang);
                }
            }
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!selectorElement.contains(e.target)) {
            languageOptionsContainer.classList.remove('show');
        }
    });
}

// Initialize language based on browser settings
// Initialize language based on browser settings
function initLanguage() {
    // Get browser language or stored language
    let lang = localStorage.getItem('language') || navigator.language.split('-')[0];

    // Check if we support this language
    if (!translations[lang]) {
        lang = 'en';
    }

    // Set GLOBAL immediately
    window.currentLanguage = lang;
    currentLanguage = lang;

    // Apply to UI (can happen later if needed)
    setLanguage(lang);
}

// Run immediately to ensure window.currentLanguage is set before any nodes load
// But wait for DOM for setLanguage to work fully (it updates text)
// However, setLanguage calls updateUIText which needs DOM.
// So let's just set the variable NOW.
(function preInitLanguage() {
    let lang = localStorage.getItem('language') || navigator.language.split('-')[0];
    if (!translations[lang]) lang = 'en';
    window.currentLanguage = lang;
    currentLanguage = lang;
})();

// Set the application language
function setLanguage(lang) {
    if (!translations[lang]) return;

    currentLanguage = lang;
    window.currentLanguage = lang; // Update global reference
    localStorage.setItem('language', lang);

    // Update language display for ALL selectors
    document.querySelectorAll('.welcome-lang-clone .current-language').forEach(display => {
        if (display) {
            display.textContent = lang.toUpperCase();
        }
    });

    // Update UI text
    updateUIText();

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('languageChanged'));

    // Broadcast to all App Nodes
    if (window.nodeLoader) {
        window.nodeLoader.broadcastLanguage(lang);
    }
}

// Update all UI text based on current language
function updateUIText() {
    // Welcome modal
    document.querySelector('#welcome-modal .modal-body > p').textContent = getText('welcomeDescription');
    document.querySelector('#new-project-btn').innerHTML = `<i class="fas fa-plus-circle"></i> ${getText('newProject')}`;
    document.querySelector('#open-project-btn').innerHTML = `<i class="fas fa-folder-open"></i> ${getText('openProject')}`;

    // New project modal
    document.querySelector('#new-project-modal .modal-header h2').textContent = getText('createNewProject');
    document.querySelector('#new-project-modal label').textContent = getText('projectName');
    document.querySelector('#project-name').placeholder = getText('projectNamePlaceholder');
    document.querySelector('#create-project-btn').textContent = getText('create');

    // Rename project modal (if it exists)
    const renameModal = document.getElementById('rename-project-modal');
    if (renameModal) {
        const modalTitle = renameModal.querySelector('#rename-modal-title');
        if (modalTitle) modalTitle.textContent = getText('renameProject');

        const label = renameModal.querySelector('label[for="rename-project-name"]');
        if (label) label.textContent = getText('projectName');

        const input = renameModal.querySelector('#rename-project-name');
        if (input) input.placeholder = getText('projectNamePlaceholder');

        const saveBtn = renameModal.querySelector('#rename-save-btn');
        if (saveBtn) saveBtn.textContent = getText('save');

        const cancelBtn = renameModal.querySelector('.secondary-btn');
        if (cancelBtn) cancelBtn.textContent = getText('cancel');
    }

    // Menu items
    document.querySelector('#new-mosaic-btn').textContent = getText('newMosaic');
    document.querySelector('#save-button').textContent = getText('saveProject');
    document.querySelector('#upload-button').textContent = getText('openFile');
    document.querySelector('#export-button').textContent = getText('exportImage');
    document.querySelector('#export-pdf-button').textContent = getText('exportPDF'); // Set text for PDF button
    document.querySelector('#reset-canvas').textContent = getText('resetView');

    // Tooltips
    const nightModeToggle = document.getElementById('night-mode-toggle');
    if (nightModeToggle) nightModeToggle.title = getText('toggleNightMode');

    const fullscreenToggle = document.getElementById('fullscreen-toggle');
    if (fullscreenToggle) fullscreenToggle.title = getText('toggleFullscreen');

    // Update project tabs tooltips (handled in updateProjectTabs)

    // --- ADDED: Update Drive Dashboard Buttons Text ---
    const driveNewProjectBtn = document.getElementById('drive-new-project-btn');
    if (driveNewProjectBtn) {
        driveNewProjectBtn.innerHTML = `<i class="fas fa-plus-circle"></i> ${getText('driveNewProject') || 'New Project'}`;
    }
    const driveUploadBtn = document.getElementById('drive-upload-btn');
    if (driveUploadBtn) {
        driveUploadBtn.innerHTML = `<i class="fas fa-upload"></i> ${getText('driveUploadProject') || 'Upload Project'}`;
    }
    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
        signOutBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> ${getText('driveSignOut') || 'Sign Out'}`;
    }
    const driveTitle = document.querySelector('#drive-dashboard .drive-title');
    if (driveTitle) {
        driveTitle.textContent = getText('googleDriveProjectsTitle') || 'Google Drive Projects';
    }
    const driveLoading = document.querySelector('#drive-file-list .drive-loading');
    if (driveLoading) {
        // Update loading text only if it's currently visible/relevant
        // Might need more context awareness
        // driveLoading.textContent = getText('driveLoadingProjects') || 'Loading projects...';
    }
    const driveEmpty = document.querySelector('#drive-file-list .drive-empty');
    if (driveEmpty) {
        // Update empty text if it's currently visible
        driveEmpty.textContent = getText('driveEmpty') || 'No Mosaic projects found...';
    }
    // --- END ADDED ---
}

// Show a modal - Updated for conditional UI based on open projects
function showModal(modal, showCloseButton = false) {
    if (!modal) return;
    modal.style.display = 'flex';

    // --- MODIFICATION: Check if projects exist --- 
    const projectsExist = window.projects && window.projects.length > 0;
    console.log(`[showModal] Projects exist? ${projectsExist}`);
    // REMOVED: Video visibility check
    // const backgroundVideo = document.getElementById('background-video');
    // const isVideoVisible = backgroundVideo && backgroundVideo.style.display !== 'none';
    // console.log(`[showModal] Is video visible? ${isVideoVisible}`);

    // --- MODIFICATION: Conditional UI for Welcome Modal based on Projects --- 
    if (modal.id === 'welcome-modal') {
        const closeBtn = document.getElementById('welcome-modal-close-btn');
        const langClone = document.getElementById('welcome-language-selector-clone');
        const coverImage = modal.querySelector('.cover-image');
        const modalFooter = modal.querySelector('.modal-footer');

        // Show close button only if requested (triggered while projects exist)
        if (showCloseButton && closeBtn) {
            console.log('[showModal] Found close button, setting display to block.');
            closeBtn.style.display = 'block';
            if (!closeBtn.dataset.listenerAttached) {
                closeBtn.addEventListener('click', () => hideModal(modal));
                closeBtn.dataset.listenerAttached = 'true';
            }
        } else if (closeBtn) {
            closeBtn.style.display = 'none';
        }

        // Hide language selector clone if projects exist
        if (langClone) {
            langClone.style.display = projectsExist ? 'none' : 'flex';
            console.log('[showModal] Language clone display set to:', langClone.style.display);
        }

        // --- ADDED: Hide cover image and footer if projects exist --- 
        if (coverImage) {
            coverImage.style.display = projectsExist ? 'none' : 'block';
            console.log('[showModal] Cover image display set to:', coverImage.style.display);
        }
        if (modalFooter) {
            modalFooter.style.display = projectsExist ? 'none' : 'block';
            console.log('[showModal] Modal footer display set to:', modalFooter.style.display);
        }
        // --- END ADDED ---
    }
    // --- END MODIFICATION ---

    setTimeout(() => {
        modal.classList.add('active');
        // --- MODIFICATION: Add body class conditionally for Welcome Modal based on Projects --- 
        if (modal.id === 'new-project-modal' || modal.id === 'rename-project-modal' ||
            (modal.id === 'welcome-modal' && projectsExist)) { // Only apply blur if projects exist
            document.body.classList.add('body-modal-active');
            console.log('[showModal] Added body-modal-active class (projects exist).');
        } else {
            // Ensure class is removed if welcome modal shown initially (no projects)
            if (modal.id === 'welcome-modal' && !projectsExist) {
                document.body.classList.remove('body-modal-active');
                console.log('[showModal] Removed body-modal-active class (no projects).');
            }
        }
        // --- END MODIFICATION ---
    }, 10);
}

// Hide a modal
function hideModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');

    // --- MODIFICATION: Hide close button when welcome modal closes --- 
    if (modal.id === 'welcome-modal') {
        const closeBtn = document.getElementById('welcome-modal-close-btn');
        if (closeBtn) {
            closeBtn.style.display = 'none'; // Ensure it's hidden again
        }
    }
    // --- END MODIFICATION ---

    // Remove body class (already handles all relevant modal IDs)
    if (modal.id === 'new-project-modal' || modal.id === 'rename-project-modal' || modal.id === 'welcome-modal') {
        document.body.classList.remove('body-modal-active');
        console.log('[hideModal] Removed body-modal-active class.');
    }

    // Wait for animation to finish before setting display to none
    // Use the transition duration from CSS (0.3s = 300ms)
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

// Toggle night mode
function toggleNightMode() {
    document.body.classList.toggle('night-mode');

    // Update connections to reflect the new color scheme
    if (window.updateNodeConnections) {
        updateNodeConnections();
    }
}

// Toggle fullscreen mode
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((e) => {
            console.error(`Error attempting to enable fullscreen mode: ${e.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Update fullscreen button appearance
function updateFullscreenButton() {
    const fullscreenToggle = document.getElementById('fullscreen-toggle');

    // Toggle is-fullscreen class on body for title bar styling
    if (document.fullscreenElement) {
        document.body.classList.add('is-fullscreen');
    } else {
        document.body.classList.remove('is-fullscreen');
    }

    if (!fullscreenToggle) return;

    const enterIcon = fullscreenToggle.querySelector('.fullscreen-enter');
    const exitIcon = fullscreenToggle.querySelector('.fullscreen-exit');

    if (document.fullscreenElement) {
        // Show exit fullscreen icon
        if (enterIcon) enterIcon.style.display = 'none';
        if (exitIcon) exitIcon.style.display = 'inline';
    } else {
        // Show enter fullscreen icon
        if (enterIcon) enterIcon.style.display = 'inline';
        if (exitIcon) exitIcon.style.display = 'none';
    }
}

// Clear all nodes from the mindmap
function clearMindMap() {
    console.log('[clearMindMap] Starting full system reset...');
    // Remove all nodes
    document.querySelectorAll('.node').forEach(node => {
        node.remove();
    });

    // Remove all connection SVGs
    document.querySelectorAll('.connection-container').forEach(svg => {
        svg.remove();
    });

    // Remove all groups
    document.querySelectorAll('.group').forEach(group => {
        group.remove();
    });

    // Remove all stickers
    document.querySelectorAll('.canvas-sticker').forEach(sticker => {
        sticker.remove();
    });

    // Clear selected nodes set
    if (window.selectedNodes) {
        window.selectedNodes.clear();
    }

    // Clear groups map
    if (window.groups) {
        window.groups.clear();
    }

    // --- SYSTEM RESET ---
    // Clear Global Connections
    if (window.clearConnections) {
        window.clearConnections();
    }

    // Clear Node System Registry and Observers
    if (window.nodeSystem && window.nodeSystem.reset) {
        window.nodeSystem.reset();
    }

    // Clear Active Ports (V2 Nodes)
    if (window.activePorts) {
        window.activePorts = [];
        console.log('[clearMindMap] Cleared activePorts.');
    }

    // Clear DataCardStore (I/O panel data)
    if (window.dataCardStore && window.dataCardStore.reset) {
        window.dataCardStore.reset();
        console.log('[clearMindMap] Cleared DataCardStore.');
    }

    // Clear Action History? (Maybe not needed here as switchToProject handles it, but good practice)
    // window.actionHistory.clear() is called in switchToProject.

    console.log('[clearMindMap] System reset complete.');
}

// Setup menu button click handling
function setupMenuButton() {
    const menuButton = document.getElementById('menu-button');
    const dropdownMenu = document.getElementById('dropdown-menu');
    if (!menuButton || !dropdownMenu) return;

    menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
    });

    // REMOVED: Global click listener moved to initUI
}

// Export functions to global scope
window.initUI = initUI; // Ensure initUI is globally available for main.js
window.showModal = showModal;
window.hideModal = hideModal;
window.toggleNightMode = toggleNightMode;
window.toggleFullscreen = toggleFullscreen;
window.clearMindMap = clearMindMap;
window.setLanguage = setLanguage;
window.getText = getText;
// Note: exportAsPDF function itself will be defined elsewhere (likely file-management.js)
// and added to the window scope there.
