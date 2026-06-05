const panelId = "admin-map-tools-panel";
const buttonsId = "admin-map-tools-buttons";
const statusId = "admin-map-tools-status";
const activeModes = new Map([
  ["manual-building", "manual-building-editor-toggle"],
  ["geometry-shape", "building-shape-editor-button"],
  ["geometry-move", "building-move-editor-button"],
]);

export const ensureAdminMapToolsPanel = () => {
  let panel = document.getElementById(panelId);
  if (panel) {
    positionAdminMapToolsPanel();
    return panel;
  }

  panel = document.createElement("div");
  panel.id = panelId;
  panel.className = "admin-map-tools-panel";
  panel.innerHTML = `
    <div class="admin-map-tools-title">Herramientas admin</div>
    <div id="${buttonsId}" class="admin-map-tools-buttons"></div>
    <div id="${statusId}" class="admin-map-tools-status"></div>
  `;

  document.body.appendChild(panel);
  positionAdminMapToolsPanel();
  window.addEventListener("resize", positionAdminMapToolsPanel);
  window.addEventListener("sotero-session-changed", () => {
    window.requestAnimationFrame(positionAdminMapToolsPanel);
  });
  return panel;
};

const positionAdminMapToolsPanel = () => {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const inventoryLink = document.getElementById("session-inventory-link");
  const sessionBadge = document.getElementById("session-mode-badge");
  const anchor = inventoryLink || sessionBadge || document.getElementById("map-status-panel");

  if (!anchor) return;

  const rect = anchor.getBoundingClientRect();
  panel.style.top = `${Math.round(rect.bottom + 6)}px`;
};

export const removeAdminMapToolsPanelIfEmpty = () => {
  const buttons = document.getElementById(buttonsId);
  if (buttons && buttons.children.length === 0) {
    document.getElementById(panelId)?.remove();
  }
};

export const getAdminMapToolsButtons = () => {
  ensureAdminMapToolsPanel();
  return document.getElementById(buttonsId);
};

export const setAdminMapToolsStatus = (message) => {
  const status = document.getElementById(statusId);
  if (status) status.textContent = message || "";
};

export const setAdminMapToolActiveMode = (mode) => {
  document
    .querySelectorAll(".admin-map-tools-panel .dashboard-link")
    .forEach((button) => button.classList.remove("is-active", "is-working"));

  const buttonId = activeModes.get(mode);
  if (!buttonId) return;

  const button = document.getElementById(buttonId);
  button?.classList.add("is-active", "is-working");
};

export const requestAdminMapToolMode = (mode) => {
  setAdminMapToolActiveMode(mode);
  window.dispatchEvent(new CustomEvent("sotero-admin-map-tool-mode", { detail: { mode } }));
};
