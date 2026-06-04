import { BACKEND_API_URL } from "../views/map.js";

const rootId = "session-mode-badge";
const sessionPollMs = 10000;
let lastSessionKey = "";
let pollHandle = null;

const loadSession = async () => {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/auth/session`, {
      credentials: "include",
      cache: "no-store",
    });

    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
};

const logout = async () => {
  try {
    await fetch(`${BACKEND_API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
  } finally {
    window.location.reload();
  }
};

const buildLabel = (session) => {
  if (!session?.isAuthenticated) {
    return "Modo vista";
  }

  return session.isAdmin ? "Modo Administrador" : "Modo vista";
};

const getSessionKey = (session) =>
  [
    session?.isAuthenticated ? "1" : "0",
    session?.isAdmin ? "admin" : "viewer",
    session?.username || "",
  ].join("|");

const renderBadge = (badge, session) => {
  badge.className = `session-mode-badge ${session?.isAdmin ? "is-admin" : "is-viewer"}`;
  badge.dataset.authenticated = session?.isAuthenticated ? "true" : "false";

  const userLabel = session?.isAuthenticated && session.username
    ? `<span class="session-mode-user">${session.username}</span>`
    : `<span class="session-mode-user">Sin sesion</span>`;

  badge.innerHTML = `
    <div class="session-mode-info">
      <span class="session-mode-label">${buildLabel(session)}</span>
      ${userLabel}
    </div>
    ${
      session?.isAuthenticated
        ? `<button type="button" class="session-mode-logout" title="Cerrar sesion">Cerrar sesion</button>`
        : ""
    }
  `;

  badge.querySelector(".session-mode-logout")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    logout();
  });
};

const ensureBadge = () => {
  const statusPanel = document.getElementById("map-status-panel");
  if (!statusPanel) return null;

  let badge = document.getElementById(rootId);
  if (badge) return badge;

  badge = document.createElement("div");
  badge.id = rootId;
  badge.addEventListener("click", (event) => event.stopPropagation());
  badge.addEventListener("mousedown", (event) => event.stopPropagation());
  badge.addEventListener("dblclick", (event) => event.stopPropagation());

  statusPanel.insertAdjacentElement("afterend", badge);
  return badge;
};

const refreshSessionBadge = async () => {
  const badge = ensureBadge();
  if (!badge) return;

  const session = await loadSession();
  const sessionKey = getSessionKey(session);
  if (sessionKey === lastSessionKey) return;

  lastSessionKey = sessionKey;
  renderBadge(badge, session);
  window.dispatchEvent(new CustomEvent("sotero-session-changed", { detail: session || {} }));
};

export const initSessionModeBadge = async () => {
  await refreshSessionBadge();

  window.addEventListener("focus", refreshSessionBadge);

  if (!pollHandle) {
    pollHandle = window.setInterval(refreshSessionBadge, sessionPollMs);
  }
};
