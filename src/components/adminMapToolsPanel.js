const panelId = "admin-map-tools-panel";
const buttonsId = "admin-map-tools-buttons";
const statusId = "admin-map-tools-status";

export const ensureAdminMapToolsPanel = () => {
  const actions = document.getElementById("top-actions");
  if (!actions) return null;

  let panel = document.getElementById(panelId);
  if (panel) return panel;

  panel = document.createElement("div");
  panel.id = panelId;
  panel.className = "admin-map-tools-panel";
  panel.innerHTML = `
    <div class="admin-map-tools-title">Herramientas admin</div>
    <div id="${buttonsId}" class="admin-map-tools-buttons"></div>
    <div id="${statusId}" class="admin-map-tools-status"></div>
  `;

  actions.appendChild(panel);
  return panel;
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

export const requestAdminMapToolMode = (mode) => {
  window.dispatchEvent(new CustomEvent("sotero-admin-map-tool-mode", { detail: { mode } }));
};
