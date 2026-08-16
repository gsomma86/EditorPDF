# Contribuir a EditorPDF

Gracias por el interés. Este es un proyecto de una sola persona, así que la forma de colaborar
está pensada para que sea sostenible en ese contexto.

## Reportar un bug

Abrí un [issue](https://github.com/gsomma86/EditorPDF/issues/new) con:

- Qué esperabas que pasara y qué pasó en cambio.
- Pasos para reproducirlo.
- Si el bug aparece al exportar o al abrir un PDF, el archivo (o uno mínimo que lo reproduzca) —
  la mayoría de los bugs de este editor dependen del contenido real del PDF.

## Proponer una función

Abrí un issue **antes** de escribir código. Es la diferencia entre una charla de cinco minutos y un
PR que puede terminar rechazado por no encajar con el rumbo del proyecto — ver la sección
["Diseño acordado"](CLAUDE.md#diseño-acordado) y el ["Regla de alcance"](CLAUDE.md#regla-de-alcance-la-más-importante)
de CLAUDE.md para entender qué se está construyendo y por qué.

## Pull requests

**Los PR se aceptan después de haberlos charlado en un issue.** Uno que llegue sin ese paso previo
puede quedar esperando mucho tiempo o no fusionarse, no porque el código esté mal sino porque nadie
acordó de antemano que fuera el camino a tomar.

Una vez de acuerdo en el issue:

1. Corré `npx tsc --noEmit` y `npm run verificar-export` antes de abrir el PR — son la base mínima.
   Si el cambio toca el exportador, campos AcroForm, hojas o formas, corré también el arnés
   específico (ver la tabla en el [README](README.md#verificar-cambios)).
2. Un PR, un cambio. Si terminaste tocando algo no relacionado en el camino, es otro PR.
3. Describí el *por qué* en el mensaje del PR, no solo el *qué* — igual que se pide en los commits
   (ver más abajo).

## Convenciones del código

- **Todo en español**: nombres de variables, funciones, comentarios y mensajes de commit. Es una
  decisión de estilo del proyecto, no una limitación — se sostiene en todo el código existente.
- Comentarios solo donde el *por qué* no es obvio (una decisión, un workaround, un bug evitado). No
  comentar lo que el código ya dice.
- El modelo (`src/editor/elemento.ts`) es la fuente de verdad; los objetos de Fabric son su
  representación visual. Cualquier función nueva empieza por el modelo, no por el lienzo.
- Antes de tocar una pantalla existente o agregar una nueva, un mockup HTML rápido (mismo
  `style.css`, sin lógica) ahorra ida y vuelta comparado con iterar directamente en el código.
- Commits: el mensaje explica el *porqué*, no solo el *qué*. Si es un fix, la causa real del bug.

`CLAUDE.md` tiene el detalle completo de arquitectura, estructura de carpetas y lecciones
aprendidas de bugs ya resueltos — vale la pena leerlo antes de un cambio no trivial, así no se
repite un problema que ya se resolvió una vez.

## Qué no es un buen primer PR

Refactors grandes, cambios de UI sin un issue previo, o dependencias nuevas — para todo eso hace
falta la charla previa del punto anterior. Un bug puntual con reproducción clara sí es un buen
punto de entrada.
