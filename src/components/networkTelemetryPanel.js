import { map } from "../views/map.js";
import {
  loadNetworkTelemetryStatus,
  resetNetworkTelemetryCache,
} from "../utils/networkTelemetryStorage.js";

const DEFAULT_CAMPUS = "sotero";
const PANEL_ID = "network-telemetry-panel";
const TOGGLE_ID = "network-telemetry-toggle";

let telemetryLayer = null;
let buildingCatalogPromise = null;
let telemetryPanelElements = null;
let telemetryHeatVisible = true;
let telemetryState = null;
let telemetryFetchInFlight = false;

const registerControlSurface = (element) => {
  if (!element || element.dataset.mapControlBound === "true") {
    return;
  }

  element.dataset.mapControlBound = "true";

  if (window.L?.DomEvent) {
    window.L.DomEvent.disableClickPropagation(element);
    window.L.DomEvent.disableScrollPropagation(element);
  }

  ["pointerdown", "mousedown", "touchstart", "dblclick", "click", "wheel"].forEach((eventName) => {
    element.addEventListener(eventName, (event) => event.stopPropagation(), { passive: false });
  });
};

const getRiskTone = (level, score) => {
  const normalizedLevel = String(level || "").trim().toLowerCase();

  if (normalizedLevel === "critical" || score >= 85) {
    return { className: "critical", color: "#b91c1c", fill: "#ef4444" };
  }

  if (normalizedLevel === "high" || score >= 60) {
    return { className: "high", color: "#ea580c", fill: "#f97316" };
  }

  if (normalizedLevel === "medium" || score >= 35) {
    return { className: "medium", color: "#ca8a04", fill: "#facc15" };
  }

  return { className: "low", color: "#0284c7", fill: "#38bdf8" };
};

const getRiskLabel = (score, level) => `${String(level || "low").toUpperCase()} (${Number(score) || 0})`;

const ensureTelemetryLayer = () => {
  if (!telemetryLayer) {
    telemetryLayer = L.layerGroup().addTo(map);
  }

  return telemetryLayer;
};

const loadBuildingCatalog = async () => {
  if (buildingCatalogPromise) {
    return buildingCatalogPromise;
  }

  buildingCatalogPromise = (async () => {
    try {
      const response = await fetch(`data/sotero_buildings_catalog.json?v=${Date.now()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`catalogo respondio ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data?.buildings) ? data.buildings : [];
    } catch (error) {
      console.error("[network-telemetry] error al cargar catalogo de edificios:", error);
      return [];
    }
  })();

  return buildingCatalogPromise;
};

const buildBuildingIndex = async () => {
  const catalog = await loadBuildingCatalog();
  const index = new Map();

  for (const building of catalog) {
    const centroid = Array.isArray(building?.centroid) && building.centroid.length >= 2
      ? [Number(building.centroid[1]), Number(building.centroid[0])]
      : null;

    if (building?.id && centroid && Number.isFinite(centroid[0]) && Number.isFinite(centroid[1])) {
      index.set(building.id, {
        id: building.id,
        name: building.displayName || building.realName || building.id,
        centroid,
      });
    }
  }

  return index;
};

const renderHeatLayer = async (telemetry) => {
  const layer = ensureTelemetryLayer();
  layer.clearLayers();

  if (!telemetryHeatVisible) {
    return;
  }

  const buildingIndex = await buildBuildingIndex();
  const riskByBuilding = new Map();
  const buildingSummaries = Array.isArray(telemetry?.buildingRiskSummaries) ? telemetry.buildingRiskSummaries : [];

  if (buildingSummaries.length > 0) {
    for (const item of buildingSummaries) {
      const buildingId = String(item?.buildingExternalId || "").trim();
      if (!buildingId) continue;

      riskByBuilding.set(buildingId, {
        score: Number(item?.maxRiskScore) || 0,
        level: item?.maxRiskLevel || "low",
      });
    }
  } else {
    for (const observation of Array.isArray(telemetry?.topRiskObservations) ? telemetry.topRiskObservations : []) {
      const buildingId = String(observation?.buildingExternalId || "").trim();
      if (!buildingId) continue;

      const score = Number(observation?.riskScore) || 0;
      const existing = riskByBuilding.get(buildingId);
      if (!existing || score > existing.score) {
        riskByBuilding.set(buildingId, {
          score,
          level: observation?.riskLevel || "low",
        });
      }
    }
  }

  for (const [buildingId, risk] of riskByBuilding.entries()) {
    const building = buildingIndex.get(buildingId);
    if (!building) continue;

    const tone = getRiskTone(risk.level, risk.score);
    const radius = 16 + Math.min(22, Math.round((Number(risk.score) || 0) / 4));

    L.circleMarker(building.centroid, {
      radius,
      color: tone.color,
      weight: 2,
      opacity: 0.9,
      fillColor: tone.fill,
      fillOpacity: 0.28,
      interactive: false,
    }).addTo(layer);
  }
};

const renderSummary = (panel, telemetry) => {
  if (!panel) return;

  const sourceLabel =
    telemetry?.source === "api" ? "API" :
    telemetry?.source === "backup" ? "Respaldo local" :
    telemetry?.source === "static-backup" ? "Respaldo estatico" :
    telemetry?.source === "empty" ? "Sin datos" :
    "Desconocido";

  const observedAt = telemetry?.latestObservedAtUtc
    ? new Date(telemetry.latestObservedAtUtc).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })
    : "Sin datos";

  panel.summary.innerHTML = `
    <div class="network-telemetry-summary-grid">
      <div><span>Fuente</span><strong>${sourceLabel}</strong></div>
      <div><span>Estado</span><strong>${telemetry?.healthLabel || "Sin datos"}</strong></div>
      <div><span>Captura</span><strong>${observedAt}</strong></div>
      <div><span>Riesgo</span><strong>${getRiskLabel(telemetry?.latestRiskScore, telemetry?.latestRiskLevel)}</strong></div>
      <div><span>Equipos</span><strong>${Number(telemetry?.latestDeviceCount) || 0}</strong></div>
      <div><span>Usuarios</span><strong>${Number(telemetry?.latestConnectedUserCount) || 0}</strong></div>
    </div>
    ${telemetry?.notes ? `<div class="network-telemetry-summary-notes">${telemetry.notes}</div>` : ""}
  `;

  const topObservations = Array.isArray(telemetry?.topRiskObservations) ? telemetry.topRiskObservations : [];
  if (topObservations.length === 0) {
    panel.list.innerHTML = `<div class="network-telemetry-empty">No hay observaciones destacadas para mostrar.</div>`;
    return;
  }

  panel.list.innerHTML = topObservations
    .slice(0, 8)
    .map((observation) => {
      const reasons = Array.isArray(observation?.riskReasons) ? observation.riskReasons.join(", ") : "";
      return `
        <div class="network-telemetry-item">
          <div class="network-telemetry-item-header">
            <strong>${observation?.deviceName || observation?.externalKey || "Elemento"}</strong>
            <span class="network-telemetry-risk ${String(observation?.riskLevel || "low").toLowerCase()}">${getRiskLabel(observation?.riskScore, observation?.riskLevel)}</span>
          </div>
          <div class="network-telemetry-item-meta">${observation?.observationType || "device"} · ${observation?.username || "sin usuario"} · ${observation?.ipAddress || "sin IP"}</div>
          ${reasons ? `<div class="network-telemetry-item-reasons">${reasons}</div>` : ""}
        </div>
      `;
    })
    .join("");
};

const updateToggleButton = (panel, isOpen) => {
  if (!panel?.toggle) return;
  panel.toggle.setAttribute("aria-expanded", String(isOpen));
  panel.toggle.classList.toggle("is-active", isOpen);
};

const applyHeatVisibility = async (panel, telemetry) => {
  if (telemetryHeatVisible) {
    panel.heatButton.textContent = "Ocultar calor";
    await renderHeatLayer(telemetry);
  } else {
    panel.heatButton.textContent = "Mostrar calor";
    ensureTelemetryLayer().clearLayers();
  }
};

const refreshPanel = async ({ forceRefresh = false } = {}) => {
  const panel = getPanel();
  if (!panel || telemetryFetchInFlight) return;

  telemetryFetchInFlight = true;
  panel.refreshButton.disabled = true;
  panel.refreshButton.textContent = "Cargando...";
  panel.summary.innerHTML = `<div class="network-telemetry-empty">Consultando estado de la telemetria...</div>`;
  panel.list.innerHTML = "";

  try {
    const telemetry = await loadNetworkTelemetryStatus(DEFAULT_CAMPUS, { forceRefresh });
    telemetryState = telemetry;
    renderSummary(panel, telemetry);
    await applyHeatVisibility(panel, telemetry);
  } catch (error) {
    console.error("[network-telemetry] error al actualizar panel:", error);
    panel.summary.innerHTML = `<div class="network-telemetry-empty">No se pudo cargar la telemetria.</div>`;
    panel.list.innerHTML = `<div class="network-telemetry-empty">Revisa la consola para mas detalle.</div>`;
    ensureTelemetryLayer().clearLayers();
  } finally {
    telemetryFetchInFlight = false;
    panel.refreshButton.disabled = false;
    panel.refreshButton.textContent = "Actualizar";
  }
};

const getPanel = () => {
  const root = document.getElementById(PANEL_ID);
  const toggle = document.getElementById(TOGGLE_ID);

  if (!root || !toggle) {
    return null;
  }

  if (
    telemetryPanelElements &&
    telemetryPanelElements.root?.isConnected &&
    telemetryPanelElements.toggle?.isConnected &&
    telemetryPanelElements.summary?.isConnected &&
    telemetryPanelElements.list?.isConnected
  ) {
    return telemetryPanelElements;
  }

  if (!root.querySelector(".network-telemetry-panel-summary")) {
    root.innerHTML = `
      <div class="network-telemetry-panel-header">
        <div>
          <div class="network-telemetry-panel-title">Red y riesgo</div>
          <div class="network-telemetry-panel-subtitle">Snapshot local o en vivo de equipos y usuarios</div>
        </div>
        <button type="button" class="network-telemetry-panel-refresh" data-network-telemetry-refresh>Actualizar</button>
      </div>
      <div class="network-telemetry-panel-summary"></div>
      <div class="network-telemetry-panel-legend">
        <span><i class="risk-dot risk-dot-critical"></i> Crítico</span>
        <span><i class="risk-dot risk-dot-high"></i> Alto</span>
        <span><i class="risk-dot risk-dot-medium"></i> Medio</span>
        <span><i class="risk-dot risk-dot-low"></i> Bajo</span>
      </div>
      <div class="network-telemetry-panel-actions">
        <button type="button" class="network-telemetry-panel-toggle-heat" data-network-telemetry-heat>Ocultar calor</button>
      </div>
      <div class="network-telemetry-panel-list"></div>
    `;
  }

  telemetryPanelElements = {
    root,
    toggle,
    summary: root.querySelector(".network-telemetry-panel-summary"),
    list: root.querySelector(".network-telemetry-panel-list"),
    refreshButton: root.querySelector("[data-network-telemetry-refresh]"),
    heatButton: root.querySelector("[data-network-telemetry-heat]"),
  };

  registerControlSurface(root);

  return telemetryPanelElements;
};

const togglePanel = async () => {
  const panel = getPanel();
  if (!panel) return;

  const isOpen = panel.root.hidden;
  panel.root.hidden = !isOpen;
  updateToggleButton(panel, isOpen);

  if (isOpen) {
    await refreshPanel();
  } else {
    resetNetworkTelemetryCache();
  }
};

const initTelemetryPanel = () => {
  const topActions = document.getElementById("top-actions");
  if (!topActions) {
    return;
  }

  let toggle = document.getElementById(TOGGLE_ID);
  if (!toggle) {
    toggle = document.createElement("button");
    toggle.id = TOGGLE_ID;
    toggle.type = "button";
    toggle.className = "dashboard-link network-telemetry-toggle is-muted";
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = `<span class="map-tool-button-icon" aria-hidden="true">⌁</span><span>Red y riesgo</span>`;
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void togglePanel();
    });

    const routeToggle = document.getElementById("walking-route-toggle") || document.getElementById("route-planner-toggle");
    if (routeToggle) {
      routeToggle.insertAdjacentElement("afterend", toggle);
    } else {
      topActions.appendChild(toggle);
    }
  }

  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "network-telemetry-panel";
    panel.hidden = true;
    toggle.insertAdjacentElement("afterend", panel);
  }

  const panelElements = getPanel();
  panelElements?.refreshButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void refreshPanel({ forceRefresh: true });
  });

  panelElements?.heatButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    telemetryHeatVisible = !telemetryHeatVisible;
    void applyHeatVisibility(panelElements, telemetryState);
  });

  window.addEventListener("sotero-session-changed", () => {
    resetNetworkTelemetryCache();
    if (!panel.hidden) {
      void refreshPanel({ forceRefresh: true });
    }
  });

  window.addEventListener("sotero-map-data-refreshed", () => {
    if (!panel.hidden && telemetryState) {
      void renderHeatLayer(telemetryState);
    }
  });

  window.refreshNetworkTelemetryPanel = () => refreshPanel({ forceRefresh: true });
  window.toggleNetworkTelemetryPanel = togglePanel;
};

export const initNetworkTelemetryPanel = () => {
  initTelemetryPanel();
};
