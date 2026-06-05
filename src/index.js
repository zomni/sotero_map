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

// Walking route network editor for admins
import { initWalkingRouteEditor } from "@app/walkingRouteEditor";

// Persistent walking route visibility layer
import { initWalkingRouteLayer } from "@app/walkingRouteLayer";

initSessionModeBadge();
initWalkingRouteLayer();
initManualBuildingEditor();
initBuildingGeometryEditor();
initWalkingRouteEditor();
