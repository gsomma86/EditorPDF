# EditorPDF

Editor de PDF real, gratuito y open source — al estilo Sejda PDF / Nitro PDF / GoPDF. Edita PDFs
**preexistentes** (no solo genera desde cero): su texto, sus formas, y además arma formularios
AcroForm, dibujo, líneas, tablas, imágenes y códigos QR sobre cualquier hoja.

## Por qué existe

Editar el contenido real de un PDF hecho en otra herramienta —no solo superponerle cosas encima—
requiere un motor con licencia AGPL. Eso es incompatible con un producto cerrado, así que este
proyecto nace open source desde el día uno.

## Qué hace hoy

- **Abre un PDF real** y deja editar su texto y sus formas (líneas, recuadros) sin perder que siga
  siendo vectorial — no una foto pegada encima.
- **Formularios AcroForm** completos: campos de texto, repetibles (una fila por registro de un
  CSV), campos de firma, importación desde un PDF existente y exportación con el formulario
  funcionando en cualquier lector.
- **Documentos de varias hojas**: cada una con su propio tamaño y orientación, se agregan, se
  duplican, se reordenan y se borran sin tocar las demás.
- **Capas** al estilo InDesign, del documento entero (no de cada hoja): se apagan, se traban, y
  cualquier elemento se puede mandar a la que corresponda.
- **Dibujo**: texto, líneas, recuadros, elipses, triángulos, flechas, estrellas, tablas, imágenes
  y códigos QR.
- **Exportación verificada**: lo que se ve en el lienzo es lo que sale en el PDF, comprobado con
  arneses automáticos y no solo a ojo (ver [Verificar cambios](#verificar-cambios)).
- **Escritorio**: se empaqueta con [Tauri](https://tauri.app/) para Windows sin backend propio —
  la misma app web, instalada.

Lo que falta y lo que sigue está en [ROADMAP.md](ROADMAP.md).

## Instalación y uso

Requiere [Node.js](https://nodejs.org/) 20 o más nuevo.

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. Todo corre del lado del cliente (WebAssembly en el navegador) — no
hace falta ningún servidor propio.

### Build de producción (web)

```bash
npm run build
```

### App de escritorio (Windows, con Tauri)

```bash
npm run escritorio        # levanta la app en una ventana nativa, para probar
npm run escritorio-build  # genera los instaladores (.exe NSIS y .msi) en src-tauri/target/
```

El instalador no está firmado, así que Windows SmartScreen va a advertir la primera vez que se
ejecuta ("Windows protegió su PC" → "Más información" → "Ejecutar de todas formas").

## Verificar cambios

El proyecto se apoya en arneses headless (Node + Vite, sin navegador) en vez de solo probar a
mano. Corren un caso real, lo comparan contra lo esperado y fallan con el detalle exacto de qué no
coincidió:

```bash
npx tsc --noEmit          # chequeo de tipos — correr siempre antes de un commit
npm run verificar-export  # el PDF exportado coincide con lo que dibuja el lienzo (pixel a pixel)
npm run verificar-pdf     # borrar texto de un PDF real no deja nada tapado debajo
npm run verificar-campos  # los campos de un formulario real vuelven idénticos tras exportar
npm run verificar-hojas   # documentos de varias hojas: ninguna se mezcla ni se pierde al deshacer
npm run verificar-formas  # detectar y sacar las formas e imágenes del contenido de un PDF, sin
                          # llevarse por delante el texto ni lo de alrededor
npm run verificar-apilado # el orden real del lienzo: que las capas manden y nadie cruce de capa
npm run verificar-objetos # redimensionar deja el modelo y el objeto del lienzo de acuerdo
npm run medir-rendimiento # cuánto tarda el lienzo con 50, 200, 500 y 1000 elementos
```

Antes de un PR, correr al menos `npx tsc --noEmit` y `npm run verificar-export`; si el cambio
toca el exportador, campos AcroForm, hojas, formas, capas o los objetos del lienzo, correr también
el arnés específico.

Los arneses arman sus propios PDF, así que prueban la lógica pero no el mundo: los PDF reales traen
cosas que uno no inventaría (matrices con ruido de redondeo, imágenes espejadas, transparencias en
una máscara aparte). **Si el cambio toca la lectura de PDF ajenos, probalo también con archivos de
verdad.** Para eso está:

```bash
npm run inspeccionar -- "C:/ruta/al/archivo.pdf"
```

que lista, página por página, qué formas e imágenes detectaría el editor y en qué posición.

## Stack

| Pieza | Qué hace |
|---|---|
| [Fabric.js](http://fabricjs.com/) v7 | Superficie de edición interactiva (el lienzo y sus objetos) |
| [pdf.js](https://github.com/mozilla/pdf.js) | Dibuja la página del PDF abierto para verla de fondo mientras se edita |
| [mupdf](https://github.com/ArtifexSoftware/mupdf.js) | Lee y edita el contenido real de un PDF existente |
| [@cantoo/pdf-lib](https://github.com/Hopding/pdf-lib) | Genera el PDF final: dibujo, AcroForm, fuentes incrustadas |
| [qrcode](https://github.com/soldair/node-qrcode) | Generación de QR |
| [@fontsource/*](https://fontsource.org/) | Familias tipográficas OFL, cargadas on-demand |
| [Vite](https://vite.dev/) + TypeScript | Build |
| [Tauri](https://tauri.app/) | Empaquetado de escritorio, sobre el mismo frontend web |

## Estado

**Versión 1.0.0.** Están las cuatro fases: editar el texto, las formas y las imágenes de un PDF
que ya existe, formularios AcroForm, multipágina, capas, campo de firma, y la aplicación de
escritorio para Windows. Ver [ROADMAP.md](ROADMAP.md) para el detalle fase por fase.

Lo único pendiente es la firma del instalador, que evita el cartel de SmartScreen: la solicitud
está enviada a la SignPath Foundation, que da firma gratis a proyectos open source.

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Licencia

[AGPL-3.0](LICENSE) — heredada de `mupdf`. Cualquiera que reciba este software, compilado o no,
tiene derecho a pedir el código fuente completo correspondiente a esa versión.
