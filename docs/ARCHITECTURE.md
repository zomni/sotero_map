# Arquitectura de Codigo - SoteroMap Frontend

Este documento describe la arquitectura practica del frontend `sotero_map`. Esta pensado para mantenimiento diario: entender donde tocar, que flujos existen, como se mezclan datos locales con backend y que revisar antes de cerrar un cambio.

## Resumen ejecutivo

SoteroMap Frontend es una aplicacion web estatica basada en Leaflet. Renderiza el mapa del Complejo Asistencial Sotero del Rio, sus edificios, pisos, salas, rutas caminables, busqueda, popups y herramientas de edicion.

El frontend funciona en dos modos:

- Con backend disponible: prioriza datos actualizados desde `sotero_map_api`.
- Sin backend: usa JSON locales y respaldos estaticos para que el mapa no quede vacio.

El backend administra inventario real, usuarios, auditoria, formularios, backups y permisos. El frontend administra la experiencia visual y la interaccion directa con el mapa.

## Stack principal

- Mapa: Leaflet.
- Edicion geometrica: Leaflet.draw y editores propios.
- Busqueda: Fuse + scoring propio tolerante.
- Bundler: Webpack.
- Build portable: `create_dist.js`.
- Datos locales: archivos JSON en `src/data`.
- UI: HTML/CSS/JS sin framework SPA pesado.

## Estructura de carpetas

```text
src/
  assets/         Iconos, favicon, SVGs de edificios.
  components/     Componentes de UI y herramientas del mapa.
  data/           Campus, GeoJSON, indice de busqueda, respaldos.
  lib/            Dependencias locales: Leaflet, Leaflet.draw, Fuse, jQuery.
  styles/         CSS del mapa, buscador, botones y layout.
  utils/          Carga/mezcla de datos, navegacion, cookies, respaldos.
  views/          Inicializacion Leaflet, popups, render de features.
```

Archivos raiz importantes:

- `package.json`: scripts.
- `webpack.config.js`: aliases y bundle.
- `create_dist.js`: copia assets/datos a `dist` de forma portable.
- `docker-compose.dev.yaml`: desarrollo local.
- `docker-compose.prod.yaml`: produccion local.

## Punto de entrada

El punto de entrada es `src/index.js`.

Este archivo no renderiza todo directamente; importa y activa modulos:

- `campusSelector`: selector de campus y botones de piso.
- `findByUrl`: deep links por URL.
- `routePlanner`: ruta entre edificios.
- `sessionModeBadge`: sesion visible y link a inventario.
- `manualBuildingEditor`: crear edificios.
- `buildingGeometryEditor`: editar/mover edificios.
- `walkingRouteEditor`: editar rutas caminables.
- `walkingRouteLayer`: mostrar/ocultar rutas.

Regla diaria:

- Si una funcionalidad debe inicializarse al cargar el mapa, normalmente se importa o llama desde `index.js`.
- Si depende de sesion admin, debe sincronizarse con `sessionModeBadge` y los editores admin.

## Mapa base

`src/views/map.js` crea la instancia Leaflet.

Responsabilidades:

- Importa Leaflet.
- Lee el primer campus desde `src/data/campuses.js`.
- Aplica `maxBounds` al area del campus.
- Agrega tile layer de OpenStreetMap.
- Define `HOST_URL` y `BACKEND_API_URL`.
- Implementa seguimiento continuo de ubicacion del usuario.

Puntos de cuidado:

- `BACKEND_API_URL` se calcula con el mismo host y puerto `5000`.
- Si publicas solo frontend estatico, ese backend puede no existir; los modulos deben tolerar fallo de API.
- El boton `bLoc` activa/desactiva tracking GPS.
- Cambios en bounds pueden afectar popup, zoom y rebote visual.

## Campus y pisos

`src/data/campuses.js` define:

- campus disponibles
- centro inicial
- zoom inicial
- bounds
- floors/default floor
- paths a GeoJSON

`src/components/campusSelector.js` y `src/utils/goToCampus.js` coordinan:

- seleccionar campus
- guardar campus en cookie
- crear botones de pisos
- cargar datos del piso
- refrescar datos del mapa
- activar ubicacion con `bLoc`

Flujo:

```text
campusSelector
  -> goTo(campus)
  -> addDataToMap(school, floor, location)
  -> GeoJSON local + metadatos backend
  -> featureDisplay.onEachFeature
```

## Carga de edificios

`src/utils/addData.js` agrega datos al mapa.

Responsabilidades:

- Cargar GeoJSON del piso.
- Enriquecerlo con catalogo y metadata backend.
- Agregar edificios manuales.
- Aplicar overrides de geometria.
- Crear capas Leaflet.
- Reabrir popup si el usuario estaba viendo un edificio.
- Resetear cache cuando cambian datos.

Datos locales usados:

- `src/data/cs_sotero_0.json`, `cs_sotero_1.json`, etc.
- `src/data/sotero_buildings_catalog.json`.
- `src/data/sotero_buildings_manual_data.json`.
- `src/data/interiors/...`.

Datos backend mezclados:

- edificios sincronizados
- edificios manuales
- overrides de geometria
- pisos manuales
- nombres editados
- edificios eliminados

## Mezcla local + backend

`src/utils/soteroSearchMetadata.js` es una pieza central.

Responsabilidades:

- Cargar metadata desde backend.
- Cargar respaldos estaticos si la API falla.
- Mezclar catalogo local con overrides backend.
- Aplicar nombres, pisos, campus, IDs y geometria.
- Preparar metadata para buscador y popups.
- Resetear caches cuando se guarda o refresca.

`src/utils/buildingBackupStorage.js` implementa respaldo de edificios:

- Intenta API.
- Guarda copia en `localStorage`.
- Si API falla, lee `localStorage`.
- Si no hay localStorage, lee `src/data/sotero_buildings_backend_backup.json`.

Regla importante:

- Si cambias el contrato de edificios del backend, actualiza `soteroSearchMetadata.js`, `buildingBackupStorage.js` y el JSON estatico.

## Popups de edificios

`src/views/featureDisplay.js` concentra la mayor parte de la experiencia de edificio.

Responsabilidades:

- Estilo de poligonos.
- Hover y seleccion.
- Abrir/cerrar popup.
- Mantener vista actual del popup.
- Selector de piso dentro del popup.
- Selector de vista: resumen, salas, equipos, historial.
- Botones para inventario/dashboard.
- Mostrar equipos del edificio.
- Buscar equipos dentro de un edificio.
- Paginar equipos.
- Mostrar historial reciente.
- Mostrar burbuja de cantidad de equipos sobre edificios.
- Mostrar/ocultar nombres de edificios.
- Monitor de estado backend y cambios pendientes.
- Sincronizar sesion admin para botones del popup.

Estados internos importantes:

- `currentOpenFeatureId`: edificio abierto.
- `popupViewState`: vista activa por edificio.
- `popupRoomState`: sala seleccionada por edificio.
- `popupDeviceState`: equipo destacado por edificio.
- `buildingLabelsVisible`: nombres visibles.
- `globalEquipmentTypeFilter`: filtro global por tipo.

Puntos delicados:

- Esta vista toca muchas cosas. Cambios visuales aparentemente pequeños pueden afectar popups, search, sync y herramientas admin.
- Si cambias HTML del popup, revisa listeners delegados.
- Si cambias nombres de clases/botones, revisa estilos y eventos.
- Si cambias filtros de equipos, revisa tambien buscador global y links desde dashboard.

## Buscador principal

`src/components/autocompleteSearchBox.js` implementa el buscador.

Busca:

- edificios
- salas
- equipos
- series
- fragmentos
- texto sin distinguir mayusculas/minusculas
- texto sin tildes
- coincidencias tolerantes

Usa:

- perfiles normalizados
- tokens
- compact/dense strings
- Fuse
- busqueda por subsecuencia
- datos locales + backend

Cuando se selecciona un resultado:

- Si es edificio: abre popup en resumen.
- Si es equipo: abre edificio, cambia a vista equipos y destaca equipo.
- Si es sala: abre edificio, piso y sala.

Regla diaria:

- Si el buscador no encuentra algo, revisar primero la fuente de datos: `cs_sotero_search.json`, metadata backend o inventario.
- Si encuentra pero no abre bien, revisar `openFeatureLayer`, `waitForFeatureLayer`, `featureDisplay` y `findByUrl`.

## Deep links y navegacion cruzada

`src/utils/findByUrl.js` abre edificios/salas/equipos desde parametros URL.

Parametros usados:

- `id`: edificio.
- `floor`: piso.
- `view`: vista del popup.
- `roomId`: sala.
- `deviceKey`: equipo/serie.
- `zoom`: zoom solicitado.

El dashboard usa esos parametros para llevar desde inventario o ubicaciones al mapa.

El mapa usa `window.open` con nombres de ventana para reutilizar pestanas cuando abre inventario/dashboard.

## Rutas entre edificios

`src/components/routePlanner.js` implementa el panel "A donde quieres ir".

Responsabilidades:

- Combobox con busqueda para origen/destino.
- Calcular ruta mas corta sobre red caminable.
- Seleccionar punto de acceso de edificio.
- Dibujar ruta seleccionada.
- Mostrar flechas.
- Resaltar origen y destino.
- Usar GPS como origen cuando aplica.
- Limpiar ruta.

Datos:

- Edificios desde catalogo + metadata.
- Red caminable desde `walkingRouteStorage`.

Algoritmo:

- Construye grafo con nodos y edges.
- Ignora rutas cerradas si corresponde.
- Calcula ruta mas corta por distancia.
- Renderiza polyline y flechas.

Puntos de cuidado:

- La ruta seleccionada debe distinguirse claramente de rutas visibles.
- No debe reiniciar estado global del mapa ni ocultar controles.
- Si API falla, debe seguir usando respaldo local/estatico.

## Rutas caminables visibles

`src/components/walkingRouteLayer.js` muestra/oculta rutas existentes.

Responsabilidades:

- Cargar network.
- Crear capa Leaflet.
- Dibujar edges.
- Mantener estado del boton "mostrar rutas".
- Refrescar rutas tras edicion.

`src/utils/walkingRouteStorage.js` define estrategia de carga:

1. API `/api/walking-routes`.
2. Respaldo `localStorage`.
3. Respaldo estatico `src/data/walking_routes_backup.json`.
4. Red vacia.

Tambien registra en consola si carga desde API, respaldo local o estatico.

## Editor de rutas

`src/components/walkingRouteEditor.js` permite admin:

- Crear rutas por clicks.
- Crear rutas con dibujo libre.
- Mover vertices.
- Unir vertices.
- Separar vertices.
- Conectar rutas al borde de edificios.
- Eliminar tramos.
- Deshacer ultima accion.
- Guardar rutas.

Puntos de cuidado:

- Drag mantenido debe mover vertice.
- Click simple puede iniciar ruta desde vertice.
- Ctrl en dibujo libre permite moverse por mapa.
- Los botones activos viven dentro del panel admin unificado.
- Despues de guardar, se refresca `walkingRouteLayer`.
- Cambios del backend deben reflejarse sin exigir actualizacion manual innecesaria.

## Herramientas admin de edificios

### `adminMapToolsPanel.js`

Panel unificado para herramientas admin:

- Agregar edificio.
- Editar forma.
- Mover edificio.
- Editar rutas.
- Eliminar rutas.
- Separar vertice.
- Conectar edificio.
- Deshacer.

El panel se muestra solo con sesion admin.

### `manualBuildingEditor.js`

Permite crear edificios:

1. Activar agregar edificio.
2. Marcar vertices del poligono.
3. Guardar forma.
4. Completar modal propio.
5. POST al backend.
6. Refrescar mapa/cache.

### `buildingGeometryEditor.js`

Permite:

- Editar forma de edificio existente.
- Mover edificio.
- Guardar/cancelar.
- Persistir override en backend.

Regla diaria:

- Los tres modulos admin deben compartir estado visual via `adminMapToolsPanel`.
- Solo una herramienta activa a la vez.
- Si una herramienta desaparece, revisar sincronizacion de sesion y `removeAdminMapToolsPanelIfEmpty`.

## Sesion backend en el mapa

`src/components/sessionModeBadge.js` consulta:

- `GET /api/auth/session`

Muestra:

- Modo vista.
- Modo Administrador.
- Usuario conectado.
- Cerrar sesion.
- Boton Inventario.

Tambien coordina la visibilidad de herramientas admin.

Punto clave:

- El mapa debe detectar cambios de sesion sin F5.
- Si el popup no cambia permisos al iniciar/cerrar sesion, revisar cache de sesion en `featureDisplay.js`.

## Estado de API y sincronizacion

`featureDisplay.js` consulta:

- `GET /api/inventory-import/sync-state`

El panel informa:

- API activa/desconectada.
- version backend.
- ultima modificacion de BDD.
- si hay cambios pendientes.
- boton actualizar mapa.
- guardar respaldo estatico para admin.

La revision compara `revision` backend contra `loadedEquipmentRevision`.

Si algo cambia en:

- inventario
- asignaciones
- edificios
- rutas
- auditoria

el backend debe actualizar fechas/contador para que `sync-state` cambie.

## Datos locales importantes

### GeoJSON por piso

- `src/data/cs_sotero_-1.json`
- `src/data/cs_sotero_0.json`
- `src/data/cs_sotero_1.json`
- `src/data/cs_sotero_2.json`
- `src/data/cs_sotero_3.json`
- `src/data/cs_sotero_4.json`
- `src/data/cs_sotero_5.json`

### Busqueda y catalogo

- `src/data/cs_sotero_search.json`
- `src/data/sotero_buildings_catalog.json`
- `src/data/sotero_buildings_manual_data.json`

### Respaldos sin API

- `src/data/walking_routes_backup.json`
- `src/data/sotero_buildings_backend_backup.json`

### Interiores

- `src/data/interiors/{BUILDING_ID}/building_detail.json`
- `src/data/interiors/{BUILDING_ID}/floor_X_rooms.json`
- `src/data/interiors/{BUILDING_ID}/devices.json`

Actualmente el inventario real viene del backend, pero los interiores siguen sirviendo como estructura local de edificios/salas.

## Build y publicacion

### Desarrollo

```bash
npm install
npm run dev
```

### Build estatico

```bash
npm run build
```

El build:

- Ejecuta `node create_dist.js`.
- Copia assets, data, styles, HTML y librerias a `dist`.
- Ejecuta Webpack.

La carpeta a publicar en IIS/Vercel/hosting estatico es `dist`.

### Docker

```bash
npm run dev
npm run prod
npm run stop-dev
npm run stop-prod
```

## Contratos con backend

El frontend consume principalmente:

- `GET /api/auth/session`
- `POST /api/auth/logout`
- `GET /api/inventory-import/sync-state`
- `GET /api/inventory-import/items`
- `GET /api/inventory-import/building-summary`
- `GET /api/activity-log/building`
- `GET /api/synced-buildings`
- `GET /api/synced-rooms`
- `GET /api/manual-buildings`
- `POST /api/manual-buildings`
- `DELETE /api/manual-buildings/{externalId}`
- `GET /api/building-geometry-overrides`
- `POST /api/building-geometry-overrides`
- `GET /api/walking-routes`
- `POST /api/walking-routes/paths`
- `PUT /api/walking-routes/nodes/{externalId}`
- `PUT /api/walking-routes/edges/{externalId}`
- `DELETE /api/walking-routes/edges/{externalId}`
- `POST /api/frontend-static-backup/save`

Si el backend cambia estos endpoints, revisar:

- `featureDisplay.js`
- `autocompleteSearchBox.js`
- `routePlanner.js`
- `walkingRouteStorage.js`
- `buildingBackupStorage.js`
- `soteroSearchMetadata.js`
- editores admin.

## Cache y respaldos

El frontend usa varias capas de cache:

- caches JS en memoria para metadata, rutas, resumen de equipos.
- `localStorage` para rutas y edificios de respaldo.
- archivos JSON estaticos versionados con query string.
- cache del navegador, parcialmente controlada por parametros `?v=...`.

Cuando algo no se refleja:

1. Revisar si la API responde con datos nuevos.
2. Revisar `sync-state.revision`.
3. Revisar caches reset: `resetSoteroSearchMetadataCaches`, `resetBuildingsCatalogCache`, `resetWalkingRoutesLayerCache`.
4. Revisar si el archivo estatico fue actualizado con "Guardar respaldo".
5. Probar `Ctrl + F5`.

## Reglas para cambios frecuentes

### Cambiar nombre/pisos de edificio

- Backend: `SyncedBuildings` y/o overrides.
- Frontend: mezcla en `soteroSearchMetadata.js`.
- Revisar popup, buscador y botones de piso.
- Revisar `sync-state`.

### Cambiar forma de edificio

- Frontend: `buildingGeometryEditor.js`.
- Backend: `BuildingGeometryOverridesController`.
- Respaldar estatico si se quiere funcionamiento sin API.

### Crear edificio

- Frontend: `manualBuildingEditor.js`.
- Backend: `ManualBuildingsController`.
- Revisar que aparezca en popup, buscador, inventario y rutas.

### Cambiar busqueda

- Revisar `autocompleteSearchBox.js`.
- Revisar `soteroSearchMetadata.js`.
- Si cambia fuente local, regenerar `cs_sotero_search.json`.

### Cambiar equipos en popup

- Revisar `featureDisplay.js`.
- Revisar endpoint `inventory-import/items`.
- Revisar `building-summary`.
- Revisar filtros por tipo y paginacion.

### Cambiar rutas

- Revisar `walkingRouteEditor.js`.
- Revisar `walkingRouteLayer.js`.
- Revisar `routePlanner.js`.
- Revisar `walkingRouteStorage.js`.
- Revisar backend `WalkingRoutesController`.

### Cambiar sesion/permisos

- Revisar `sessionModeBadge.js`.
- Revisar `featureDisplay.js` para botones del popup.
- Revisar editores admin.

## Diagnostico rapido

### El mapa queda sin edificios

Revisar:

- `cs_sotero_0.json` existe y carga.
- campus seleccionado.
- `addData.js` no esta filtrando todo.
- bounds del campus no dejan la vista fuera.
- consola por errores de JSON.

### Buscador no encuentra

Revisar:

- `cs_sotero_search.json`.
- `mergeGeoJsonWithSoteroSearch`.
- si el resultado viene de backend, endpoint de inventario.
- normalizacion de texto en `autocompleteSearchBox.js`.

### Popup no abre desde link

Revisar:

- `findByUrl.js`.
- `openBuildingPopupLayer`.
- existencia de layer en piso actual.
- `floor` en URL.

### No se ven nombres de edificios

Revisar:

- `buildingLabelsVisible`.
- boton en filtros.
- `bindBuildingNameLabel`.
- z-index/clases CSS.

### No se ven rutas

Revisar:

- boton mostrar rutas.
- `walkingRouteLayer.js`.
- API `/api/walking-routes`.
- `localStorage`.
- `walking_routes_backup.json`.

### Herramientas admin no aparecen

Revisar:

- `/api/auth/session`.
- rol `admin`.
- `sessionModeBadge.js`.
- `syncManualBuildingEditorForSession`.
- `syncBuildingGeometryEditorForSession`.
- `syncWalkingRouteEditorForSession`.

### El boton Ir reinicia estado

Revisar:

- `routePlanner.js`.
- que no llame refresh completo innecesario.
- `clearRouteOverlay`.
- `setRouteHighlight`.
- estado de botones de filtros/nombres/rutas.

## Convenciones de mantenimiento

- Mantener datos del backend como fuente prioritaria si esta disponible.
- Mantener respaldo local/estatico para uso sin API.
- No introducir dependencias grandes si Leaflet/JS actual lo resuelve.
- No duplicar controles sueltos: usar paneles existentes.
- Mantener solo una herramienta admin activa a la vez.
- Cada cambio visual debe probarse en escritorio y movil.
- Cada cambio en contratos backend debe reflejarse en README/arquitectura.
- Si se toca build, probar `npm run build`.

## Checklist antes de commit

- `npm run build` pasa.
- `dist/` se genera correctamente si se publicara.
- No se rompio funcionamiento sin API.
- Buscador abre resultado correcto.
- Popups siguen abriendo y cerrando bien.
- Mostrar nombres/rutas mantiene estado.
- Herramientas admin aparecen solo con admin.
- Rutas siguen cargando desde API, localStorage o backup estatico.
- Si se cambio un JSON base, revisar que no haya datos de prueba obsoletos.
