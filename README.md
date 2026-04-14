# SoteroMap Frontend

Frontend del mapa interactivo del Complejo Asistencial Sotero del Rio.

Este proyecto nace a partir del CampusMap original de CentraleSupelec, pero fue adaptado para el contexto de SoteroMap: edificios hospitalarios, salas, navegacion por pisos, integracion con un backend administrativo y visualizacion de equipos reales sincronizados desde la base de datos.

## Resumen

El frontend se encarga de la experiencia visual del mapa y de la estructura fisica del campus:

- campus y selector de campus
- edificios y su geometria
- pisos y salas
- buscador principal del mapa
- popups y navegacion visual
- integracion con el dashboard del backend

El backend complementa esa experiencia con:

- inventario de equipos
- autenticacion y roles
- dashboard administrativo
- historial de cambios
- importacion y exportacion de la base de datos
- sincronizacion del inventario hacia el mapa

En la practica, el frontend mantiene la estructura del mapa y el backend mantiene el inventario.

## Que hace este frontend

- Muestra el mapa del campus sobre Leaflet + OpenStreetMap.
- Carga edificios, pisos, salas y geometria desde archivos locales del frontend.
- Consulta el backend para obtener equipos, historial y estado de sincronizacion.
- Permite buscar edificios, salas y equipos desde un buscador tolerante.
- Abre popups con vistas de resumen, equipos e historial.
- Permite navegar por deep links hacia edificio, piso, sala o equipo.
- Incluye un panel de estado del backend dentro del mapa.
- Incluye accesos directos al dashboard administrativo.
- Permite navegar desde el dashboard al mapa y desde el mapa al dashboard.

## Arquitectura actual

La separacion actual del proyecto es la siguiente:

- Frontend: campus, edificios, pisos, salas, geometria del mapa y experiencia de navegacion.
- Backend: inventario de equipos, autenticacion, historial, dashboard admin, importacion/exportacion de BDD y sincronizacion.

Eso permite seguir editando el mapa desde este repositorio, mientras el inventario real se administra desde el backend.

## Requisitos

- Node.js
- Docker Desktop
- Backend SoteroMap levantado en local si quieres ver inventario real

## Inicio rapido

Instalar dependencias del frontend:

```bash
npm install
```

Levantar el frontend en desarrollo:

```bash
npm run dev
```

Detener el frontend:

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

En el repositorio del backend, el flujo actual de desarrollo es:

```bash
docker compose up -d --build
```

Con el backend activo, el mapa puede:

- mostrar equipos reales por edificio
- reflejar asignaciones hechas desde el dashboard
- mostrar version de la API y ultima modificacion de la BDD
- detectar cambios pendientes y permitir refrescar el mapa
- abrir el dashboard desde el mapa
- recibir navegacion directa desde inventario y ubicaciones del dashboard

## Comandos utiles

Desarrollo local del frontend:

```bash
npm run dev
npm run stop-dev
```

Servidor tipo produccion local:

```bash
npm run prod
npm run stop-prod
```

## URLs utiles

- Frontend: `http://localhost:8080`
- Backend admin: `http://localhost:5000/admin`
- Backend login: `http://localhost:5000/Auth/Login`
- Swagger backend: `http://localhost:5000/swagger`

## Flujo recomendado de trabajo

### Cambios visuales o estructurales del mapa

1. Editar archivos de datos o vistas del frontend.
2. Levantar el frontend con `npm run dev`.
3. Verificar el resultado en `http://localhost:8080`.

### Cambios de inventario

1. Levantar el backend.
2. Importar o restaurar la base de datos desde el dashboard.
3. Asignar equipos a edificios, pisos o salas desde el admin.
4. Refrescar el mapa cuando el panel indique cambios pendientes.

### Cambio de equipo o migracion a otro PC

1. Clonar el frontend y el backend.
2. Levantar el frontend con `npm run dev`.
3. Levantar el backend con `docker compose up -d --build`.
4. Importar la base de datos desde el dashboard del backend.
5. Verificar el mapa en `http://localhost:8080`.

Nota importante:

- Este repositorio no necesita guardar la BDD del backend.
- La BDD se mueve mediante exportacion e importacion desde el dashboard.

## Busqueda y navegacion

El mapa soporta:

- busqueda tolerante por edificios, salas y equipos
- coincidencias por fragmentos, mayusculas/minusculas y texto parcial
- deep links por URL
- apertura automatica del popup correcto al llegar desde enlaces internos
- navegacion entre mapa y dashboard sin perder contexto

Ejemplo de deep link:

```text
http://localhost:8080/?id=SR-BLD-001&zoom=20&floor=1
```

## Panel de estado del backend

La esquina superior izquierda del mapa muestra:

- si la API esta activa
- version actual del backend
- ultima modificacion relevante de la BDD
- estado de sincronizacion
- aviso de cambios pendientes
- boton para actualizar el mapa cuando corresponde

## Estructura importante del proyecto

Configuracion general:

- `src/data/campuses.js`: campus disponibles, centro del mapa y zoom.
- `src/index.html`: estructura principal del mapa y panel superior.
- `src/index.js`: punto de entrada del frontend.
- `src/index.css`: layout global.

Datos del campus Sotero:

- `src/data/cs_sotero_0.json`: geometria principal del mapa.
- `src/data/cs_sotero_search.json`: indice de busqueda de edificios, salas y elementos relacionados.
- `src/data/cs_searchByURL.json`: soporte para deep links.
- `src/data/sotero_buildings_catalog.json`: catalogo auxiliar de edificios y metadatos.
- `src/data/cs_features_data.csv`: datos auxiliares del mapa.

Logica principal:

- `src/components/autocompleteSearchBox.js`: buscador avanzado del mapa.
- `src/components/campusSelector.js`: selector de campus.
- `src/views/map.js`: inicializacion de Leaflet e integracion base con el backend.
- `src/views/featureDisplay.js`: popups, panel de estado, equipos, historial y sincronizacion.
- `src/utils/findByUrl.js`: navegacion por URL hacia edificios, pisos, salas y equipos.

## Cambios principales respecto al proyecto original

Sobre la base original de CampusMap, este proyecto incorpora:

- adaptacion completa al Complejo Asistencial Sotero del Rio
- edificios hospitalarios y datos propios del campus
- integracion con backend ASP.NET Core
- inventario de equipos sincronizado desde base de datos
- dashboard administrativo enlazado al mapa
- historial de cambios visible en popups
- panel de estado del backend dentro del frontend
- buscador mas tolerante para uso real con inventario
- navegacion cruzada entre mapa, ubicaciones e inventario

## Licencias y creditos

El proyecto original se apoyaba en bibliotecas open source como Leaflet, jQuery, FuseJS y otras dependencias del ecosistema web.

Archivos relacionados:

- `LICENSE.md`
- `LICENSE.dependencies.md`

## Nota final

Si solo levantas el frontend, el mapa seguira funcionando con sus datos locales de edificios y salas. Las funciones que dependen del backend quedaran sin inventario real o mostraran estado sin conexion hasta que la API este disponible.
