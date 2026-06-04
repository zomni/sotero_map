// Add the campus selector component
import "@app/campusSelector";

// Search for the feature by id/alias in URL
import "@app/findByUrl";

// Building-to-building route planner
import "@app/routePlanner";

// Backend session mode indicator
import { initSessionModeBadge } from "@app/sessionModeBadge";

// Manual building polygon editor for admins
import { initManualBuildingEditor } from "@app/manualBuildingEditor";

// Existing building geometry editor for admins
import { initBuildingGeometryEditor } from "@app/buildingGeometryEditor";

initSessionModeBadge();
initManualBuildingEditor();
initBuildingGeometryEditor();
