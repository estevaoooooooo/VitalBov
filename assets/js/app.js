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
  mapReady: false,
  telemetryTimer: null,
  ...loadSavedState()
};

let db = null;
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const baseData = window.VITALBOV_DATA;
const appData = {
  farm: state.farm || structuredClone(baseData.farm),
  animals: state.animals || structuredClone(baseData.animals),
  notices: state.notices || structuredClone(baseData.notices),
  orders: state.orders || [],
  events: state.events || [],
  products: structuredClone(baseData.products),
  chartData: structuredClone(baseData.chartData)
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

    const orderButton = event.target.closest("[data-finalize-order]");
    if (orderButton) finalizeOrder();

    const saveProfileButton = event.target.closest("[data-save-profile]");
    if (saveProfileButton) saveProfile();

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
  });

  normalizeState();

  if (!farms.length || !animals.length) {
    await persist();
  }
}

function normalizeState() {
  appData.farm.id ||= "default";
  appData.farm.updatedAt ||= Date.now();
  appData.animals = appData.animals.map((animal) => ({
    ...animal,
    photo: animal.photo || defaultAnimalPhoto(animal.id),
    updatedAt: animal.updatedAt || Date.now()
  }));
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
    onboardingSeen: state.onboardingSeen
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
        { key: "onboardingSeen", value: state.onboardingSeen }
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
  $("#syncStatus").textContent = state.offline
    ? `Offline - ${appData.farm.pendingSync} leituras aguardando sincronizacao`
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
  return `
    <button class="animal-card" data-open-animal="${animal.id}">
      <img class="animal-thumb" src="${animal.photo}" alt="Foto de ${animal.name}">
      <div>
        <strong>${animal.name} - ${animal.id}</strong>
        <p>${animal.breed} | ${animal.lot} | bateria ${animal.battery}%</p>
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
        <p>${animal.lot} | ${animal.temp} C | ${animal.activity} | visto ${animal.lastSeen}</p>
      </div>
      <span class="status-badge ${animal.status}">${animal.statusLabel}</span>
    </button>
  `;
}

function initLeafletMap() {
  if (!window.L) {
    renderFallbackMap();
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
  }
  state.mapReady = true;
  updateMapMarkers();
}

function updateMapMarkers() {
  if (!state.mapReady || !state.markersLayer) {
    renderFallbackMap();
    return;
  }
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
    state.map.fitBounds(animals.map((animal) => animal.coords), { padding: [24, 24], maxZoom: 16 });
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
  fallback.innerHTML = `<div class="map-grid"></div>${animals.map((animal, index) => {
    const left = 18 + ((index * 19) % 68);
    const top = 28 + ((index * 17) % 48);
    return `<button class="map-pin ${animal.status}" style="left:${left}%;top:${top}%" data-open-animal="${animal.id}">${animal.id}</button>`;
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
      <div class="product-media"><svg><use href="#icon-tag"></use></svg></div>
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
  $("#profileAvatar").textContent = initials(appData.farm.owner);
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
  ctx.lineTo(points.at(-1).x, height - padding);
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
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:14px" data-submit-animal="${animal?.id || ""}">Salvar cadastro</button>
  `);
  $("#animalPhotoPreview").dataset.photo = defaultPhoto;
}

async function saveAnimalFromForm(originalId) {
  const id = $("#animalId").value.trim().toUpperCase();
  const name = $("#animalName").value.trim();
  if (!id || !name) return;

  const status = $("#animalStatus").value;
  const existing = originalId ? findAnimal(originalId) : null;
  const coords = existing?.coords || randomNearbyCoords();
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
  const total = Object.values(grouped).reduce((sum, item) => sum + item.product.price * item.qty, 0);
  openModal(`
    <div class="sheet-header">
      <h2>Checkout</h2>
      <button class="close-btn" data-close-modal aria-label="Fechar">x</button>
    </div>
    <p>${state.cart.length || 0} itens no carrinho para entrega em Colatina - ES.</p>
    <div class="timeline">
      ${Object.values(grouped).map((item) => `<div>${item.qty}x ${item.product.name} - ${formatCurrency(item.product.price * item.qty)}</div>`).join("") || "<div>Carrinho vazio.</div>"}
    </div>
    <div class="detail-metrics">
      <div><span>Subtotal</span><strong>${formatCurrency(total)}</strong></div>
      <div><span>Frete rural</span><strong>${formatCurrency(state.cart.length ? 39.9 : 0)}</strong></div>
    </div>
    <button class="btn btn-primary" style="width:100%" data-finalize-order>Finalizar pedido</button>
  `);
}

function finalizeOrder() {
  if (!state.cart.length) return;
  const grouped = groupCart();
  const total = Object.values(grouped).reduce((sum, item) => sum + item.product.price * item.qty, 0);
  appData.orders.unshift({
    id: cryptoRandomId("order"),
    createdAt: Date.now(),
    status: "confirmado",
    items: Object.values(grouped).map((item) => ({
      id: item.product.id,
      name: item.product.name,
      qty: item.qty,
      unitPrice: item.product.price
    })),
    subtotal: total,
    freight: 39.9,
    total: total + 39.9
  });
  addNotice("L", "Pedido confirmado", "Compra enviada para faturamento e logistica rural.", "Agora");
  addEvent("store.order.create", `Pedido confirmado no valor de ${formatCurrency(total + 39.9)}.`);
  state.cart = [];
  closeModal();
  persist();
  renderAll();
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
      ${field("Cidade", appData.farm.city, "text", "profileCityInput")}
      ${field("Estado", appData.farm.state, "text", "profileStateInput")}
      ${field("Tamanho do rebanho", `${appData.animals.length} animais monitorados`, "text", "profileHerdInput")}
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:14px" data-save-profile>Salvar dados</button>
  `;
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
          Total: ${formatCurrency(order.total)}
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
  const total = appData.animals.length;
  return `
    <div class="sheet-header"><h2>Carteira de vacinacao</h2><button class="close-btn" data-close-modal>x</button></div>
    <div class="timeline"><div>Brucelose: ${Math.max(1, Math.round(total * 0.24))} femeas jovens atualizadas.</div><div>Clostridioses: reforco previsto para 18/06/2026.</div><div>Raiva: ${Math.round(total * 0.96)} de ${total} animais cobertos.</div></div>
  `;
}

function vetPanel() {
  return `
    <div class="sheet-header"><h2>Apoio Veterinario</h2><button class="close-btn" data-close-modal>x</button></div>
    <div class="timeline"><div><strong>Dra. Marina Costa</strong><br>Online agora para triagem sanitaria.</div><div>Proximo horario disponivel: hoje, 15:30.</div></div>
    <label class="form-field"><span>Mensagem</span><textarea id="vetMessageInput" rows="4">Animal ${appData.animals[0]?.id || "VB-000"} com alteracao detectada. Solicito orientacao.</textarea></label>
    <div class="action-strip"><button class="btn btn-primary" data-send-vet>Enviar chat</button><button class="btn btn-secondary" data-schedule-vet>Agendar visita</button></div>
  `;
}

function educationPanel() {
  return `
    <div class="sheet-header"><h2>Pecuaria 4.0</h2><button class="close-btn" data-close-modal>x</button></div>
    <div class="timeline"><div>Como interpretar ruminacao e atividade em tempo real.</div><div>Boas praticas para quarentena sanitaria digital.</div><div>Rastreabilidade para mercados premium e exportacao.</div><div>Uso de LoRaWAN em propriedades rurais.</div></div>
  `;
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
  addNotice("V", "Mensagem enviada", message ? `Veterinario recebeu: ${message}` : "Mensagem enviada ao apoio veterinario.", "Agora");
  addEvent("vet.chat", message || "Mensagem enviada ao apoio veterinario.");
  closeModal();
  persist();
  renderAll();
}

function scheduleVetVisit() {
  addNotice("V", "Visita agendada", "Apoio veterinario agendado para hoje as 15:30.", "Agora");
  addEvent("vet.schedule", "Visita veterinaria agendada para hoje as 15:30.");
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
  appData.farm.city = $("#profileCityInput").value.trim() || appData.farm.city;
  appData.farm.state = $("#profileStateInput").value.trim() || appData.farm.state;
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

function randomNearbyCoords() {
  const [lat, lng] = appData.farm.center;
  return [
    Number((lat + (Math.random() - 0.5) * 0.018).toFixed(6)),
    Number((lng + (Math.random() - 0.5) * 0.022).toFixed(6))
  ];
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
