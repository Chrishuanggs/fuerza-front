# Calculadora de Fuerza (frontend)

Aplicación Angular 18 del proyecto de Ingeniería del Software 3 (Universidad CENFOTEC).
Estima el 1RM desde una serie, arma la tabla de porcentajes, resume sesiones de
entrenamiento, ubica al atleta en una escalera de rangos (Hierro a Obsidiana) y ofrece
un coach conversacional sobre la API de Gemini.

El backend es [fuerza-api](../fuerza-api) (Spring Boot). Si el backend está en línea, los
cálculos viajan por REST; si no, la app los hace en el navegador con las mismas reglas
(`src/app/nucleo/motor-fuerza.ts` es el espejo de `FuerzaServiceImpl.java`) y lo indica
en la barra superior como "Modo local".

## Correr en local

Requisitos: Node 20.11.1 o superior.

```bash
npm install
npm start
```

Abre `http://localhost:4200`. Para que use el backend, levantá `fuerza-api` en
`http://localhost:8080` (o cambiá la dirección en Ajustes).

## Pruebas

```bash
npm test
```

Corre los mismos casos que las pruebas JUnit del backend, para garantizar que los dos
motores de cálculo dan resultados idénticos.

## Publicar en GitHub Pages

El repositorio incluye `.github/workflows/publicar.yml`. Cada `push` a `main` construye la
app y la publica. Solo hay que activarlo una vez:

1. En GitHub, en el repositorio: **Settings > Pages > Build and deployment > Source**,
   elegir **GitHub Actions**.
2. Hacer `push` a `main` (o ejecutar el workflow desde la pestaña Actions).
3. La app queda en `https://TU_USUARIO.github.io/fuerza-front/`.

El workflow calcula el `base-href` solo: si el repositorio se llama `TU_USUARIO.github.io`
publica en la raíz; si no, en `/nombre-del-repo/`. También copia `index.html` a `404.html`
para que las rutas profundas (`/rango`, `/coach`) funcionen al abrirlas directo.

## Coach en la página publicada

GitHub Pages solo sirve archivos estáticos, así que el Spring Boot no corre ahí. El coach
tiene dos caminos:

- **Backend.** Si tenés `fuerza-api` corriendo en tu máquina con la llave configurada, la
  página publicada lo usa (Chrome puede pedir permiso para que un sitio público acceda a
  `localhost`). Para eso `app.cors.origenes` en el backend debe incluir
  `https://TU_USUARIO.github.io`.
- **Llave propia en el navegador.** En Ajustes se puede pegar una llave gratuita de
  [Google AI Studio](https://aistudio.google.com/apikey). Se guarda en `localStorage` de
  ese navegador y el front llama a Gemini directo. Nunca se sube al repositorio.

## Estructura

```
src/app/
  nucleo/
    modelos.ts                Tipos que espejan los records y enums de Java
    motor-fuerza.ts           Reglas de cálculo (espejo de FuerzaServiceImpl)
    fuerza.service.ts         Único punto que habla con el backend; cae a motor local
    coach.service.ts          Coach por backend o directo a Gemini
    instruccion-coach.ts      Copia de la instrucción de sistema (solo modo navegador)
    perfil-atleta.service.ts  Último cálculo, para dar contexto al coach
    historial.service.ts      Historial en localStorage y exportación a CSV
    configuracion.service.ts  Backend, llave, modelo, unidad y tema
    unidades.service.ts       Conversión kg/lb y formato
  compartido/                 Validadores y la escalera de rangos
  paginas/                    Una carpeta por pantalla
  app.routes.ts               Rutas (todas cargadas bajo demanda)
```

Dependencias de terceros: Chart.js para la gráfica de progreso.
