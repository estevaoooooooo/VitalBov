const STORAGE_KEY = "vitalbov.state.v2";
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
  onboardingIndex: 0,
  activeView: "home",
  activeChart: "rumination",
  offline: false,
  cart: [],
  storeCategory: "Todos",
  trackingQuery: "",
  filters: {
    status: "Todos",
    lot: "Todos"
  },
  selectedFarm: 0,
  map: null,
  markersLayer: null,
  mapReady: false,
  ...loadSavedState()
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const baseData = window.VITALBOV_DATA;
const appData = {
  farm: baseData.farm,
  animals: state.animals || structuredClone(baseData.animals),
  notices: state.notices || structuredClone(baseData.notices),
  products: structuredClone(baseData.products),
  chartData: structuredClone(baseData.chartData)
};

document.addEventListener("DOMContentLoaded", () => {
  createOnboardingDots();
  bindEvents();
  renderAll();
  registerServiceWorker();
});

function bindEvents() {
  $("#nextOnboarding").addEventListener("click", nextOnboarding);
  $("#skipOnboarding").addEventListener("click", startApp);

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

function persist() {
  const payload = {
    animals: appData.animals,
    notices: appData.notices,
    cart: state.cart,
    offline: state.offline,
    selectedFarm: state.selectedFarm
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function createOnboardingDots() {
  const dots = $("#onboardingDots");
  dots.innerHTML = "";
  for (let index = 0; index < 4; index += 1) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `Tela ${index + 1}`);
    dot.addEventListener("click", () => {
      state.onboardingIndex = index;
      updateOnboarding();
    });
    dots.appendChild(dot);
  }
  updateOnboarding();
}

function nextOnboarding() {
  if (state.onboardingIndex === 3) {
    startApp();
    return;
  }
  state.onboardingIndex += 1;
  updateOnboarding();
}

function updateOnboarding() {
  $("#onboardingTrack").style.transform = `translateX(-${state.onboardingIndex * 100}%)`;
  $$("#onboardingDots button").forEach((dot, index) => dot.classList.toggle("active", index === state.onboardingIndex));
  $("#nextOnboarding").textContent = state.onboardingIndex === 3 ? "Entrar" : "Continuar";
}

function startApp() {
  $("#onboarding").classList.remove("is-active");
  $("#mainApp").hidden = false;
  $("#bottomNav").hidden = false;
  openView("home");
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
    <article class="product-card">
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
  const devices = $("#view-profile [data-open-panel='devices'] span");
  if (devices) devices.textContent = `${appData.animals.length} ativos`;
}

function addToCart(productId) {
  const product = appData.products.find((item) => item.id === productId);
  if (!product) return;
  state.cart.push(productId);
  addNotice("L", "Produto adicionado", `${product.name} foi adicionado ao carrinho.`, "Agora");
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
  openModal(`
    <div class="sheet-header">
      <h2>${animal ? "Editar animal" : "Cadastro de animal"}</h2>
      <button class="close-btn" data-close-modal aria-label="Fechar">x</button>
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
}

function saveAnimalFromForm(originalId) {
  const id = $("#animalId").value.trim().toUpperCase();
  const name = $("#animalName").value.trim();
  if (!id || !name) return;

  const status = $("#animalStatus").value;
  const existing = originalId ? findAnimal(originalId) : null;
  const coords = existing?.coords || randomNearbyCoords();
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
    photo: existing?.photo || "assets/img/cow-5.svg",
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
  } else {
    appData.animals.unshift(animal);
    addNotice("A", "Animal cadastrado", `${animal.name} (${animal.id}) foi associado ao Smart Ear Tag.`, "Agora");
  }

  closeModal();
  persist();
  renderAll();
  updateMapMarkers();
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
        photo: "assets/img/cow-6.svg",
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
  addNotice("L", "Pedido confirmado", "Compra enviada para faturamento e logistica rural.", "Agora");
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
    vaccines: vaccinesPanel(),
    vet: vetPanel(),
    education: educationPanel()
  };
  openModal(panels[panel] || panels.notifications);
}

function notificationPanel() {
  return `
    <div class="sheet-header"><h2>Central de Notificacoes</h2><button class="close-btn" data-close-modal>x</button></div>
    <div class="notice-list">${appData.notices.map(noticeTemplate).join("")}</div>
  `;
}

function registrationPanel() {
  return `
    <div class="sheet-header"><h2>Cadastro do usuario e fazenda</h2><button class="close-btn" data-close-modal>x</button></div>
    <div class="form-grid two">
      ${field("Nome completo", appData.farm.owner)}
      ${field("CPF/CNPJ", "123.456.789-10")}
      ${field("E-mail", "ana@fazendaboavista.com")}
      ${field("Telefone", "(27) 99999-0000")}
      ${field("Senha", "********", "password")}
      ${field("Verificacao por e-mail", "Confirmado")}
      ${field("Nome da fazenda", appData.farm.name)}
      ${field("Localizacao", `${appData.farm.city} - ${appData.farm.state}`)}
      ${field("Tamanho do rebanho", `${appData.animals.length} animais monitorados`)}
      ${field("Conta secundaria", "Sitio Santa Luzia")}
    </div>
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
    </div>
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
    <label class="form-field"><span>Mensagem</span><textarea rows="4">Animal ${appData.animals[0]?.id || "VB-000"} com alteracao detectada. Solicito orientacao.</textarea></label>
    <div class="action-strip"><button class="btn btn-primary" data-close-modal>Enviar chat</button><button class="btn btn-secondary" data-close-modal>Agendar visita</button></div>
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
      <button class="settings-item" data-close-modal><svg><use href="#icon-farm"></use></svg>Sitio Santa Luzia<span>128 animais</span></button>
    </div>
  `);
}

function setAnimalQuarantine(id) {
  const animal = findAnimal(id);
  if (!animal) return;
  animal.status = "quarantine";
  animal.statusLabel = STATUS_LABELS.quarantine;
  animal.alerts.unshift("Quarentena Digital ativada manualmente");
  addNotice("!", "Quarentena Digital", `${animal.id} foi isolado para acompanhamento sanitario.`, "Agora");
  closeModal();
  persist();
  renderAll();
  updateMapMarkers();
}

function registerTreatment(id) {
  const animal = findAnimal(id);
  if (!animal) return;
  animal.alerts.unshift("Tratamento registrado: avaliacao clinica e protocolo veterinario pendentes");
  addNotice("T", "Tratamento registrado", `${animal.id} recebeu novo registro sanitario.`, "Agora");
  closeModal();
  persist();
  renderAll();
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
  appData.notices.unshift({ icon, title, text, time });
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

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
