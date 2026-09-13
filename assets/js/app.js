const STORAGE_KEY = "vitalbov.state.v2";
const DB_NAME = "vitalbov-db";
const DB_VERSION = 1;
const STATUS_LABELS = {
  healthy: "Saudavel",
  heat: "Cio",
  alert: "Alerta",
  quarantine: "Quarentena"
};
const STATUS_COLORS = {
  healthy: "#577627",
  heat: "#9f5cc0",
  alert: "#bc3f32",
  quarantine: "#111111"
};
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const EDUCATION_LESSONS = [
  { id: "fundamentos", title: "Fundamentos da Pecuaria 4.0", duration: "8 min", level: "Essencial", summary: "Como dados, sensores e manejo integrado melhoram a rotina da fazenda.", points: ["Conectar tecnologia a decisoes de campo", "Separar alerta de tendencia", "Criar uma rotina diaria de leitura"] },
  { id: "sensores", title: "Sensores e qualidade da leitura", duration: "10 min", level: "Essencial", summary: "Leia movimento, temperatura e sinais vitais com confianca.", points: ["Verificar posicionamento do sensor", "Reconhecer leituras incompletas", "Registrar a primeira linha de base"] },
  { id: "cio", title: "Deteccao de cio orientada por dados", duration: "9 min", level: "Reproducao", summary: "Cruze balanceio, atividade e historico para priorizar observacoes.", points: ["Identificar aumento de atividade", "Confirmar sinais no curral", "Planejar a janela fertil"] },
  { id: "sanidade", title: "Sanidade e alerta precoce", duration: "12 min", level: "Sanidade", summary: "Transforme alteracoes de comportamento em protocolos de cuidado.", points: ["Comparar com o basal do animal", "Classificar alerta e urgencia", "Acionar a equipe veterinaria"] },
  { id: "quarentena", title: "Quarentena Digital", duration: "7 min", level: "Sanidade", summary: "Isole, acompanhe e documente animais que precisam de atencao.", points: ["Registrar o motivo do isolamento", "Acompanhar a evolucao", "Liberar somente com criterio"] },
  { id: "mapa", title: "Mapa vivo e georreferenciamento", duration: "8 min", level: "Operacao", summary: "Use o territorio da fazenda para localizar animais e lotes.", points: ["Ler limites A-B-C-D", "Encontrar o animal por area", "Planejar a ronda de manejo"] },
  { id: "lotes", title: "Lotes e manejo de precisao", duration: "11 min", level: "Operacao", summary: "Organize grupos por finalidade, fase e risco.", points: ["Definir lotes coerentes", "Filtrar o que exige acao", "Reduzir deslocamentos"] },
  { id: "rastreabilidade", title: "Rastreabilidade do rebanho", duration: "10 min", level: "Gestao", summary: "Mantenha um historico confiavel do animal do nascimento ao abate.", points: ["Padronizar identificadores", "Auditar mudancas", "Preparar relatorios"] },
  { id: "offline", title: "Operacao offline no campo", duration: "6 min", level: "Operacao", summary: "Continue registrando mesmo quando a internet desaparecer.", points: ["Entender o modo offline", "Sincronizar com seguranca", "Conferir leituras pendentes"] },
  { id: "lorawan", title: "Conectividade rural e LoRaWAN", duration: "9 min", level: "Tecnologia", summary: "Escolha conectividade para areas extensas e de baixa cobertura.", points: ["Diferenciar BLE, Wi-Fi e LoRaWAN", "Posicionar gateways", "Monitorar sinal"] },
  { id: "indicadores", title: "Indicadores para decidir melhor", duration: "10 min", level: "Gestao", summary: "Converta dados do rebanho em indicadores de rotina.", points: ["Acompanhar tendencia", "Definir meta de manejo", "Medir resultado"] },
  { id: "plano", title: "Plano de implantacao em 30 dias", duration: "14 min", level: "Avancado", summary: "Leve a Pecuaria 4.0 da apresentacao para a operacao.", points: ["Escolher o primeiro lote", "Treinar a equipe", "Revisar resultados semanalmente"] }
];
const VACCINE_CATALOG = [
  { id: "brucelose", name: "Brucelose", interval: 365, protocol: "Dose anual" },
  { id: "clostridioses", name: "Clostridioses", interval: 180, protocol: "Reforco semestral" },
  { id: "raiva", name: "Raiva bovina", interval: 365, protocol: "Dose anual" },
  { id: "aftosa", name: "Febre aftosa", interval: 180, protocol: "Campanha oficial" }
];
const VETERINARIANS = [
  { id: "marina", name: "Dra. Marina Costa", specialty: "Sanidade e reproducao", status: "Online", slot: "Hoje, 15:30", initials: "MC" },
  { id: "rafael", name: "Dr. Rafael Nunes", specialty: "Clinica de bovinos", status: "Disponivel", slot: "Hoje, 17:00", initials: "RN" },
  { id: "luciana", name: "Dra. Luciana Alves", specialty: "Nutricao e manejo", status: "Disponivel", slot: "Amanha, 08:30", initials: "LA" },
  { id: "paulo", name: "Dr. Paulo Mendes", specialty: "Reproducao de precisao", status: "Plantao", slot: "Amanha, 10:00", initials: "PM" }
];

const state = {
  activeView: "home",
  activeChart: "rumination",
  offline: false,
  cart: [],
  storeCategory: "Todos",
  trackingQuery: "",
  onboardingSeen: false,
  onboardingStep: 0,
  deferredInstallPrompt: null,
  filters: {
    status: "Todos",
    lot: "Todos"
  },
  selectedFarm: 0,
  map: null,
  markersLayer: null,
  farmBoundaryLayer: null,
  mapReady: false,
  leafletLoading: false,
  farmEditorMap: null,
  farmEditorMarkers: null,
  farmEditorPolygon: null,
  farmEditorReady: false,
  farmEditorActivePoint: "A",
  telemetryTimer: null,
  chipRealtimeTimer: null,
  activeChipAnimalId: null,
  bleDevice: null,
  bleCharacteristic: null,
  bleBuffer: "",
  bleAnimalId: null,
  educationCompleted: [],
  ...loadSavedState()
};

let db = null;
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const baseData = window.VITALBOV_DATA;
const appData = {
  farm: state.farm || cloneData(baseData.farm),
  animals: state.animals || cloneData(baseData.animals),
  notices: state.notices || cloneData(baseData.notices),
  orders: state.orders || [],
  events: state.events || [],
  products: cloneData(baseData.products),
  chartData: cloneData(baseData.chartData)
};

document.addEventListener("DOMContentLoaded", async () => {
  await initDatabase();
  await hydrateFromDatabase();
  bindEvents();
  initOnboarding();
  renderAll();
  openView("home");
  startTelemetry();
  registerServiceWorker();
});

function bindEvents() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => openView(button.dataset.view));
  });

  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-open-view]");
    if (viewButton) openView(viewButton.dataset.openView);

    const chartButton = event.target.closest("[data-chart]");
    if (chartButton) setActiveChart(chartButton);

    const animalButton = event.target.closest("[data-open-animal]");
    if (animalButton) openAnimalDetail(animalButton.dataset.openAnimal);

    const panelButton = event.target.closest("[data-open-panel]");
    if (panelButton) openInfoPanel(panelButton.dataset.openPanel);

    const addCart = event.target.closest("[data-add-cart]");
    if (addCart) addToCart(addCart.dataset.addCart);

    const submitAnimal = event.target.closest("[data-submit-animal]");
    if (submitAnimal) saveAnimalFromForm(submitAnimal.dataset.submitAnimal);

    const clearPhotoButton = event.target.closest("[data-clear-photo]");
    if (clearPhotoButton) clearAnimalPhotoPreview();

    const removeProfilePhotoButton = event.target.closest("[data-remove-profile-photo]");
    if (removeProfilePhotoButton) removeProfilePhoto();

    const importButton = event.target.closest("[data-import-csv]");
    if (importButton) importCsvAnimals();

    const quarantineButton = event.target.closest("[data-quarantine]");
    if (quarantineButton) setAnimalQuarantine(quarantineButton.dataset.quarantine);

    const treatmentButton = event.target.closest("[data-treatment]");
    if (treatmentButton) registerTreatment(treatmentButton.dataset.treatment);

    const editButton = event.target.closest("[data-edit-animal]");
    if (editButton) openAnimalForm(editButton.dataset.editAnimal);

    const reportButton = event.target.closest("[data-print-report]");
    if (reportButton) generateReport(reportButton.dataset.printReport);

    const chipButton = event.target.closest("[data-read-chip]");
    if (chipButton) readChipTelemetry(chipButton.dataset.readChip);

    const bluetoothButton = event.target.closest("[data-connect-chip-ble]");
    if (bluetoothButton) connectChipBluetooth(bluetoothButton.dataset.connectChipBle);

    const lessonButton = event.target.closest("[data-open-lesson]");
    if (lessonButton) openEducationLesson(lessonButton.dataset.openLesson);

    const completeLessonButton = event.target.closest("[data-complete-lesson]");
    if (completeLessonButton) completeEducationLesson(completeLessonButton.dataset.completeLesson);

    const orderButton = event.target.closest("[data-finalize-order]");
    if (orderButton) finalizeOrder();

    const saveProfileButton = event.target.closest("[data-save-profile]");
    if (saveProfileButton) saveProfile();

    const boundaryPointButton = event.target.closest("[data-select-boundary-point]");
    if (boundaryPointButton) selectFarmEditorPoint(boundaryPointButton.dataset.selectBoundaryPoint);

    const fitBoundaryButton = event.target.closest("[data-fit-farm-editor]");
    if (fitBoundaryButton) fitFarmEditorMap();

    const enablePushButton = event.target.closest("[data-enable-push]");
    if (enablePushButton) enablePushNotifications();

    const readAllButton = event.target.closest("[data-read-all]");
    if (readAllButton) markNotificationsRead();

    const exportDataButton = event.target.closest("[data-export-data]");
    if (exportDataButton) exportDataBackup();

    const resetDataButton = event.target.closest("[data-reset-data]");
    if (resetDataButton) resetLocalData();

    const sendVetButton = event.target.closest("[data-send-vet]");
    if (sendVetButton) sendVetMessage();

    const scheduleVetButton = event.target.closest("[data-schedule-vet]");
    if (scheduleVetButton) scheduleVetVisit();

    const vaccineButton = event.target.closest("[data-register-vaccine]");
    if (vaccineButton) registerVaccine(vaccineButton.dataset.registerVaccine, vaccineButton.dataset.animalId);

    const cartIncrease = event.target.closest("[data-cart-increase]");
    if (cartIncrease) changeCartQuantity(cartIncrease.dataset.cartIncrease, 1);

    const cartDecrease = event.target.closest("[data-cart-decrease]");
    if (cartDecrease) changeCartQuantity(cartDecrease.dataset.cartDecrease, -1);

    const copyPixButton = event.target.closest("[data-copy-pix]");
    if (copyPixButton) copyPixCode();

    if (event.target.matches("[data-close-modal]")) closeModal();
  });

  $("#trackingSearch").addEventListener("input", (event) => {
    state.trackingQuery = event.target.value;
    renderTrackingList();
    updateMapMarkers();
  });
  $("#storeSearch").addEventListener("input", renderStore);
  $("#toggleOffline").addEventListener("click", toggleOffline);
  $("#openAnimalForm").addEventListener("click", () => openAnimalForm());
  $("#bulkImport").addEventListener("click", openBulkImport);
  $("#checkoutButton").addEventListener("click", openCheckout);
  $("#openNotifications").addEventListener("click", () => openInfoPanel("notifications"));
  $("#openFilters").addEventListener("click", openFilters);
  $("#farmSwitch").addEventListener("click", openFarmSwitcher);
  $("#darkModeToggle").addEventListener("click", toggleDarkMode);
  $("#skipOnboarding").addEventListener("click", completeOnboarding);
  $("#nextOnboarding").addEventListener("click", nextOnboardingStep);
  $("#installPwaButton").addEventListener("click", installPwa);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    $("#installPwaButton").hidden = false;
  });
  document.addEventListener("change", (event) => {
    if (event.target.matches("#animalPhotoInput")) previewAnimalPhoto(event.target);
    if (event.target.matches("#profilePhotoInput")) updateProfilePhoto(event.target);
    if (event.target.matches("#vaccineAnimalSelect")) renderVaccineView();
    if (event.target.matches("#vaccinePanelAnimal")) {
      const list = $("#vaccinePanelList");
      if (list) list.innerHTML = vaccineRecordsMarkup(findAnimal(event.target.value));
    }
    if (event.target.matches("#paymentMethod")) renderPaymentDetails();
  });
  window.addEventListener("resize", () => {
    drawChart();
    if (state.map) state.map.invalidateSize();
  });
}

function renderAll() {
  renderDashboard();
  renderNotices();
  renderAnimals();
  renderTrackingList();
  renderStore();
  renderVaccineView();
  renderProfile();
  drawChart();
}

function loadSavedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function cloneData(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

async function initDatabase() {
  if (!("indexedDB" in window)) return;

  try {
    db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        createStore(database, "farms", "id");
        createStore(database, "animals", "id");
        createStore(database, "notices", "id");
        createStore(database, "cart", "id");
        createStore(database, "orders", "id");
        createStore(database, "events", "id");
        createStore(database, "settings", "key");
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    db = null;
  }
}

function createStore(database, name, keyPath) {
  if (!database.objectStoreNames.contains(name)) {
    database.createObjectStore(name, { keyPath });
  }
}

async function hydrateFromDatabase() {
  if (!db) {
    normalizeState();
    return;
  }

  const [farms, animals, notices, cart, orders, events, settings] = await Promise.all([
    dbGetAll("farms"),
    dbGetAll("animals"),
    dbGetAll("notices"),
    dbGetAll("cart"),
    dbGetAll("orders"),
    dbGetAll("events"),
    dbGetAll("settings")
  ]);

  if (farms.length) appData.farm = farms[0];
  if (animals.length) appData.animals = animals;
  if (notices.length) appData.notices = notices.sort((a, b) => b.createdAt - a.createdAt);
  if (orders.length) appData.orders = orders.sort((a, b) => b.createdAt - a.createdAt);
  if (events.length) appData.events = events.sort((a, b) => b.createdAt - a.createdAt);
  if (cart.length) {
    state.cart = cart.flatMap((item) => Array.from({ length: item.qty }, () => item.id));
  }
  settings.forEach((item) => {
    if (item.key === "offline") state.offline = item.value;
    if (item.key === "selectedFarm") state.selectedFarm = item.value;
    if (item.key === "onboardingSeen") state.onboardingSeen = item.value;
    if (item.key === "educationCompleted") state.educationCompleted = item.value || [];
  });

  normalizeState();

  if (!farms.length || !animals.length) {
    await persist();
  }
}

function normalizeState() {
  state.educationCompleted = Array.isArray(state.educationCompleted) ? state.educationCompleted : [];
  appData.farm.id ||= "default";
  appData.farm.updatedAt ||= Date.now();
  appData.farm.boundary = normalizeBoundary(appData.farm.boundary);
  appData.farm.center = boundaryCenter(appData.farm.boundary);
  appData.animals = appData.animals.map((animal, index) => {
    const baseChip = index === 0 ? baseData.animals[0]?.chip : null;
    return {
      ...animal,
      chip: baseChip ? { ...animal.chip, ...baseChip, enabled: true, animalId: animal.id } : undefined,
      photo: animal.photo || defaultAnimalPhoto(animal.id),
      coords: clampToFarm(animal.coords || randomInsideFarm("C")),
      zone: animal.zone || zoneForCoords(animal.coords || appData.farm.center),
      vaccines: normalizeVaccines(animal.vaccines, index),
      updatedAt: animal.updatedAt || Date.now()
    };
  });
  appData.notices = appData.notices.map((notice) => ({
    ...notice,
    id: notice.id || cryptoRandomId("notice"),
    read: Boolean(notice.read),
    createdAt: notice.createdAt || Date.now()
  }));
  appData.orders = appData.orders.map((order) => ({
    ...order,
    id: order.id || cryptoRandomId("order"),
    createdAt: order.createdAt || Date.now()
  }));
  appData.events = appData.events.map((event) => ({
    ...event,
    id: event.id || cryptoRandomId("event"),
    createdAt: event.createdAt || Date.now()
  }));
}

async function persist() {
  const payload = {
    farm: appData.farm,
    animals: appData.animals,
    notices: appData.notices,
    orders: appData.orders,
    events: appData.events,
    cart: state.cart,
    offline: state.offline,
    selectedFarm: state.selectedFarm,
    onboardingSeen: state.onboardingSeen,
    educationCompleted: state.educationCompleted
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  if (!db) return;

  try {
    normalizeState();
    await Promise.all([
      dbReplaceAll("farms", [appData.farm]),
      dbReplaceAll("animals", appData.animals),
      dbReplaceAll("notices", appData.notices),
      dbReplaceAll("orders", appData.orders),
      dbReplaceAll("events", appData.events),
      dbReplaceAll("cart", Object.values(groupCart()).map((item) => ({ id: item.product.id, qty: item.qty }))),
      dbReplaceAll("settings", [
        { key: "offline", value: state.offline },
        { key: "selectedFarm", value: state.selectedFarm },
        { key: "onboardingSeen", value: state.onboardingSeen },
        { key: "educationCompleted", value: state.educationCompleted }
      ])
    ]);
  } catch {
    db = null;
  }
}

function dbGetAll(storeName) {
  if (!db) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function dbReplaceAll(storeName, records) {
  if (!db) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    store.clear();
    records.forEach((record) => store.put(record));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function cryptoRandomId(prefix) {
  const random = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

function openView(view) {
  state.activeView = view;
  $$(".view").forEach((section) => section.classList.remove("active"));
  $(`#view-${view}`).classList.add("active");
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $("#screenTitle").textContent = $(`#view-${view}`).dataset.title;
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (view === "home") drawChart();
  if (view === "tracking") {
    initLeafletMap();
    setTimeout(() => {
      if (state.map) state.map.invalidateSize();
    }, 80);
  }
}

function renderDashboard() {
  const total = appData.animals.length;
  const healthy = countByStatus("healthy");
  const heat = countByStatus("heat");
  const alert = countByStatus("alert") + countByStatus("quarantine");

  $("#farmNameLabel").textContent = appData.farm.name;
  $("#metricTotal").textContent = total;
  $("#metricTotalHelp").textContent = `${appData.farm.name} - ${appData.farm.city}/${appData.farm.state}`;
  $("#metricHealthy").textContent = percent(healthy, total);
  $("#metricHealthyHelp").textContent = `${healthy} animais`;
  $("#metricHeat").textContent = percent(heat, total);
  $("#metricHeatHelp").textContent = `${heat} vacas`;
  $("#metricAlert").textContent = percent(alert, total);
  $("#metricAlertHelp").textContent = `${alert} casos`;
  const chipAnimal = appData.animals.find((animal) => animal.chip?.enabled);
  $("#syncStatus").textContent = state.offline
    ? `Offline - ${appData.farm.pendingSync} leituras aguardando sincronizacao`
    : chipAnimal
      ? `Online - chip ${chipAnimal.chip.board}/${chipAnimal.chip.sensor} ativo em ${chipAnimal.id}`
      : "Online - LoRaWAN estavel";
  $("#toggleOffline").textContent = state.offline ? "Sincronizar" : "Simular offline";

  const priority = appData.animals.find((animal) => animal.status === "quarantine")
    || appData.animals.find((animal) => animal.status === "alert")
    || appData.animals.find((animal) => animal.status === "heat");
  if (priority) {
    $("#priorityAlert").innerHTML = `
      <div>
        <span class="status-badge ${priority.status}">${priority.status === "heat" ? "Cio detectado" : "Quarentena Digital"}</span>
        <h2>Brinco ${priority.id}: ${priority.alerts[0]}</h2>
        <p>${priority.name} esta em ${priority.lot}. Temperatura atual ${priority.temp} C, atividade ${priority.activity.toLowerCase()}.</p>
      </div>
      <button class="btn btn-light" data-open-animal="${priority.id}">Ver animal</button>
    `;
  }

  appData.chartData = buildChartData();
  const quickTagCount = $("#quickTagCount");
  if (quickTagCount) quickTagCount.textContent = `${total} ativos`;
}

function buildChartData() {
  const animals = appData.animals;
  return {
    rumination: {
      label: "Ruminacao media (min)",
      values: averageHistory(animals, "rumination"),
      color: "#577627"
    },
    temperature: {
      label: "Temperatura media (C)",
      values: averageHistory(animals, "temp"),
      color: "#bc3f32"
    },
    heat: {
      label: "Eventos de cio",
      values: [1, 2, 1, countByStatus("heat"), 2, countByStatus("heat") + 1, countByStatus("heat")],
      color: "#9f5cc0"
    }
  };
}

function averageHistory(animals, key) {
  const length = animals[0]?.history?.[key]?.length || 7;
  return Array.from({ length }, (_, index) => {
    const values = animals.map((animal) => Number(animal.history?.[key]?.[index] || 0)).filter(Boolean);
    const avg = values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
    return Number(avg.toFixed(key === "temp" ? 1 : 0));
  });
}

function renderNotices() {
  $("#noticeList").innerHTML = appData.notices.slice(0, 3).map(noticeTemplate).join("");
  const hasUnread = appData.notices.some((notice) => !notice.read);
  $(".pulse-dot").style.display = hasUnread ? "block" : "none";
}

function renderAnimals() {
  $("#animalGrid").innerHTML = appData.animals.map(animalCard).join("");
}

function renderTrackingList() {
  const animals = getFilteredAnimals();
  $("#trackingList").innerHTML = animals.length
    ? animals.map(animalRow).join("")
    : `<article class="empty-state">Nenhum animal encontrado com os filtros atuais.</article>`;
}

function getFilteredAnimals() {
  const normalized = state.trackingQuery.trim().toLowerCase();
  return appData.animals.filter((animal) => {
    const searchMatch = [animal.id, animal.name, animal.lot, animal.breed].join(" ").toLowerCase().includes(normalized);
    const statusMatch = state.filters.status === "Todos" || animal.status === state.filters.status;
    const lotMatch = state.filters.lot === "Todos" || animal.lot === state.filters.lot;
    return searchMatch && statusMatch && lotMatch;
  });
}

function animalCard(animal) {
  const chipLabel = animal.chip?.enabled ? ` | chip ${animal.chip.board}` : "";
  return `
    <button class="animal-card" data-open-animal="${animal.id}">
      <img class="animal-thumb" src="${animal.photo}" alt="Foto de ${animal.name}">
      <div>
        <strong>${animal.name} - ${animal.id}</strong>
        <p>${animal.breed} | ${animal.lot} | Area ${animal.zone || zoneForCoords(animal.coords)} | bateria ${animal.battery}%${chipLabel}</p>
      </div>
      <span class="status-badge ${animal.status}">${animal.statusLabel}</span>
    </button>
  `;
}

function animalRow(animal) {
  return `
    <button class="animal-row" data-open-animal="${animal.id}">
      <img class="animal-thumb" src="${animal.photo}" alt="Foto de ${animal.name}">
      <div>
        <strong>${animal.id} - ${animal.name}</strong>
        <p>${animal.lot} | Area ${animal.zone || zoneForCoords(animal.coords)} | ${animal.temp} C | ${animal.activity} | visto ${animal.lastSeen}</p>
      </div>
      <span class="status-badge ${animal.status}">${animal.statusLabel}</span>
    </button>
  `;
}

function initLeafletMap() {
  if (!window.L) {
    renderFallbackMap();
    loadLeafletAssets().then((loaded) => {
      if (loaded && state.activeView === "tracking") initLeafletMap();
    });
    return;
  }
  $("#mapFallback").hidden = true;
  if (!state.map) {
    state.map = L.map("animalMap", {
      zoomControl: true,
      attributionControl: true
    }).setView(appData.farm.center, 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(state.map);

    state.markersLayer = L.layerGroup().addTo(state.map);
    state.farmBoundaryLayer = L.polygon(farmBoundaryPoints(), {
      color: "#577627",
      weight: 3,
      fillColor: "#85b024",
      fillOpacity: 0.12,
      dashArray: "7 6"
    }).addTo(state.map);
  }
  state.mapReady = true;
  updateMapMarkers();
}

function loadLeafletAssets() {
  if (window.L) return Promise.resolve(true);
  if (state.leafletLoading) return state.leafletLoading;

  state.leafletLoading = new Promise((resolve) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
      const style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = LEAFLET_CSS_URL;
      document.head.appendChild(style);
    }

    if (document.querySelector(`script[src="${LEAFLET_JS_URL}"]`)) {
      resolve(Boolean(window.L));
      return;
    }

    const script = document.createElement("script");
    const timeout = window.setTimeout(() => resolve(false), 4500);
    script.src = LEAFLET_JS_URL;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timeout);
      resolve(Boolean(window.L));
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      resolve(false);
    };
    document.head.appendChild(script);
  }).finally(() => {
    state.leafletLoading = false;
  });

  return state.leafletLoading;
}

function updateMapMarkers() {
  if (!state.mapReady || !state.markersLayer) {
    renderFallbackMap();
    return;
  }
  if (state.farmBoundaryLayer) state.farmBoundaryLayer.setLatLngs(farmBoundaryPoints());
  const animals = getFilteredAnimals();
  state.markersLayer.clearLayers();
  animals.forEach((animal) => {
    const marker = L.marker(animal.coords, { icon: markerIcon(animal.status) })
      .bindPopup(`
        <strong>${animal.name} - ${animal.id}</strong><br>
        ${animal.statusLabel} | ${animal.temp} C<br>
        ${animal.lot}<br>
        <button class="leaflet-popup-button" data-open-animal="${animal.id}">Ver detalhes</button>
      `);
    marker.addTo(state.markersLayer);
  });
  if (animals.length) {
    state.map.fitBounds(farmBoundaryPoints().concat(animals.map((animal) => animal.coords)), { padding: [24, 24], maxZoom: 16 });
  }
}

function markerIcon(status) {
  return L.divIcon({
    className: "vital-marker",
    html: `<span style="background:${STATUS_COLORS[status] || STATUS_COLORS.healthy}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
}

function renderFallbackMap() {
  const fallback = $("#mapFallback");
  if (!fallback) return;
  const animals = getFilteredAnimals();
  fallback.hidden = false;
  const boundary = appData.farm.boundary;
  const corners = Object.entries(boundary).map(([label, coords]) => {
    const position = coordsToMapPosition(coords);
    return `<span class="map-corner" style="left:${position.left}%;top:${position.top}%"><strong>${label}</strong><small>${formatCoordinatePair(coords)}</small></span>`;
  }).join("");
  fallback.innerHTML = `<div class="map-grid"></div><div class="map-boundary-shape"></div>${corners}${animals.map((animal) => {
    const position = coordsToMapPosition(animal.coords);
    return `<button class="map-pin ${animal.status}" style="left:${position.left}%;top:${position.top}%" data-open-animal="${animal.id}">${animal.id}</button>`;
  }).join("")}`;
}

function renderStore() {
  const categories = ["Todos", ...new Set(appData.products.map((product) => product.category))];
  $("#storeCategories").innerHTML = categories.map((category) => `
    <button class="segmented ${state.storeCategory === category ? "active" : ""}" data-store-category="${category}">${category}</button>
  `).join("");

  $$("#storeCategories button").forEach((button) => {
    button.addEventListener("click", () => {
      state.storeCategory = button.dataset.storeCategory;
      renderStore();
    });
  });

  const term = $("#storeSearch").value.trim().toLowerCase();
  const products = appData.products.filter((product) => {
    const categoryMatch = state.storeCategory === "Todos" || product.category === state.storeCategory;
    const textMatch = [product.name, product.category, product.recommended].join(" ").toLowerCase().includes(term);
    return categoryMatch && textMatch;
  });

  $("#productGrid").innerHTML = products.map((product) => `
    <article class="product-card ${isRecommendedProduct(product) ? "recommended" : ""}">
      <div class="product-media"><img src="${product.image || "assets/img/product-generic.svg"}" alt="${product.name}"><span>${product.category}</span></div>
      <div class="product-body">
        <h3>${product.name}</h3>
        <p>${product.recommended}</p>
        <div class="price-row">
          <strong>${formatCurrency(product.price)}</strong>
          <button class="add-cart" data-add-cart="${product.id}" aria-label="Adicionar ${product.name}">
            <svg><use href="#icon-plus"></use></svg>
          </button>
        </div>
      </div>
    </article>
  `).join("");
  updateCartCount();
}

function renderProfile() {
  $("#profileOwner").textContent = appData.farm.owner;
  $("#profileRole").textContent = `Produtor rural - ${appData.farm.name}`;
  $("#profileLocation").textContent = `${appData.farm.city}, ${appData.farm.state}`;
  const avatar = $("#profileAvatar");
  avatar.textContent = "";
  avatar.classList.toggle("has-photo", Boolean(appData.farm.profilePhoto));
  if (appData.farm.profilePhoto) {
    const image = document.createElement("img");
    image.src = appData.farm.profilePhoto;
    image.alt = `Foto de perfil de ${appData.farm.owner}`;
    avatar.appendChild(image);
  } else {
    avatar.textContent = initials(appData.farm.owner);
  }
  const devices = $("#view-profile [data-open-panel='devices'] span");
  if (devices) devices.textContent = `${appData.animals.length} ativos`;
}

function initOnboarding() {
  if (state.onboardingSeen) {
    closeOnboarding();
    return;
  }
  document.body.classList.add("onboarding-open");
  $("#onboarding").classList.add("active");
  renderOnboardingStep();
}

function renderOnboardingStep() {
  $$(".onboarding-step").forEach((step) => {
    step.classList.toggle("active", Number(step.dataset.step) === state.onboardingStep);
  });
  $("#onboardingDots").innerHTML = $$(".onboarding-step").map((step, index) => `
    <button class="${index === state.onboardingStep ? "active" : ""}" aria-label="Ir para etapa ${index + 1}" data-onboarding-dot="${index}"></button>
  `).join("");
  $$("#onboardingDots button").forEach((button) => {
    button.addEventListener("click", () => {
      state.onboardingStep = Number(button.dataset.onboardingDot);
      renderOnboardingStep();
    });
  });
  $("#nextOnboarding").textContent = state.onboardingStep === 3 ? "Comecar operacao" : "Continuar";
}

function nextOnboardingStep() {
  if (state.onboardingStep < 3) {
    state.onboardingStep += 1;
    renderOnboardingStep();
    return;
  }
  completeOnboarding();
}

function completeOnboarding() {
  const owner = $("#onboardOwner")?.value.trim();
  const email = $("#onboardEmail")?.value.trim();
  const farm = $("#onboardFarm")?.value.trim();
  const herd = Number($("#onboardHerd")?.value || appData.animals.length);
  if (owner) appData.farm.owner = owner;
  if (email) appData.farm.email = email;
  if (farm) appData.farm.name = farm;
  appData.farm.herdSize = herd || appData.animals.length;
  appData.farm.boundary = normalizeBoundary({
    A: parseCoordinatePair($("#onboardPointA")?.value, appData.farm.boundary.A),
    B: parseCoordinatePair($("#onboardPointB")?.value, appData.farm.boundary.B),
    C: parseCoordinatePair($("#onboardPointC")?.value, appData.farm.boundary.C),
    D: parseCoordinatePair($("#onboardPointD")?.value, appData.farm.boundary.D)
  });
  appData.farm.center = boundaryCenter(appData.farm.boundary);
  fitAnimalsToFarm();
  appData.farm.verified = true;
  state.onboardingSeen = true;
  addNotice("V", "E-mail verificado", "Cadastro inicial confirmado e fazenda pronta para monitoramento.", "Agora");
  addEvent("onboarding.complete", "Cadastro inicial do produtor e fazenda concluido.");
  closeOnboarding();
  persist();
  renderAll();
}

function closeOnboarding() {
  document.body.classList.remove("onboarding-open");
  $("#onboarding").classList.remove("active");
}

async function installPwa() {
  if (!state.deferredInstallPrompt) {
    addNotice("P", "PWA pronto", "Use o menu do navegador para adicionar o VitalBov a tela inicial.", "Agora");
    renderNotices();
    return;
  }
  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice.catch(() => null);
  state.deferredInstallPrompt = null;
  $("#installPwaButton").hidden = true;
}

function isRecommendedProduct(product) {
  const hasAlert = appData.animals.some((animal) => animal.status === "alert" || animal.status === "quarantine");
  const hasHeat = appData.animals.some((animal) => animal.status === "heat");
  if (hasAlert && ["Sanidade", "Vacinas", "Servicos"].includes(product.category)) return true;
  if (hasHeat && product.name.toLowerCase().includes("vet")) return true;
  return product.id === "p1" && appData.animals.length < (appData.farm.herdSize || appData.animals.length);
}

function addToCart(productId) {
  const product = appData.products.find((item) => item.id === productId);
  if (!product) return;
  state.cart.push(productId);
  addNotice("L", "Produto adicionado", `${product.name} foi adicionado ao carrinho.`, "Agora");
  addEvent("store.cart.add", `Produto ${product.name} adicionado ao carrinho.`);
  updateCartCount();
  persist();
}

function updateCartCount() {
  $("#cartCount").textContent = `${state.cart.length} ${state.cart.length === 1 ? "item" : "itens"}`;
}

function setActiveChart(button) {
  state.activeChart = button.dataset.chart;
  $$(".segmented[data-chart]").forEach((item) => item.classList.toggle("active", item === button));
  drawChart();
}

function drawChart() {
  const canvas = $("#mainChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = 190 * ratio;
  ctx.scale(ratio, ratio);

  const chart = appData.chartData[state.activeChart];
  const values = chart.values;
  const width = rect.width;
  const height = 180;
  const padding = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--line").trim();
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = padding + i * ((height - padding * 2) / 3);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  const points = values.map((value, index) => ({
    x: padding + index * ((width - padding * 2) / (values.length - 1)),
    y: height - padding - ((value - min) / spread) * (height - padding * 2)
  }));

  const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
  gradient.addColorStop(0, `${chart.color}55`);
  gradient.addColorStop(1, `${chart.color}00`);

  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.lineTo(points[points.length - 1].x, height - padding);
  ctx.lineTo(points[0].x, height - padding);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.strokeStyle = chart.color;
  ctx.lineWidth = 3;
  ctx.stroke();

  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = chart.color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("color");
  ctx.font = "700 12px Inter, sans-serif";
  ctx.fillText(chart.label, padding, 18);
  ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].forEach((day, index) => {
    ctx.fillText(day, points[index].x - 10, height - 4);
  });
}

function openAnimalDetail(id) {
  const animal = findAnimal(id);
  if (!animal) return;
  const chip = animal.chip?.enabled ? chipTelemetryPanel(animal) : "";
  stopChipRealtime();

  openModal(`
    <div class="sheet-header">
      <h2>${animal.name} - ${animal.id}</h2>
      <button class="close-btn" data-close-modal aria-label="Fechar">x</button>
    </div>
    <div class="animal-detail-hero">
      <img src="${animal.photo}" alt="Foto de ${animal.name}">
      <div>
        <span class="status-badge ${animal.status}">${animal.statusLabel}</span>
        <p>${animal.breed} | ${animal.sex} | ${animal.weight} kg</p>
        <p>Nascimento: ${formatDate(animal.born)} | bateria ${animal.battery}%</p>
      </div>
    </div>
    <div class="detail-metrics">
      <div><span>Temperatura</span><strong>${animal.temp} C</strong></div>
      <div><span>Atividade</span><strong>${animal.activity}</strong></div>
      <div><span>Ruminacao</span><strong>${animal.rumination}</strong></div>
      <div><span>Comportamento</span><strong>${animal.behavior}</strong></div>
    </div>
    ${chip}
    <section class="panel">
      <div class="section-title"><h2>Status reprodutivo</h2><span class="status-badge heat">${animal.reproductive}</span></div>
      <canvas id="animalChart" height="150"></canvas>
    </section>
    <h3>Historico de alertas e quarentenas</h3>
    <div class="timeline">${animal.alerts.map((alert) => `<div>${alert}</div>`).join("")}</div>
    <div class="action-strip">
      <button class="btn btn-primary" data-quarantine="${animal.id}">Quarentena Digital</button>
      <button class="btn btn-secondary" data-treatment="${animal.id}">Registrar tratamento</button>
    </div>
    <button class="btn btn-secondary" style="width:100%" data-edit-animal="${animal.id}">Editar animal</button>
  `);
  setTimeout(() => drawTinyAnimalChart(animal), 0);
  if (animal.chip?.enabled) startChipRealtime(animal.id);
}

function chipTelemetryPanel(animal) {
  const chip = animal.chip;
  return `
    <section class="panel chip-panel">
      <div class="section-title">
        <h2>Chip prototipo</h2>
        <span class="status-badge healthy">${chip.board} + ${chip.sensor}</span>
      </div>
      <div class="detail-metrics">
        <div><span>Animal vinculado</span><strong>${chip.animalId}</strong></div>
        <div><span>Batimentos</span><strong id="chipHeartRate">${chip.heartRate} bpm</strong></div>
        <div><span>Oxigenacao</span><strong id="chipSpo2">${chip.spo2}%</strong></div>
        <div><span>Movimento</span><strong id="chipMovement">${chip.movementScore}</strong></div>
        <div><span>Balanceio</span><strong id="chipSway">${chip.swayScore}</strong></div>
        <div><span>Prob. de cio</span><strong id="chipHeat">${chip.heatProbability}%</strong></div>
        <div><span>Status do cio</span><strong id="chipHeatStatus">${chip.heatDetected ? "Possivel cio" : "Normal"}</strong></div>
      </div>
      <div class="chip-note">Bluetooth BLE ativo. Simulação somente até chegar uma telemetria real do firmware ${chip.firmware}.</div>
      <div class="chip-live-status" id="chipLiveStatus">Aguardando leitura do chip...</div>
      <div class="chip-actions">
        <button class="btn btn-primary" data-connect-chip-ble="${animal.id}">Conectar Bluetooth</button>
        <button class="btn btn-secondary" data-read-chip="${animal.id}">Ler chip agora</button>
      </div>
    </section>
  `;
}

function startChipRealtime(id) {
  const animal = findAnimal(id);
  if (state.bleCharacteristic && state.bleAnimalId === id) {
    state.activeChipAnimalId = id;
    return;
  }
  if (isHttpsToLocalChip(animal)) {
    const liveStatus = $("#chipLiveStatus");
    if (liveStatus) liveStatus.textContent = chipConnectionHelp(animal);
    return;
  }

  state.activeChipAnimalId = id;
  readChipTelemetry(id, { silent: true });
  state.chipRealtimeTimer = setInterval(() => {
    readChipTelemetry(id, { silent: true });
  }, 3000);
}

function stopChipRealtime() {
  if (state.chipRealtimeTimer) clearInterval(state.chipRealtimeTimer);
  state.chipRealtimeTimer = null;
  state.activeChipAnimalId = null;
}

async function readChipTelemetry(id, options = {}) {
  const animal = findAnimal(id);
  if (!animal?.chip?.enabled) return;
  const liveStatus = $("#chipLiveStatus");

  if (state.bleCharacteristic) {
    if (liveStatus) liveStatus.textContent = "Bluetooth conectado. Aguardando a proxima notificacao...";
    return;
  }

  if (isHttpsToLocalChip(animal)) {
    const help = chipConnectionHelp(animal);
    if (liveStatus) liveStatus.textContent = help;
    return;
  }

  if (liveStatus) liveStatus.textContent = "Lendo chip...";

  try {
    const response = await fetch(animal.chip.endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error("telemetry unavailable");

    const telemetry = await response.json();
    if (telemetry.animalId !== animal.id) {
      addNotice("!", "Chip ignorado", `Leitura recebida de ${telemetry.animalId || "animal desconhecido"}, nao de ${animal.id}.`, "Agora");
      renderNotices();
      return;
    }

    applyChipTelemetry(animal, telemetry, options);
  } catch {
    const help = chipConnectionHelp(animal);
    if (liveStatus) liveStatus.textContent = help;
    if (!options.silent) {
      addNotice("!", "Chip sem conexao", help, "Agora");
      renderNotices();
    }
  }
}

function chipConnectionHelp(animal) {
  if (location.protocol === "https:") {
    return `Use Conectar Bluetooth para receber dados no app, ou conecte no Wi-Fi ${animal.chip.ssid} e abra o painel ESP32.`;
  }
  return `Sem resposta do ESP32. Confira o Wi-Fi ${animal.chip.ssid} e abra http://192.168.4.1/`;
}

function isHttpsToLocalChip(animal) {
  return location.protocol === "https:" && animal?.chip?.endpoint?.startsWith("http://");
}

function updateChipPanel(animal) {
  const heartRate = $("#chipHeartRate");
  const spo2 = $("#chipSpo2");
  const movement = $("#chipMovement");
  const sway = $("#chipSway");
  const heat = $("#chipHeat");
  const heatStatus = $("#chipHeatStatus");
  const liveStatus = $("#chipLiveStatus");

  if (heartRate) heartRate.textContent = `${animal.chip.heartRate} bpm`;
  if (spo2) spo2.textContent = `${animal.chip.spo2}%`;
  if (movement) movement.textContent = animal.chip.movementScore;
  if (sway) sway.textContent = animal.chip.swayScore;
  if (heat) heat.textContent = `${animal.chip.heatProbability}%`;
  if (heatStatus) heatStatus.textContent = animal.chip.heatDetected ? "Possivel cio" : "Normal";
  if (liveStatus) liveStatus.textContent = `Atualizado agora para ${animal.id}.`;
}

async function connectChipBluetooth(id) {
  const animal = findAnimal(id);
  if (!animal?.chip?.enabled) return;
  const liveStatus = $("#chipLiveStatus");

  if (!navigator.bluetooth) {
    if (liveStatus) liveStatus.textContent = "Bluetooth do navegador indisponivel. Use Chrome/Edge no Android ou computador.";
    return;
  }

  try {
    stopChipRealtime();
    state.bleBuffer = "";
    state.bleAnimalId = id;
    state.bleDevice = null;
    if (liveStatus) liveStatus.textContent = "Procurando Bluetooth VitalBov...";
    const device = await navigator.bluetooth.requestDevice({
      // Alguns firmwares anunciam o nome somente depois da conexao; listar BLE
      // permite selecionar a placa mesmo nesses casos.
      acceptAllDevices: true,
      optionalServices: [animal.chip.bleServiceUuid]
    });

    state.bleDevice = device;
    state.activeChipAnimalId = id;
    device.addEventListener("gattserverdisconnected", () => {
      state.bleCharacteristic = null;
      state.bleDevice = null;
      state.bleAnimalId = null;
      state.bleBuffer = "";
      const status = $("#chipLiveStatus");
      if (status) status.textContent = "Bluetooth desconectado.";
    });

    if (liveStatus) liveStatus.textContent = "Conectando ao chip...";
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(animal.chip.bleServiceUuid);
    const characteristic = await service.getCharacteristic(animal.chip.bleCharacteristicUuid);
    state.bleCharacteristic = characteristic;

    characteristic.addEventListener("characteristicvaluechanged", handleBleTelemetry);
    await characteristic.startNotifications();

    if (liveStatus) liveStatus.textContent = "Bluetooth selecionado. Aguardando dados dos sensores...";
  } catch (error) {
    const reason = error?.message || "permissao ou dispositivo indisponivel";
    if (liveStatus) liveStatus.textContent = `Bluetooth nao conectado: ${reason}`;
  }
}

function handleBleTelemetry(event) {
  consumeBleText(new TextDecoder().decode(event.target.value));
}

function consumeBleText(text) {
  state.bleBuffer += text;
  let separator = state.bleBuffer.indexOf("\n");

  while (separator >= 0) {
    const frame = state.bleBuffer.slice(0, separator).trim();
    state.bleBuffer = state.bleBuffer.slice(separator + 1);
    separator = state.bleBuffer.indexOf("\n");
    if (!frame) continue;
    if (!frame.startsWith("{") || !frame.endsWith("}")) continue;

    try {
      const packet = JSON.parse(frame);
      const animal = findAnimal(state.bleAnimalId || packet.a || "VB-219");
      if (!animal) return;
      const telemetry = packet.a ? {
        animalId: packet.a,
        heartRate: packet.h,
        spo2: packet.o,
        movementScore: packet.m,
        swayScore: packet.s,
        heatProbability: packet.p,
        heatDetected: Boolean(packet.c),
        signal: packet.q ? "Estavel" : "Parcial",
        mpuReady: Boolean(packet.u),
        maxReady: Boolean(packet.v)
      } : packet;
      applyChipTelemetry(animal, telemetry, { silent: true });
      const liveStatus = $("#chipLiveStatus");
      if (liveStatus) liveStatus.textContent = telemetry.mpuReady && telemetry.maxReady
        ? "Bluetooth conectado. Recebendo dados reais dos sensores."
        : "Bluetooth conectado. Dados reais: verifique MPU6050/MAX30102.";
    } catch {
      const liveStatus = $("#chipLiveStatus");
      if (liveStatus) liveStatus.textContent = "Leitura Bluetooth invalida.";
    }
  }
}

function applyChipTelemetry(animal, telemetry, options = {}) {
  if (telemetry.animalId !== animal.id) {
    if (!options.silent) {
      addNotice("!", "Chip ignorado", `Leitura recebida de ${telemetry.animalId || "animal desconhecido"}, nao de ${animal.id}.`, "Agora");
      renderNotices();
    }
    return;
  }

  const numberOrPrevious = (value, previous) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : previous;
  animal.chip.heartRate = numberOrPrevious(telemetry.heartRate, animal.chip.heartRate);
  animal.chip.spo2 = numberOrPrevious(telemetry.spo2, animal.chip.spo2);
  animal.chip.movementScore = numberOrPrevious(telemetry.movementScore, animal.chip.movementScore);
  animal.chip.swayScore = numberOrPrevious(telemetry.swayScore, animal.chip.swayScore);
  animal.chip.heatProbability = numberOrPrevious(telemetry.heatProbability, animal.chip.heatProbability);
  animal.chip.heatDetected = Boolean(telemetry.heatDetected);
  animal.chip.signal = telemetry.signal || animal.chip.signal;
  animal.lastSeen = "Agora";
  animal.updatedAt = Date.now();

  if (animal.chip.heatDetected) {
    animal.activity = "Alta";
    animal.behavior = "Balanceio elevado detectado";
    animal.reproductive = "Cio provavel por sensor";
    if (animal.status !== "quarantine") {
      animal.status = "heat";
      animal.statusLabel = STATUS_LABELS.heat;
    }
  }

  updateChipPanel(animal);
  if (!options.silent) {
    addNotice("C", "Chip atualizado", `${animal.id} recebeu leitura do ESP32/MPU6050/MAX30102.`, "Agora");
    addEvent("chip.telemetry", `${animal.id} atualizado pelo chip ESP32/MPU6050/MAX30102.`);
  }
  persist();
  renderAll();
}

function drawTinyAnimalChart(animal) {
  const canvas = $("#animalChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.getBoundingClientRect().width;
  canvas.width = width;
  canvas.height = 150;
  const values = animal.history.temp;
  const min = Math.min(...values) - 0.2;
  const max = Math.max(...values) + 0.2;
  ctx.strokeStyle = "#bc3f32";
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = 18 + index * ((width - 36) / (values.length - 1));
    const y = 126 - ((value - min) / (max - min || 1)) * 100;
    index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
}

function openAnimalForm(id) {
  const animal = id ? findAnimal(id) : null;
  const defaultPhoto = animal?.photo || defaultAnimalPhoto(animal?.id || nextAnimalId());
  const animalCoords = animal?.coords || randomInsideFarm("C");
  const animalZone = animal?.zone || zoneForCoords(animalCoords);
  openModal(`
    <div class="sheet-header">
      <h2>${animal ? "Editar animal" : "Cadastro de animal"}</h2>
      <button class="close-btn" data-close-modal aria-label="Fechar">x</button>
    </div>
    <div class="photo-field">
      <img id="animalPhotoPreview" src="${defaultPhoto}" alt="Preview da foto do animal">
      <div>
        <label class="form-field">
          <span>Foto do animal</span>
          <input id="animalPhotoInput" type="file" accept="image/*" capture="environment">
        </label>
        <button class="btn btn-secondary" style="width:100%" data-clear-photo>Remover foto</button>
      </div>
    </div>
    <div class="form-grid two" id="animalForm">
      ${field("Numero do brinco", animal?.id || nextAnimalId(), "text", "animalId")}
      ${field("Nome do animal", animal?.name || "Aurora", "text", "animalName")}
      ${field("Raca", animal?.breed || "Nelore", "text", "animalBreed")}
      ${selectField("Sexo", animal?.sex || "Femea", ["Femea", "Macho"], "animalSex")}
      ${field("Data de nascimento", animal?.born || "2024-01-16", "date", "animalBorn")}
      ${field("Peso", animal?.weight || "320", "number", "animalWeight")}
      ${field("Lote", animal?.lot || "Matrizes 01", "text", "animalLot")}
      ${selectField("Status", animal?.status || "healthy", ["healthy", "heat", "alert", "quarantine"], "animalStatus", STATUS_LABELS)}
      ${selectField("Area da fazenda", animalZone, ["A", "B", "C", "D"], "animalZone", { A: "A - noroeste", B: "B - nordeste", C: "C - sudeste", D: "D - sudoeste" })}
      ${field("Latitude", animalCoords[0], "number", "animalLatitude")}
      ${field("Longitude", animalCoords[1], "number", "animalLongitude")}
    </div>
    <div class="coordinate-hint">As coordenadas serão ajustadas para permanecer dentro do quadrado A-B-C-D da fazenda.</div>
    <button class="btn btn-primary" style="width:100%;margin-top:14px" data-submit-animal="${animal?.id || ""}">Salvar cadastro</button>
  `);
  $("#animalPhotoPreview").dataset.photo = defaultPhoto;
  $("#animalZone").addEventListener("change", (event) => {
    const coords = randomInsideFarm(event.target.value);
    $("#animalLatitude").value = coords[0];
    $("#animalLongitude").value = coords[1];
  });
}

async function saveAnimalFromForm(originalId) {
  const id = $("#animalId").value.trim().toUpperCase();
  const name = $("#animalName").value.trim();
  if (!id || !name) return;

  const status = $("#animalStatus").value;
  const existing = originalId ? findAnimal(originalId) : null;
  const requestedCoords = [Number($("#animalLatitude").value), Number($("#animalLongitude").value)];
  const coords = requestedCoords.every(Number.isFinite)
    ? clampToFarm(requestedCoords)
    : randomInsideFarm($("#animalZone").value);
  const photo = await getAnimalPhoto(existing);
  const animal = {
    id,
    name,
    lot: $("#animalLot").value.trim() || "Sem lote",
    breed: $("#animalBreed").value.trim() || "Nelore",
    sex: $("#animalSex").value,
    born: $("#animalBorn").value || "2024-01-01",
    weight: Number($("#animalWeight").value || 0),
    status,
    statusLabel: STATUS_LABELS[status],
    temp: status === "alert" || status === "quarantine" ? 39.1 : 38.3,
    activity: status === "heat" ? "Alta" : "Normal",
    rumination: status === "alert" || status === "quarantine" ? "360 min" : "462 min",
    behavior: status === "heat" ? "Monta detectada" : "Padrao estavel",
    reproductive: $("#animalSex").value === "Femea" ? "Monitoramento ativo" : "Nao aplicavel",
    photo,
    coords,
    zone: zoneForCoords(coords),
    battery: existing?.battery || 100,
    lastSeen: "Agora",
    history: existing?.history || {
      temp: [38.1, 38.2, 38.3, 38.2, 38.4, 38.3, 38.3],
      rumination: [450, 455, 460, 462, 458, 466, 462],
      activity: [48, 51, 52, 49, 50, 53, 51]
    },
    alerts: existing?.alerts || ["Animal cadastrado e Smart Ear Tag associado automaticamente"]
  };

  if (existing) {
    const index = appData.animals.findIndex((item) => item.id === originalId);
    appData.animals[index] = animal;
    addEvent("animal.update", `${animal.id} atualizado no cadastro.`);
  } else {
    appData.animals.unshift(animal);
    addNotice("A", "Animal cadastrado", `${animal.name} (${animal.id}) foi associado ao Smart Ear Tag.`, "Agora");
    addEvent("animal.create", `${animal.id} cadastrado e associado ao Smart Ear Tag.`);
  }

  closeModal();
  persist();
  renderAll();
  updateMapMarkers();
}

function previewAnimalPhoto(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    addNotice("!", "Arquivo invalido", "Selecione uma imagem para a foto do animal.", "Agora");
    renderNotices();
    input.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const preview = $("#animalPhotoPreview");
    preview.src = reader.result;
    preview.dataset.photo = reader.result;
  };
  reader.readAsDataURL(file);
}

function clearAnimalPhotoPreview() {
  const preview = $("#animalPhotoPreview");
  const input = $("#animalPhotoInput");
  const fallback = defaultAnimalPhoto($("#animalId")?.value || nextAnimalId());
  preview.src = fallback;
  preview.dataset.photo = fallback;
  if (input) input.value = "";
}

async function getAnimalPhoto(existing) {
  const input = $("#animalPhotoInput");
  const preview = $("#animalPhotoPreview");
  const file = input?.files?.[0];
  if (file) return imageFileToOptimizedDataUrl(file);
  return preview?.dataset.photo || existing?.photo || defaultAnimalPhoto($("#animalId")?.value || "");
}

function imageFileToOptimizedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function updateProfilePhoto(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    addNotice("!", "Arquivo invalido", "Selecione uma imagem para a foto de perfil.", "Agora");
    renderNotices();
    input.value = "";
    return;
  }
  try {
    appData.farm.profilePhoto = await imageFileToOptimizedDataUrl(file);
    addNotice("P", "Foto atualizada", "Sua foto de perfil foi salva neste dispositivo.", "Agora");
    addEvent("profile.photo.update", "Foto de perfil atualizada.");
    input.value = "";
    persist();
    renderProfile();
    renderNotices();
  } catch {
    addNotice("!", "Nao foi possivel salvar", "Tente escolher outra imagem.", "Agora");
    renderNotices();
  }
}

function removeProfilePhoto() {
  if (!appData.farm.profilePhoto) return;
  appData.farm.profilePhoto = "";
  addNotice("P", "Foto removida", "O avatar com suas iniciais foi restaurado.", "Agora");
  addEvent("profile.photo.remove", "Foto de perfil removida.");
  persist();
  renderProfile();
  renderNotices();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function openBulkImport() {
  openModal(`
    <div class="sheet-header">
      <h2>Importacao em lote</h2>
      <button class="close-btn" data-close-modal aria-label="Fechar">x</button>
    </div>
    <p>Formato aceito: brinco,nome,raca,sexo,nascimento,peso,lote. Exemplo: VB-512,Aurora,Nelore,Femea,2024-01-16,320,Matrizes 01.</p>
    <label class="form-field"><span>Arquivo CSV</span><input id="csvInput" type="file" accept=".csv"></label>
    <button class="btn btn-primary" style="width:100%;margin-top:14px" data-import-csv>Validar e importar</button>
  `);
}

function importCsvAnimals() {
  const file = $("#csvInput")?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = String(reader.result).split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
    let imported = 0;
    rows.forEach((row) => {
      const [id, name, breed, sex, born, weight, lot] = row.split(",").map((item) => item?.trim());
      if (!id || !name || findAnimal(id)) return;
      appData.animals.push({
        id: id.toUpperCase(),
        name,
        breed: breed || "Nelore",
        sex: sex || "Femea",
        born: born || "2024-01-01",
        weight: Number(weight || 0),
        lot: lot || "Importacao CSV",
        status: "healthy",
        statusLabel: STATUS_LABELS.healthy,
        temp: 38.3,
        activity: "Normal",
        rumination: "460 min",
        behavior: "Padrao estavel",
        reproductive: sex === "Macho" ? "Nao aplicavel" : "Monitoramento ativo",
        photo: defaultAnimalPhoto(id),
        coords: randomNearbyCoords(),
        battery: 100,
        lastSeen: "Agora",
        history: {
          temp: [38.1, 38.2, 38.3, 38.2, 38.4, 38.3, 38.3],
          rumination: [450, 455, 460, 462, 458, 466, 462],
          activity: [48, 51, 52, 49, 50, 53, 51]
        },
        alerts: ["Importado via CSV e aguardando primeira rotina de leitura"]
      });
      imported += 1;
    });
    addNotice("S", "Importacao finalizada", `${imported} animais foram importados e sincronizados.`, "Agora");
    addEvent("animal.csv_import", `${imported} animais importados via CSV.`);
    closeModal();
    persist();
    renderAll();
    updateMapMarkers();
  };
  reader.readAsText(file);
}

function openCheckout() {
  const grouped = groupCart();
  const subtotal = cartSubtotal(grouped);
  const freight = calculateFreight(subtotal);
  const farmAddress = appData.farm.address || "Estrada Rural, s/n";
  openModal(`
    <div class="sheet-header">
      <h2>Finalizar compra</h2>
      <button class="close-btn" data-close-modal aria-label="Fechar">x</button>
    </div>
    <p class="checkout-lead">Confira os itens, informe o endereco da entrega e escolha como pagar.</p>
    <div class="cart-lines">
      ${Object.values(grouped).map((item) => `<div class="cart-line">
        <img src="${item.product.image || "assets/img/product-generic.svg"}" alt="">
        <div><strong>${item.product.name}</strong><small>${formatCurrency(item.product.price)} cada</small></div>
        <div class="quantity-control"><button data-cart-decrease="${item.product.id}" aria-label="Remover uma unidade">-</button><b>${item.qty}</b><button data-cart-increase="${item.product.id}" aria-label="Adicionar uma unidade">+</button></div>
        <strong>${formatCurrency(item.product.price * item.qty)}</strong>
      </div>`).join("") || "<div class=\"empty-state\">Carrinho vazio.</div>"}
    </div>
    <h3 class="checkout-section-title">Endereco de entrega</h3>
    <div class="form-grid two">
      ${field("Responsavel", appData.farm.owner, "text", "deliveryName")}
      ${field("CEP", "29700-000", "text", "deliveryCep")}
      ${field("Endereco / estrada", farmAddress, "text", "deliveryAddress")}
      ${field("Numero / referencia", "Sede da fazenda", "text", "deliveryNumber")}
      ${field("Cidade", `${appData.farm.city} - ${appData.farm.state}`, "text", "deliveryCity")}
    </div>
    <h3 class="checkout-section-title">Pagamento</h3>
    ${selectField("Forma de pagamento", "pix", ["pix", "cartao", "boleto"], "paymentMethod", { pix: "Pix - QR Code", cartao: "Cartao de credito", boleto: "Boleto bancario" })}
    <div id="paymentDetails"></div>
    <div class="detail-metrics">
      <div><span>Subtotal</span><strong>${formatCurrency(subtotal)}</strong></div>
      <div><span>Frete rural</span><strong>${freight ? formatCurrency(freight) : "Gratis"}</strong></div>
      <div><span>Total</span><strong>${formatCurrency(subtotal + freight)}</strong></div>
    </div>
    <button class="btn btn-primary" style="width:100%" data-finalize-order>Confirmar pedido</button>
  `);
  renderPaymentDetails();
}

function finalizeOrder() {
  if (!state.cart.length) return;
  const grouped = groupCart();
  const subtotal = cartSubtotal(grouped);
  const freight = calculateFreight(subtotal);
  const payment = $("#paymentMethod")?.value || "pix";
  const address = {
    name: $("#deliveryName")?.value.trim(),
    cep: $("#deliveryCep")?.value.trim(),
    street: $("#deliveryAddress")?.value.trim(),
    number: $("#deliveryNumber")?.value.trim(),
    city: $("#deliveryCity")?.value.trim()
  };
  if (!address.name || !address.street || !address.city) {
    addNotice("!", "Endereco incompleto", "Preencha responsavel, endereco e cidade para continuar.", "Agora");
    renderNotices();
    return;
  }
  const order = {
    id: cryptoRandomId("order"),
    createdAt: Date.now(),
    status: "confirmado",
    items: Object.values(grouped).map((item) => ({
      id: item.product.id,
      name: item.product.name,
      qty: item.qty,
      unitPrice: item.product.price
    })),
    subtotal,
    freight,
    total: subtotal + freight,
    payment,
    deliveryAddress: address
  };
  appData.orders.unshift(order);
  addNotice("L", "Pedido confirmado", `Entrega para ${address.city}. Pagamento: ${paymentLabel(payment)}.`, "Agora");
  addEvent("store.order.create", `Pedido ${order.id} confirmado no valor de ${formatCurrency(order.total)}.`);
  state.cart = [];
  persist();
  renderAll();
  openModal(orderConfirmationPanel(order));
}

function cartSubtotal(grouped = groupCart()) {
  return Object.values(grouped).reduce((sum, item) => sum + item.product.price * item.qty, 0);
}

function calculateFreight(subtotal) {
  if (!subtotal) return 0;
  return subtotal >= 1000 ? 0 : 39.9;
}

function paymentLabel(payment) {
  return { pix: "Pix", cartao: "cartao de credito", boleto: "boleto" }[payment] || "Pix";
}

function paymentPayload(order) {
  return `VITALBOV|${order.id}|${order.total.toFixed(2)}|${order.deliveryAddress.city}|${order.deliveryAddress.cep}`;
}

function qrUrl(payload) {
  return `https://quickchart.io/qr?text=${encodeURIComponent(payload)}&size=220&margin=2`;
}

function renderPaymentDetails() {
  const container = $("#paymentDetails");
  if (!container) return;
  const method = $("#paymentMethod")?.value || "pix";
  const grouped = groupCart();
  const total = cartSubtotal(grouped) + calculateFreight(cartSubtotal(grouped));
  if (method === "pix") {
    const payload = `VITALBOV|PAGAMENTO|${total.toFixed(2)}`;
    container.innerHTML = `<div class="payment-box"><strong>Pix com QR Code</strong><p>O QR abaixo e gerado com o valor total do pedido. No prototipo, confirme o pagamento no seu banco.</p><img class="qr-image" src="${qrUrl(payload)}" alt="QR Code Pix do pedido"><code id="pixCode">${payload}</code><button class="btn btn-secondary" data-copy-pix>Copiar codigo Pix</button></div>`;
  } else if (method === "cartao") {
    container.innerHTML = `<div class="payment-box"><strong>Cartao de credito</strong><p>O pagamento sera processado pela equipe VitalBov apos a confirmacao do pedido.</p></div>`;
  } else {
    container.innerHTML = `<div class="payment-box"><strong>Boleto bancario</strong><p>O boleto sera disponibilizado no historico de pedidos apos a confirmacao.</p></div>`;
  }
}

function copyPixCode() {
  const code = $("#pixCode")?.textContent;
  if (!code) return;
  const copyTask = navigator.clipboard?.writeText(code);
  if (copyTask) copyTask.then(() => addNotice("L", "Codigo copiado", "O codigo Pix foi copiado para a area de transferencia.", "Agora"));
}

function orderConfirmationPanel(order) {
  const pix = order.payment === "pix";
  return `<div class="sheet-header"><h2>Pedido confirmado</h2><button class="close-btn" data-close-modal aria-label="Fechar">x</button></div>
    <div class="confirmation-banner"><strong>${order.id}</strong><span>Recebemos seu pedido e vamos preparar a entrega.</span></div>
    <div class="detail-metrics"><div><span>Total</span><strong>${formatCurrency(order.total)}</strong></div><div><span>Pagamento</span><strong>${paymentLabel(order.payment)}</strong></div><div><span>Frete</span><strong>${order.freight ? formatCurrency(order.freight) : "Gratis"}</strong></div></div>
    <div class="timeline"><div><strong>Entrega</strong><br>${order.deliveryAddress.street}, ${order.deliveryAddress.number}<br>${order.deliveryAddress.city} - CEP ${order.deliveryAddress.cep}</div></div>
    ${pix ? `<div class="payment-box"><strong>QR Code Pix do pedido</strong><img class="qr-image" src="${qrUrl(paymentPayload(order))}" alt="QR Code Pix do pedido"><code>${paymentPayload(order)}</code></div>` : ""}`;
}

function changeCartQuantity(productId, amount) {
  if (amount > 0) state.cart.push(productId);
  if (amount < 0) {
    const index = state.cart.indexOf(productId);
    if (index >= 0) state.cart.splice(index, 1);
  }
  persist();
  renderStore();
  if (state.cart.length) openCheckout();
  else closeModal();
}

function groupCart() {
  return state.cart.reduce((grouped, id) => {
    const product = appData.products.find((item) => item.id === id);
    if (!product) return grouped;
    grouped[id] ||= { product, qty: 0 };
    grouped[id].qty += 1;
    return grouped;
  }, {});
}

function openInfoPanel(panel) {
  const panels = {
    notifications: notificationPanel(),
    registration: registrationPanel(),
    devices: devicesPanel(),
    reports: reportsPanel(),
    orders: ordersPanel(),
    database: databasePanel(),
    vaccines: vaccinesPanel(),
    vet: vetPanel(),
    education: educationPanel()
  };
  openModal(panels[panel] || panels.notifications);
  if (panel === "registration") initFarmBoundaryEditor();
}

function notificationPanel() {
  return `
    <div class="sheet-header"><h2>Central de Notificacoes</h2><button class="close-btn" data-close-modal>x</button></div>
    <div class="action-strip">
      <button class="btn btn-primary" data-enable-push>Ativar push</button>
      <button class="btn btn-secondary" data-read-all>Marcar lidas</button>
    </div>
    <div class="notice-list">${appData.notices.map(noticeTemplate).join("")}</div>
  `;
}

function registrationPanel() {
  return `
    <div class="sheet-header"><h2>Cadastro do usuario e fazenda</h2><button class="close-btn" data-close-modal>x</button></div>
    <div class="form-grid two">
      ${field("Nome completo", appData.farm.owner, "text", "profileOwnerInput")}
      ${field("CPF/CNPJ", appData.farm.document || "123.456.789-10", "text", "profileDocumentInput")}
      ${field("E-mail", appData.farm.email || "ana@fazendaboavista.com", "email", "profileEmailInput")}
      ${field("Telefone", appData.farm.phone || "(27) 99999-0000", "tel", "profilePhoneInput")}
      ${field("Senha", "********", "password", "profilePasswordInput")}
      ${field("Verificacao por e-mail", appData.farm.verified ? "Confirmado" : "Pendente", "text", "profileVerifiedInput")}
      ${field("Nome da fazenda", appData.farm.name, "text", "profileFarmInput")}
      ${field("Endereco de entrega", appData.farm.address || "Estrada Rural, s/n", "text", "profileAddressInput")}
      ${field("Cidade", appData.farm.city, "text", "profileCityInput")}
      ${field("Estado", appData.farm.state, "text", "profileStateInput")}
      ${field("Tamanho do rebanho", `${appData.animals.length} animais monitorados`, "text", "profileHerdInput")}
    </div>
    <div class="farm-boundary-editor">
      <div class="boundary-heading"><strong>Limite da fazenda no mapa</strong><span>Selecione um ponto A, B, C ou D e clique no mapa. Tambem e possivel arrastar os marcadores.</span></div>
      <div class="farm-editor-toolbar">
        <span id="farmEditorHint">Ponto A selecionado. Clique no mapa para posicionar.</span>
        <button class="btn btn-secondary" data-fit-farm-editor>Centralizar mapa</button>
      </div>
      <div id="farmBoundaryMap" class="farm-boundary-map" role="application" aria-label="Editor do limite da fazenda"></div>
      <div id="farmBoundaryFallback" class="farm-boundary-fallback" hidden></div>
      <div class="farm-point-selector" aria-label="Selecionar ponto do limite">
        ${["A", "B", "C", "D"].map((point) => `<button class="farm-point-button ${point === "A" ? "active" : ""}" data-select-boundary-point="${point}"><strong>${point}</strong><span id="farmPointSummary${point}">${formatCoordinatePair(appData.farm.boundary[point])}</span></button>`).join("")}
      </div>
      <div class="boundary-heading"><strong>Coordenadas precisas</strong><span>Edite os valores abaixo quando precisar de precisao GPS.</span></div>
      ${field("Ponto A - noroeste", formatCoordinatePair(appData.farm.boundary.A), "text", "farmPointA")}
      ${field("Ponto B - nordeste", formatCoordinatePair(appData.farm.boundary.B), "text", "farmPointB")}
      ${field("Ponto C - sudeste", formatCoordinatePair(appData.farm.boundary.C), "text", "farmPointC")}
      ${field("Ponto D - sudoeste", formatCoordinatePair(appData.farm.boundary.D), "text", "farmPointD")}
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:14px" data-save-profile>Salvar dados</button>
  `;
}

function initFarmBoundaryEditor() {
  const mapElement = $("#farmBoundaryMap");
  if (!mapElement) return;
  ["A", "B", "C", "D"].forEach((point) => {
    $("#farmPoint" + point)?.addEventListener("change", () => {
      appData.farm.boundary[point] = parseCoordinatePair($("#farmPoint" + point).value, appData.farm.boundary[point]);
      refreshFarmEditor();
    });
  });

  if (!window.L) {
    renderFarmBoundaryFallback();
    loadLeafletAssets().then((loaded) => {
      if (loaded && $("#farmBoundaryMap")) createFarmBoundaryMap();
    });
    return;
  }
  createFarmBoundaryMap();
}

function createFarmBoundaryMap() {
  const mapElement = $("#farmBoundaryMap");
  if (!mapElement) return;
  mapElement.hidden = false;
  $("#farmBoundaryFallback")?.setAttribute("hidden", "");
  if (state.farmEditorMap) {
    state.farmEditorMap.invalidateSize();
    refreshFarmEditor();
    return;
  }

  const layers = {
    Mapa: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }),
    Satelite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri"
    })
  };
  state.farmEditorMap = L.map(mapElement, { zoomControl: true }).setView(appData.farm.center, 15);
  layers.Mapa.addTo(state.farmEditorMap);
  L.control.layers(layers).addTo(state.farmEditorMap);
  state.farmEditorPolygon = L.polygon(farmBoundaryPoints(), {
    color: "#bc3f32",
    weight: 3,
    fillColor: "#85b024",
    fillOpacity: 0.2,
    dashArray: "8 5"
  }).addTo(state.farmEditorMap);
  state.farmEditorMarkers = L.layerGroup().addTo(state.farmEditorMap);
  state.farmEditorMap.on("click", (event) => setFarmEditorPoint(state.farmEditorActivePoint, [event.latlng.lat, event.latlng.lng]));
  state.farmEditorReady = true;
  refreshFarmEditor();
  fitFarmEditorMap();
  setTimeout(() => state.farmEditorMap?.invalidateSize(), 80);
}

function boundaryMarkerIcon(label) {
  return L.divIcon({
    className: "farm-boundary-marker",
    html: `<span>${label}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

function refreshFarmEditor() {
  const boundary = normalizeBoundary(appData.farm.boundary);
  appData.farm.boundary = boundary;
  ["A", "B", "C", "D"].forEach((point) => {
    const value = formatCoordinatePair(boundary[point]);
    const input = $("#farmPoint" + point);
    const summary = $("#farmPointSummary" + point);
    if (input && document.activeElement !== input) input.value = value;
    if (summary) summary.textContent = value;
  });
  if (state.farmEditorMap && state.farmEditorPolygon && state.farmEditorMarkers) {
    state.farmEditorPolygon.setLatLngs(farmBoundaryPoints());
    state.farmEditorMarkers.clearLayers();
    ["A", "B", "C", "D"].forEach((point) => {
      const marker = L.marker(boundary[point], { draggable: true, icon: boundaryMarkerIcon(point) });
      marker.bindTooltip(`Ponto ${point}`, { direction: "top", offset: [0, -12] });
      marker.on("click", () => selectFarmEditorPoint(point));
      marker.on("dragend", (event) => {
        const latLng = event.target.getLatLng();
        setFarmEditorPoint(point, [latLng.lat, latLng.lng]);
      });
      marker.addTo(state.farmEditorMarkers);
    });
  } else {
    renderFarmBoundaryFallback();
  }
  updateFarmEditorHint();
}

function setFarmEditorPoint(point, coords) {
  if (!point || !["A", "B", "C", "D"].includes(point)) return;
  appData.farm.boundary[point] = [Number(coords[0].toFixed(6)), Number(coords[1].toFixed(6))];
  state.farmEditorActivePoint = point;
  refreshFarmEditor();
}

function selectFarmEditorPoint(point) {
  state.farmEditorActivePoint = point;
  $$("[data-select-boundary-point]").forEach((button) => button.classList.toggle("active", button.dataset.selectBoundaryPoint === point));
  updateFarmEditorHint();
}

function updateFarmEditorHint() {
  const hint = $("#farmEditorHint");
  if (hint) hint.textContent = `Ponto ${state.farmEditorActivePoint} selecionado. Clique no mapa ou arraste o marcador.`;
}

function fitFarmEditorMap() {
  if (!state.farmEditorMap) return;
  state.farmEditorMap.fitBounds(farmBoundaryPoints(), { padding: [28, 28], maxZoom: 17 });
}

function renderFarmBoundaryFallback() {
  const fallback = $("#farmBoundaryFallback");
  const map = $("#farmBoundaryMap");
  if (!fallback || !map) return;
  map.hidden = true;
  fallback.hidden = false;
  const boundary = normalizeBoundary(appData.farm.boundary);
  const corners = Object.entries(boundary).map(([label, coords]) => {
    const position = coordsToMapPosition(coords);
    return `<button class="farm-fallback-point ${label === state.farmEditorActivePoint ? "active" : ""}" style="left:${position.left}%;top:${position.top}%" data-select-boundary-point="${label}"><strong>${label}</strong><small>${formatCoordinatePair(coords)}</small></button>`;
  }).join("");
  fallback.innerHTML = `<div class="map-grid"></div><div class="map-boundary-shape"></div>${corners}<span class="farm-fallback-note">Mapa offline: selecione um ponto para editar as coordenadas.</span>`;
  fallback.onclick = (event) => {
    if (event.target.closest("[data-select-boundary-point]")) return;
    const rect = fallback.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const bounds = farmBounds();
    setFarmEditorPoint(state.farmEditorActivePoint, [bounds.maxLat - y * (bounds.maxLat - bounds.minLat), bounds.minLng + x * (bounds.maxLng - bounds.minLng)]);
  };
}

function devicesPanel() {
  const avgBattery = Math.round(appData.animals.reduce((sum, animal) => sum + animal.battery, 0) / appData.animals.length);
  return `
    <div class="sheet-header"><h2>Dispositivos</h2><button class="close-btn" data-close-modal>x</button></div>
    <div class="detail-metrics">
      <div><span>Smart Tags</span><strong>${appData.animals.length}</strong></div>
      <div><span>Bateria media</span><strong>${avgBattery}%</strong></div>
      <div><span>Gateways</span><strong>${appData.farm.gateways}</strong></div>
      <div><span>Ultima sync</span><strong>${state.offline ? "Pendente" : "2 min"}</strong></div>
    </div>
    <div class="timeline"><div>Gateway Norte com RSSI excelente.</div><div>${appData.animals.filter((animal) => animal.battery < 75).length} tags com bateria abaixo de 75%.</div><div>Edge Computing ativo em todos os lotes cadastrados.</div></div>
  `;
}

function reportsPanel() {
  return `
    <div class="sheet-header"><h2>Relatorios PDF</h2><button class="close-btn" data-close-modal>x</button></div>
    <div class="settings-list">
      <button class="settings-item" data-print-report="health"><svg><use href="#icon-file"></use></svg>Saude do rebanho<span>Gerar PDF</span></button>
      <button class="settings-item" data-print-report="reproductive"><svg><use href="#icon-file"></use></svg>Reprodutivo e cio<span>Gerar PDF</span></button>
      <button class="settings-item" data-print-report="traceability"><svg><use href="#icon-file"></use></svg>Rastreabilidade de exportacao<span>Gerar PDF</span></button>
      <button class="settings-item" data-export-data><svg><use href="#icon-file"></use></svg>Backup dos dados<span>JSON</span></button>
    </div>
  `;
}

function ordersPanel() {
  const orders = appData.orders.slice(0, 10);
  return `
    <div class="sheet-header"><h2>Pedidos e compras</h2><button class="close-btn" data-close-modal>x</button></div>
    <div class="timeline">
      ${orders.length ? orders.map((order) => `
        <div>
          <strong>${order.id}</strong><br>
          ${new Date(order.createdAt).toLocaleString("pt-BR")} | ${order.status}<br>
          ${order.items.map((item) => `${item.qty}x ${item.name}`).join(", ")}<br>
          Total: ${formatCurrency(order.total)} | ${paymentLabel(order.payment || "pix")}<br>
          ${order.deliveryAddress ? `Entrega: ${order.deliveryAddress.street}, ${order.deliveryAddress.number} - ${order.deliveryAddress.city}` : "Entrega: Colatina - ES"}
        </div>
      `).join("") : "<div>Nenhum pedido confirmado ainda.</div>"}
    </div>
  `;
}

function databasePanel() {
  const eventRows = appData.events.slice(0, 8).map((event) => `
    <div><strong>${event.type}</strong><br>${event.description}<br><small>${new Date(event.createdAt).toLocaleString("pt-BR")}</small></div>
  `).join("");
  return `
    <div class="sheet-header"><h2>Banco de dados local</h2><button class="close-btn" data-close-modal>x</button></div>
    <div class="detail-metrics">
      <div><span>Status</span><strong>${db ? "IndexedDB ativo" : "Fallback localStorage"}</strong></div>
      <div><span>Animais</span><strong>${appData.animals.length}</strong></div>
      <div><span>Notificacoes</span><strong>${appData.notices.length}</strong></div>
      <div><span>Eventos</span><strong>${appData.events.length}</strong></div>
    </div>
    <h3>Auditoria recente</h3>
    <div class="timeline">${eventRows || "<div>Nenhum evento registrado ainda.</div>"}</div>
  `;
}

function vaccinesPanel() {
  const selected = $("#vaccineAnimalSelect")?.value || appData.animals[0]?.id;
  return `
    <div class="sheet-header"><h2>Carteira de vacinacao</h2><button class="close-btn" data-close-modal>x</button></div>
    ${selectField("Animal", selected, appData.animals.map((animal) => animal.id), "vaccinePanelAnimal", Object.fromEntries(appData.animals.map((animal) => [animal.id, `${animal.id} - ${animal.name}`])))}
    <div id="vaccinePanelList">${vaccineRecordsMarkup(findAnimal(selected) || appData.animals[0])}</div>
  `;
}

function vetPanel() {
  const firstAnimal = appData.animals[0];
  return `
    <div class="sheet-header"><h2>Apoio Veterinario</h2><button class="close-btn" data-close-modal>x</button></div>
    <p class="checkout-lead">Escolha um profissional, o animal e envie sua duvida. O pedido fica registrado no historico local.</p>
    <div class="vet-team-grid">${VETERINARIANS.map((vet) => `<article class="vet-card"><div class="vet-avatar">${vet.initials}</div><div><strong>${vet.name}</strong><small>${vet.specialty}</small><span class="vet-status">${vet.status} - ${vet.slot}</span></div></article>`).join("")}</div>
    <div class="form-grid two">
      ${selectField("Veterinario", VETERINARIANS[0].id, VETERINARIANS.map((vet) => vet.id), "vetSelect", Object.fromEntries(VETERINARIANS.map((vet) => [vet.id, `${vet.name} - ${vet.specialty}`])))}
      ${selectField("Animal", firstAnimal?.id || "", appData.animals.map((animal) => animal.id), "vetAnimalSelect", Object.fromEntries(appData.animals.map((animal) => [animal.id, `${animal.id} - ${animal.name}`])))}
    </div>
    <label class="form-field"><span>Mensagem</span><textarea id="vetMessageInput" rows="4">Animal ${firstAnimal?.id || "VB-000"} com alteracao detectada. Solicito orientacao.</textarea></label>
    <div class="action-strip"><button class="btn btn-primary" data-send-vet>Enviar chat</button><button class="btn btn-secondary" data-schedule-vet>Agendar visita</button></div>
  `;
}

function renderVaccineView() {
  const select = $("#vaccineAnimalSelect");
  const list = $("#vaccineWallet");
  if (!select || !list) return;
  const current = select.value || appData.animals[0]?.id;
  select.innerHTML = appData.animals.map((animal) => `<option value="${animal.id}" ${animal.id === current ? "selected" : ""}>${animal.id} - ${animal.name}</option>`).join("");
  const animal = findAnimal(select.value) || appData.animals[0];
  const records = animal?.vaccines || [];
  const covered = records.filter((record) => record.status === "Em dia").length;
  $("#vaccineCoverage").textContent = `${covered}/${records.length || VACCINE_CATALOG.length} em dia`;
  list.innerHTML = animal ? `<div class="vaccine-animal-head"><img src="${animal.photo}" alt=""><div><strong>${animal.id} - ${animal.name}</strong><span>${animal.breed} | ${animal.lot}</span></div><span class="status-badge healthy">${covered}/${records.length} protegidas</span></div>${vaccineRecordsMarkup(animal)}` : `<div class="empty-state">Cadastre um animal para abrir a carteira.</div>`;
}

function vaccineRecordsMarkup(animal) {
  if (!animal) return "<div class=\"empty-state\">Nenhum animal selecionado.</div>";
  return `<div class="vaccine-list">${(animal.vaccines || []).map((record) => `<article class="vaccine-record ${record.status !== "Em dia" ? "is-due" : ""}"><div><strong>${record.name}</strong><span>${record.protocol}</span><small>Ultima dose: ${formatDate(record.lastDate)} | Proxima: ${formatDate(record.nextDate)}</small></div><div><span class="status-badge ${record.status === "Em dia" ? "healthy" : "alert"}">${record.status}</span><button class="btn btn-secondary" data-register-vaccine="${record.id}" data-animal-id="${animal.id}">Registrar dose</button></div></article>`).join("")}</div>`;
}

function registerVaccine(vaccineId, animalId) {
  const animal = findAnimal(animalId);
  const record = animal?.vaccines?.find((item) => item.id === vaccineId);
  if (!animal || !record) return;
  const today = new Date();
  record.lastDate = today.toISOString().slice(0, 10);
  const catalog = VACCINE_CATALOG.find((item) => item.id === vaccineId);
  today.setDate(today.getDate() + (catalog?.interval || 365));
  record.nextDate = today.toISOString().slice(0, 10);
  record.status = "Em dia";
  addNotice("V", "Vacina registrada", `${record.name} aplicada em ${animal.id}.`, "Agora");
  addEvent("vaccine.apply", `${record.name} registrada para ${animal.id}.`);
  persist();
  renderAll();
  if ($("#modalRoot").classList.contains("active")) openInfoPanel("vaccines");
}

function educationPanel() {
  const completed = state.educationCompleted.length;
  const progress = Math.round((completed / EDUCATION_LESSONS.length) * 100);
  return `
    <div class="sheet-header"><h2>Pecuaria 4.0</h2><button class="close-btn" data-close-modal aria-label="Fechar">x</button></div>
    <section class="course-hero">
      <div><span class="kicker">Trilha de campo</span><h3>Decisao melhor começa com dado confiavel.</h3><p>Aprenda a conectar sensores, manejo e resultado em uma rotina simples para a fazenda.</p></div>
      <strong>${progress}%</strong>
    </section>
    <div class="course-progress"><span style="width:${progress}%"></span></div>
    <div class="course-meta"><span>${completed} de ${EDUCATION_LESSONS.length} aulas concluidas</span><span>Certificado VitalBov</span></div>
    <div class="lesson-list">
      ${EDUCATION_LESSONS.map((lesson, index) => {
        const done = state.educationCompleted.includes(lesson.id);
        return `<article class="lesson-card ${done ? "is-complete" : ""}">
          <div class="lesson-number">${done ? "OK" : String(index + 1).padStart(2, "0")}</div>
          <div class="lesson-content"><div class="lesson-tags"><span>${lesson.level}</span><small>${lesson.duration}</small></div><h3>${lesson.title}</h3><p>${lesson.summary}</p></div>
          <button class="btn ${done ? "btn-secondary" : "btn-primary"}" data-open-lesson="${lesson.id}">${done ? "Revisar" : "Abrir aula"}</button>
        </article>`;
      }).join("")}
    </div>
  `;
}

function openEducationLesson(id) {
  const lesson = EDUCATION_LESSONS.find((item) => item.id === id);
  if (!lesson) return;
  const done = state.educationCompleted.includes(id);
  openModal(`
    <div class="sheet-header"><h2>${lesson.title}</h2><button class="close-btn" data-close-modal aria-label="Fechar">x</button></div>
    <div class="lesson-detail-head"><span class="status-badge healthy">${lesson.level}</span><span>${lesson.duration}</span></div>
    <p class="lesson-lead">${lesson.summary}</p>
    <h3>Ao concluir, você saberá:</h3>
    <div class="lesson-checklist">${lesson.points.map((point) => `<div><span>+</span>${point}</div>`).join("")}</div>
    <button class="btn ${done ? "btn-secondary" : "btn-primary"}" style="width:100%;margin-top:16px" data-complete-lesson="${lesson.id}">${done ? "Aula concluida" : "Marcar aula como concluida"}</button>
  `);
}

function completeEducationLesson(id) {
  if (!state.educationCompleted.includes(id)) {
    state.educationCompleted.push(id);
    addEvent("education.complete", `Aula ${id} concluida na trilha Pecuaria 4.0.`);
    addNotice("E", "Aula concluida", "Seu progresso em Pecuaria 4.0 foi salvo.", "Agora");
    persist();
  }
  closeModal();
  openInfoPanel("education");
}

function openFilters() {
  const lots = ["Todos", ...new Set(appData.animals.map((animal) => animal.lot))];
  openModal(`
    <div class="sheet-header"><h2>Filtros de rastreamento</h2><button class="close-btn" data-close-modal>x</button></div>
    <div class="form-grid">
      ${selectField("Status", state.filters.status, ["Todos", "healthy", "heat", "alert", "quarantine"], "filterStatus", { Todos: "Todos", ...STATUS_LABELS })}
      ${selectField("Lote", state.filters.lot, lots, "filterLot")}
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:14px" id="applyFilters">Aplicar filtros</button>
  `);
  $("#applyFilters").addEventListener("click", () => {
    state.filters.status = $("#filterStatus").value;
    state.filters.lot = $("#filterLot").value;
    closeModal();
    renderTrackingList();
    updateMapMarkers();
  });
}

function openFarmSwitcher() {
  openModal(`
    <div class="sheet-header"><h2>Multiplas fazendas</h2><button class="close-btn" data-close-modal>x</button></div>
    <div class="settings-list">
      <button class="settings-item" data-close-modal><svg><use href="#icon-farm"></use></svg>${appData.farm.name}<span>${appData.animals.length} animais</span></button>
      <button class="settings-item" data-close-modal><svg><use href="#icon-farm"></use></svg>Sitio Santa Luzia<span>Conta pronta para sincronizar API</span></button>
      <button class="settings-item" data-reset-data><svg><use href="#icon-shield"></use></svg>Restaurar dados demo<span>Reset local</span></button>
    </div>
  `);
}

function setAnimalQuarantine(id) {
  const animal = findAnimal(id);
  if (!animal) return;
  animal.status = "quarantine";
  animal.statusLabel = STATUS_LABELS.quarantine;
  animal.updatedAt = Date.now();
  animal.alerts.unshift("Quarentena Digital ativada manualmente");
  addNotice("!", "Quarentena Digital", `${animal.id} foi isolado para acompanhamento sanitario.`, "Agora");
  addEvent("animal.quarantine", `${animal.id} colocado em Quarentena Digital.`);
  closeModal();
  persist();
  renderAll();
  updateMapMarkers();
}

function registerTreatment(id) {
  const animal = findAnimal(id);
  if (!animal) return;
  animal.alerts.unshift("Tratamento registrado: avaliacao clinica e protocolo veterinario pendentes");
  animal.updatedAt = Date.now();
  addNotice("T", "Tratamento registrado", `${animal.id} recebeu novo registro sanitario.`, "Agora");
  addEvent("animal.treatment", `Tratamento registrado para ${animal.id}.`);
  closeModal();
  persist();
  renderAll();
}

function sendVetMessage() {
  const message = $("#vetMessageInput")?.value.trim();
  const vet = VETERINARIANS.find((item) => item.id === $("#vetSelect")?.value) || VETERINARIANS[0];
  const animal = findAnimal($("#vetAnimalSelect")?.value) || appData.animals[0];
  addNotice("V", `Mensagem para ${vet.name}`, message ? `${animal?.id || "Animal"}: ${message}` : "Mensagem enviada ao apoio veterinario.", "Agora");
  addEvent("vet.chat", `${vet.name} recebeu uma mensagem sobre ${animal?.id || "animal"}.`);
  closeModal();
  persist();
  renderAll();
}

function scheduleVetVisit() {
  const vet = VETERINARIANS.find((item) => item.id === $("#vetSelect")?.value) || VETERINARIANS[0];
  const animal = findAnimal($("#vetAnimalSelect")?.value) || appData.animals[0];
  addNotice("V", "Visita agendada", `${vet.name} atendera ${animal?.id || "o animal"} em ${vet.slot}.`, "Agora");
  addEvent("vet.schedule", `Visita com ${vet.name} agendada para ${animal?.id || "animal"}.`);
  closeModal();
  persist();
  renderAll();
}

function saveProfile() {
  appData.farm.owner = $("#profileOwnerInput").value.trim() || appData.farm.owner;
  appData.farm.document = $("#profileDocumentInput").value.trim();
  appData.farm.email = $("#profileEmailInput").value.trim();
  appData.farm.phone = $("#profilePhoneInput").value.trim();
  appData.farm.verified = true;
  appData.farm.name = $("#profileFarmInput").value.trim() || appData.farm.name;
  appData.farm.address = $("#profileAddressInput")?.value.trim() || appData.farm.address;
  appData.farm.city = $("#profileCityInput").value.trim() || appData.farm.city;
  appData.farm.state = $("#profileStateInput").value.trim() || appData.farm.state;
  appData.farm.boundary = normalizeBoundary({
    A: parseCoordinatePair($("#farmPointA")?.value, appData.farm.boundary.A),
    B: parseCoordinatePair($("#farmPointB")?.value, appData.farm.boundary.B),
    C: parseCoordinatePair($("#farmPointC")?.value, appData.farm.boundary.C),
    D: parseCoordinatePair($("#farmPointD")?.value, appData.farm.boundary.D)
  });
  appData.farm.center = boundaryCenter(appData.farm.boundary);
  fitAnimalsToFarm();
  appData.farm.updatedAt = Date.now();
  addNotice("P", "Perfil atualizado", "Dados do usuario e da fazenda foram salvos neste dispositivo.", "Agora");
  addEvent("farm.update", "Dados do usuario e da fazenda atualizados.");
  closeModal();
  persist();
  renderAll();
}

async function enablePushNotifications() {
  if (!("Notification" in window)) {
    addNotice("!", "Push indisponivel", "Este navegador nao suporta notificacoes push.", "Agora");
    renderNotices();
    return;
  }

  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;

  if (permission === "granted") {
    new Notification("VitalBov ativo", {
      body: "Alertas sanitarios e reprodutivos serao exibidos neste dispositivo."
    });
    addNotice("N", "Push ativado", "Notificacoes inteligentes foram habilitadas.", "Agora");
  } else {
    addNotice("!", "Push nao autorizado", "Ative as notificacoes do navegador para receber alertas.", "Agora");
  }

  closeModal();
  persist();
  renderAll();
}

function markNotificationsRead() {
  appData.notices = appData.notices.map((notice) => ({ ...notice, read: true }));
  closeModal();
  persist();
  renderNotices();
}

function exportDataBackup() {
  const backup = {
    exportedAt: new Date().toISOString(),
    farm: appData.farm,
    animals: appData.animals,
    notices: appData.notices,
    orders: appData.orders,
    events: appData.events,
    cart: state.cart
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "vitalbov-backup.json";
  link.click();
  URL.revokeObjectURL(url);
}

function resetLocalData() {
  if (!confirm("Restaurar os dados demo e apagar alteracoes locais?")) return;
  localStorage.removeItem(STORAGE_KEY);
  if (db) db.close();
  if ("indexedDB" in window) indexedDB.deleteDatabase(DB_NAME);
  window.location.reload();
}

function generateReport(type) {
  const titles = {
    health: "Relatorio de Saude do Rebanho",
    reproductive: "Relatorio Reprodutivo e Cio",
    traceability: "Relatorio de Rastreabilidade para Exportacao"
  };
  const rows = appData.animals.map((animal) => `
    <tr><td>${animal.id}</td><td>${animal.name}</td><td>${animal.statusLabel}</td><td>${animal.temp} C</td><td>${animal.lot}</td></tr>
  `).join("");
  const report = window.open("", "_blank");
  if (!report) return;
  report.document.write(`
    <title>${titles[type]}</title>
    <style>body{font-family:Arial,sans-serif;padding:28px;color:#25311e}h1{color:#3d6216}table{width:100%;border-collapse:collapse}td,th{border:1px solid #dfe5d1;padding:8px;text-align:left}</style>
    <h1>${titles[type]}</h1>
    <p>${appData.farm.name} - ${appData.farm.city}/${appData.farm.state}</p>
    <p>Total monitorado: ${appData.animals.length} animais</p>
    <table><thead><tr><th>Brinco</th><th>Animal</th><th>Status</th><th>Temperatura</th><th>Lote</th></tr></thead><tbody>${rows}</tbody></table>
  `);
  report.document.close();
  report.print();
}

function startTelemetry() {
  if (state.telemetryTimer) clearInterval(state.telemetryTimer);
  state.telemetryTimer = setInterval(() => {
    if (state.offline) return;
    const animal = appData.animals[Math.floor(Math.random() * appData.animals.length)];
    if (!animal || animal.status === "quarantine") return;

    const variation = Number(((Math.random() - 0.45) * 0.28).toFixed(1));
    animal.temp = Number(Math.max(37.8, Math.min(39.8, animal.temp + variation)).toFixed(1));
    animal.lastSeen = "Agora";
    animal.battery = Math.max(1, animal.battery - (Math.random() > 0.82 ? 1 : 0));
    animal.history.temp.push(animal.temp);
    animal.history.temp = animal.history.temp.slice(-7);

    const ruminationValue = Number(String(animal.rumination).replace(/\D/g, "")) || 450;
    const nextRumination = Math.max(260, Math.min(520, ruminationValue + Math.round((Math.random() - 0.5) * 18)));
    animal.rumination = `${nextRumination} min`;
    animal.history.rumination.push(nextRumination);
    animal.history.rumination = animal.history.rumination.slice(-7);

    if (animal.temp >= 39.3 && animal.status === "healthy") {
      animal.status = "alert";
      animal.statusLabel = STATUS_LABELS.alert;
      animal.activity = "Moderada";
      animal.behavior = "Possivel desconforto";
      animal.alerts.unshift("Alerta automatico por temperatura acima do basal");
      addNotice("!", "Alerta automatico", `${animal.id} atingiu ${animal.temp} C.`, "Agora");
      sendBrowserNotification("Alerta VitalBov", `${animal.id} atingiu ${animal.temp} C.`);
    }

    persist();
    renderAll();
    updateMapMarkers();
  }, 18000);
}

function toggleOffline() {
  state.offline = !state.offline;
  if (!state.offline) {
    addNotice("S", "Sincronizacao concluida", `${appData.farm.pendingSync} leituras offline foram enviadas.`, "Agora");
  }
  persist();
  renderDashboard();
  renderNotices();
}

function toggleDarkMode() {
  document.body.classList.toggle("dark");
  drawChart();
}

function addNotice(icon, title, text, time) {
  appData.notices.unshift({ id: cryptoRandomId("notice"), icon, title, text, time, read: false, createdAt: Date.now() });
}

function addEvent(type, description) {
  appData.events.unshift({
    id: cryptoRandomId("event"),
    type,
    description,
    createdAt: Date.now()
  });
}

function noticeTemplate(notice) {
  return `
    <article class="notice">
      <i>${notice.icon}</i>
      <div>
        <strong>${notice.title}</strong>
        <p>${notice.text}</p>
        <small>${notice.time}</small>
      </div>
    </article>
  `;
}

function openModal(content) {
  const root = $("#modalRoot");
  root.innerHTML = `<div class="modal-backdrop" data-close-modal></div><section class="sheet">${content}</section>`;
  root.classList.add("active");
}

function closeModal() {
  stopChipRealtime();
  if (state.farmEditorMap) {
    state.farmEditorMap.remove();
    state.farmEditorMap = null;
    state.farmEditorMarkers = null;
    state.farmEditorPolygon = null;
    state.farmEditorReady = false;
  }
  $("#modalRoot").classList.remove("active");
  $("#modalRoot").innerHTML = "";
}

function field(label, value = "", type = "text", id = "") {
  return `<label class="form-field"><span>${label}</span><input ${id ? `id="${id}"` : ""} type="${type}" value="${escapeHtml(String(value))}"></label>`;
}

function selectField(label, value, options, id, labels = {}) {
  return `
    <label class="form-field">
      <span>${label}</span>
      <select id="${id}">
        ${options.map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${labels[option] || option}</option>`).join("")}
      </select>
    </label>
  `;
}

function countByStatus(status) {
  return appData.animals.filter((animal) => animal.status === status).length;
}

function percent(value, total) {
  return total ? `${Math.round((value / total) * 100)}%` : "0%";
}

function findAnimal(id) {
  return appData.animals.find((animal) => animal.id.toLowerCase() === String(id).toLowerCase());
}

function nextAnimalId() {
  const max = appData.animals.reduce((highest, animal) => {
    const number = Number(animal.id.replace(/\D/g, ""));
    return Number.isFinite(number) ? Math.max(highest, number) : highest;
  }, 0);
  return `VB-${String(max + 1).padStart(3, "0")}`;
}

function defaultFarmBoundary() {
  const [lat, lng] = appData.farm.center || [-19.538, -40.630];
  return {
    A: [lat + 0.012, lng - 0.016],
    B: [lat + 0.012, lng + 0.016],
    C: [lat - 0.012, lng + 0.016],
    D: [lat - 0.012, lng - 0.016]
  };
}

function normalizeBoundary(boundary) {
  const fallback = defaultFarmBoundary();
  return ["A", "B", "C", "D"].reduce((result, label) => {
    const point = boundary?.[label];
    result[label] = Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
      ? [Number(point[0]), Number(point[1])]
      : fallback[label];
    return result;
  }, {});
}

function parseCoordinatePair(value, fallback) {
  const numbers = String(value || "").split(/[,;\s]+/).map(Number).filter(Number.isFinite);
  return numbers.length >= 2 ? [numbers[0], numbers[1]] : fallback;
}

function formatCoordinatePair(coords) {
  return `${Number(coords?.[0] || 0).toFixed(6)}, ${Number(coords?.[1] || 0).toFixed(6)}`;
}

function boundaryCenter(boundary) {
  const points = Object.values(boundary || {});
  if (!points.length) return [-19.538, -40.630];
  return [
    Number((points.reduce((sum, point) => sum + point[0], 0) / points.length).toFixed(6)),
    Number((points.reduce((sum, point) => sum + point[1], 0) / points.length).toFixed(6))
  ];
}

function farmBoundaryPoints() {
  const boundary = normalizeBoundary(appData.farm.boundary);
  return [boundary.A, boundary.B, boundary.C, boundary.D];
}

function farmBounds() {
  const points = farmBoundaryPoints();
  return {
    minLat: Math.min(...points.map((point) => point[0])),
    maxLat: Math.max(...points.map((point) => point[0])),
    minLng: Math.min(...points.map((point) => point[1])),
    maxLng: Math.max(...points.map((point) => point[1]))
  };
}

function clampToFarm(coords) {
  const bounds = farmBounds();
  const fallback = boundaryCenter(appData.farm.boundary);
  const lat = Number(coords?.[0]);
  const lng = Number(coords?.[1]);
  return [
    Number(Math.min(bounds.maxLat, Math.max(bounds.minLat, Number.isFinite(lat) ? lat : fallback[0])).toFixed(6)),
    Number(Math.min(bounds.maxLng, Math.max(bounds.minLng, Number.isFinite(lng) ? lng : fallback[1])).toFixed(6))
  ];
}

function fitAnimalsToFarm() {
  appData.animals = appData.animals.map((animal) => {
    const coords = clampToFarm(animal.coords);
    return { ...animal, coords, zone: zoneForCoords(coords) };
  });
}

function zoneForCoords(coords) {
  const center = boundaryCenter(appData.farm.boundary);
  const lat = Number(coords?.[0]) || center[0];
  const lng = Number(coords?.[1]) || center[1];
  if (lat >= center[0] && lng <= center[1]) return "A";
  if (lat >= center[0] && lng > center[1]) return "B";
  if (lat < center[0] && lng > center[1]) return "C";
  return "D";
}

function randomInsideFarm(zone = "C") {
  const bounds = farmBounds();
  const vertical = zone === "A" || zone === "B" ? 0.72 + Math.random() * 0.22 : 0.08 + Math.random() * 0.22;
  const horizontal = zone === "A" || zone === "D" ? 0.08 + Math.random() * 0.22 : 0.72 + Math.random() * 0.22;
  return [
    Number((bounds.minLat + (bounds.maxLat - bounds.minLat) * vertical).toFixed(6)),
    Number((bounds.minLng + (bounds.maxLng - bounds.minLng) * horizontal).toFixed(6))
  ];
}

function coordsToMapPosition(coords) {
  const bounds = farmBounds();
  const lngRange = bounds.maxLng - bounds.minLng || 1;
  const latRange = bounds.maxLat - bounds.minLat || 1;
  const x = ((Number(coords?.[1]) - bounds.minLng) / lngRange) * 84 + 8;
  const y = 92 - ((Number(coords?.[0]) - bounds.minLat) / latRange) * 84;
  return { left: Math.min(92, Math.max(8, x)), top: Math.min(92, Math.max(8, y)) };
}

function randomNearbyCoords() {
  return randomInsideFarm("C");
}

function defaultAnimalPhoto(seed = "") {
  const digits = String(seed).replace(/\D/g, "");
  const index = digits ? (Number(digits) % 6) + 1 : ((appData.animals.length % 6) + 1);
  return `assets/img/cow-${index}.svg`;
}

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function normalizeVaccines(vaccines, index = 0) {
  const fallbackDate = new Date();
  fallbackDate.setMonth(fallbackDate.getMonth() - (index + 1));
  return VACCINE_CATALOG.map((catalog, catalogIndex) => {
    const saved = vaccines?.find((item) => item.id === catalog.id) || {};
    const last = saved.lastDate || new Date(fallbackDate.getTime() - catalogIndex * 86400000 * 18).toISOString().slice(0, 10);
    const next = saved.nextDate || (() => {
      const date = new Date(`${last}T00:00:00`);
      date.setDate(date.getDate() + catalog.interval);
      return date.toISOString().slice(0, 10);
    })();
    const overdue = new Date(`${next}T23:59:59`) < new Date();
    return { ...catalog, ...saved, lastDate: last, nextDate: next, status: saved.status || (overdue ? "Vencida" : "Em dia") };
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "VB";
}

function sendBrowserNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, { body });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
