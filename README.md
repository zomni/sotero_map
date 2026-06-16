# SoteroMap Frontend

Frontend del mapa interactivo del Complejo Asistencial Sotero del Rio.

Este proyecto nace desde CampusMap, pero fue adaptado para SoteroMap: edificios hospitalarios, pisos, salas, buscador avanzado, integracion con backend, inventario real, historial, dashboard y herramientas de edicion para administradores.

## Arquitectura rapida

La base del frontend se reparte asi:

- `src/index.js`: arranque de la app.
- `src/views/`: mapa principal, popup y pantallas de visualizacion.
- `src/components/`: buscadores, selector de campus, panel admin, editores de geometria y ruta.
- `src/utils/`: helpers de busqueda, sincronizacion, rutas y lectura de respaldos.
- `src/data/`: geometria local, indice de busqueda, rutas caminables y respaldos del backend.
- `src/index.css`: estilos globales.

## Resumen

El frontend se encarga de la experiencia visual del mapa y de la estructura fisica:

- campus y selector de campus
- edificios, poligonos y geometria visual
- pisos y salas
- buscador principal del mapa
- popups de edificio con resumen, salas, equipos e historial
- navegacion directa por URL
- panel de sincronizacion y estado del backend
- herramientas admin para crear, editar forma y mover edificios
- soporte para rutas caminables y restauracion local de datos cuando la API no responde

El backend complementa esa experiencia con:

- inventario real de equipos
- autenticacion y roles
- dashboard en `/dashboard`
- historial de cambios
- formularios PDF de entrega
- importacion/exportacion de BDD
- sincronizacion de equipos hacia el mapa

En la practica, el frontend mantiene el mapa y la experiencia visual; el backend mantiene los datos operativos.

## Inicio rapido

Requisitos:

- Node.js
- Docker Desktop
- Backend SoteroMap si quieres ver inventario real

Instalar dependencias:

```bash
npm install
```

Levantar frontend en desarrollo:

```bash
npm run dev
```

Detener frontend:

```bash
npm run stop-dev
```

Frontend disponible en:

```text
http://localhost:8080
```

## Uso junto al backend

Para la experiencia completa, el backend debe estar corriendo en:

```text
http://localhost:5000
```

En el repositorio del backend:

```powershell
docker compose up -d --build
```

URLs principales:

- Mapa: `http://localhost:8080`
- Dashboard: `http://localhost:5000/dashboard`
- Login backend: `http://localhost:5000/Auth/Login`
- Swagger backend: `http://localhost:5000/swagger`

## Funciones del mapa

- Muestra el campus sobre Leaflet + OpenStreetMap.
- Carga edificios, pisos, salas y geometria desde archivos locales.
- Mezcla datos locales con overrides del backend.
- Consulta equipos reales desde el backend por edificio.
- Muestra historial reciente por edificio.
- Detecta estado de la API y ultima modificacion de la BDD.
- Avisa cuando hay cambios pendientes y permite refrescar el mapa manualmente.
- Permite ir desde inventario/ubicaciones del dashboard al edificio exacto.
- Permite ir desde el mapa al inventario filtrando por serie de equipo.
- Soporta deep links hacia edificios, pisos, salas y equipos.
- Puede operar con respaldo local si el backend no esta disponible.

## Buscador

El buscador principal del mapa permite buscar:

- edificios
- salas
- equipos
- series
- fragmentos parciales
- texto con o sin tildes
- mayusculas o minusculas

Cuando el resultado es un edificio, abre el popup en resumen. Cuando el resultado es un equipo, abre el edificio en la seccion Equipos y destaca el equipo buscado.

## Popups de edificios

Cada edificio puede mostrar:

- resumen
- pisos disponibles
- salas del piso
- equipos del piso
- buscador interno de equipos del edificio
- paginacion simple de equipos
- historial reciente
- boton de editar edificio para administradores
- enlace al dashboard/inventario segun corresponda

## Herramientas admin en el mapa

Si la sesion del backend corresponde a un usuario admin, el mapa muestra un panel de herramientas:

- Agregar edificio
- Cerrar poligono
- Editar forma
- Mover edificio

El flujo de agregar edificio:

1. Click en `Agregar edificio`.
2. Marcar puntos en el mapa.
3. Cerrar el poligono.
4. Completar datos del edificio.
5. Guardar.

El flujo de editar o mover:

1. Click en `Editar forma` o `Mover edificio`.
2. Click directo sobre el edificio.
3. Ajustar vertices o arrastrar el marcador.
4. Guardar forma.

Los cambios quedan guardados en el backend y se aplican sobre la geometria del mapa.

## Panel de estado del backend

La esquina superior izquierda muestra:

- API activa o desconectada
- version corta del backend
- ultima modificacion de la BDD
- estado de sincronizacion
- aviso de cambios pendientes
- boton para actualizar mapa cuando corresponde

Debajo aparece el modo de sesion:

- Modo vista
- Modo Administrador
- usuario conectado
- cerrar sesion

El mapa detecta cambios de sesion sin recargar completamente la pagina.

## Navegacion cruzada

Desde el dashboard:

- inventario puede abrir el mapa en el edificio y equipo asignado
- ubicaciones puede abrir el mapa en el edificio exacto

Desde el mapa:

- el popup puede abrir el dashboard
- cada equipo puede abrir el inventario filtrado por su serie
- el boton dashboard abre `http://localhost:5000/dashboard`

Se intenta reutilizar la pestana abierta del mapa o dashboard cuando ya existe.

## Rutas y deep links

Ejemplos:

```text
http://localhost:8080/?id=SR-BLD-001&zoom=20
http://localhost:8080/?id=SR-BLD-001&zoom=20&floor=1
```

Tambien se usan parametros internos para abrir secciones especificas del popup, por ejemplo equipos o salas cuando el enlace viene desde el dashboard.

## Flujo recomendado de trabajo

### Cambios visuales o de mapa

1. Editar archivos del frontend.
2. Ejecutar `npm run dev`.
3. Verificar en `http://localhost:8080`.

### Cambios de inventario

1. Levantar backend.
2. Entrar a `http://localhost:5000/dashboard`.
3. Importar o restaurar la BDD si corresponde.
4. Editar inventario/ubicaciones desde el dashboard.
5. Refrescar mapa cuando el panel indique cambios pendientes.

### Migrar a otro PC

1. Clonar frontend y backend.
2. En frontend: `npm install` y `npm run dev`.
3. En backend: `docker compose up -d --build`.
4. Entrar al dashboard.
5. Subir/restaurar la DB exportada.
6. Verificar mapa y dashboard.

La BDD real no debe guardarse en el repositorio. Se mueve mediante exportacion/importacion desde el dashboard.

## Comandos utiles

Desarrollo:

```bash
npm run dev
npm run stop-dev
```

Modo produccion local:

```bash
npm run build
npm run prod
npm run stop-prod
```

El build genera la carpeta `dist/`. Esa carpeta contiene los archivos estaticos que puede servir un hosting como IIS, Vercel o un servidor web simple.

## Modo sin API

El mapa puede iniciar usando datos locales cuando el backend no esta disponible:

- edificios base desde `src/data/cs_sotero_0.json`
- indice de busqueda desde `src/data/cs_sotero_search.json`
- rutas caminables desde `src/data/walking_routes_backup.json`
- edificios manuales/overrides desde `src/data/sotero_buildings_backend_backup.json`

Cuando la API responde, el frontend prioriza datos actualizados desde backend. Cuando falla, usa esos respaldos para evitar que el mapa quede vacio.

## Desarrollo diario

- Si cambias geometria, busqueda o rutas, revisa `src/data/` porque ahi quedan los respaldos que alimentan el modo sin API.
- Si una interfaz no refleja cambios, limpia cache del navegador y vuelve a levantar `npm run dev`.
- Si necesitas una version publica estatica, usa `npm run build` y publica `dist/`.
- Si el backend esta caido, el mapa sigue mostrando edificios y rutas locales, pero no inventario real ni historial vivo.

## Publicacion estatica

Para publicar solo el mapa:

1. Ejecuta `npm install`.
2. Ejecuta `npm run build`.
3. Publica la carpeta `dist/`.
4. Verifica que `dist/data/walking_routes_backup.json` y `dist/data/sotero_buildings_backend_backup.json` esten incluidos.

Para Vercel, la carpeta de salida debe ser `dist`.

## Estructura importante

Configuracion general:

- `src/data/campuses.js`: campus disponibles, centro y zoom.
- `src/index.html`: estructura principal e import map.
- `src/index.js`: punto de entrada.
- `src/index.css`: estilos globales.

Datos del campus Sotero:

- `src/data/cs_sotero_0.json`: geometria principal.
- `src/data/cs_sotero_search.json`: indice de busqueda.
- `src/data/sotero_buildings_catalog.json`: catalogo auxiliar.
- `src/data/walking_routes_backup.json`: respaldo estatico de rutas caminables para uso sin API.
- `src/data/sotero_buildings_backend_backup.json`: respaldo estatico de edificios editados, manuales y geometria para uso sin API.
- `src/data/interiors/`: detalles, pisos y salas.

Desde el panel de sincronizacion, el boton admin `Guardar respaldo` llama al backend y reemplaza directamente los dos JSON de respaldo en esta carpeta.

Componentes principales:

- `src/components/autocompleteSearchBox.js`: buscador avanzado.
- `src/components/campusSelector.js`: selector de campus.
- `src/components/routePlanner.js`: ruta visual entre edificios.
- `src/components/sessionModeBadge.js`: sesion visible del backend.
- `src/components/manualBuildingEditor.js`: crear edificios desde mapa.
- `src/components/buildingGeometryEditor.js`: editar/mover geometria.
- `src/components/adminMapToolsPanel.js`: panel admin unificado.
- `src/views/map.js`: inicializacion Leaflet y URL base backend.
- `src/views/featureDisplay.js`: popups, equipos, historial y sincronizacion.
- `src/utils/findByUrl.js`: navegacion por URL con parametros `id`, `floor`, `view`, `roomId` y `deviceKey`.
- `src/utils/soteroSearchMetadata.js`: mezcla data local con backend.
- `src/utils/walkingRouteStorage.js`: carga rutas desde API, respaldo local o respaldo estatico.

## Cambios principales respecto al proyecto original

- Adaptacion al Complejo Asistencial Sotero del Rio.
- Integracion con backend ASP.NET Core.
- Inventario real sincronizado desde SQLite.
- Dashboard conectado al mapa.
- Busqueda tolerante para edificios, salas y equipos.
- Popups con resumen, salas, equipos e historial.
- Panel de sincronizacion y estado del backend.
- Herramientas admin para crear, editar y mover edificios.
- Navegacion cruzada mapa-dashboard.
- Soporte de equipos destacados, busqueda interna y paginacion dentro del popup.
- Respaldo local de edificios, rutas y busqueda para cuando no haya API.

## Licencias y creditos

El proyecto original se apoyaba en bibliotecas open source como Leaflet, jQuery, FuseJS y otras dependencias del ecosistema web.

Archivos relacionados:

- `LICENSE.md`
- `LICENSE.dependencies.md`

## Nota final

Si levantas solo el frontend, el mapa puede cargar sus datos locales. Las funciones que dependen del backend, como inventario real, estado de API, historial y herramientas admin con permisos, requieren que la API este disponible.
