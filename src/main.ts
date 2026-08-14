import './style.css';
import { montarEspacioTrabajo } from './ui/shell';
import { crearLienzo } from './editor/lienzo';
import { crearElemento, type ClaseDibujo } from './editor/elemento';
import { agregarAlLienzo } from './editor/objetosFabric';
import { mostrarPropiedades, mostrarSinSeleccion } from './ui/panelPropiedades';

const raiz = document.querySelector<HTMLDivElement>('#app')!;
const espacio = montarEspacioTrabajo(raiz);
const lienzo = crearLienzo(espacio.lienzoCont);

lienzo.on('selection:created', (e) => {
  const objeto = e.selected?.[0];
  if (objeto) mostrarPropiedades(espacio.panelPropiedades, lienzo, objeto);
});
lienzo.on('selection:updated', (e) => {
  const objeto = e.selected?.[0];
  if (objeto) mostrarPropiedades(espacio.panelPropiedades, lienzo, objeto);
});
lienzo.on('selection:cleared', () => {
  mostrarSinSeleccion(espacio.panelPropiedades);
});

espacio.menubar.querySelectorAll<HTMLElement>('[data-dib]').forEach((boton) => {
  boton.addEventListener('click', async () => {
    const clase = boton.dataset.dib;
    if (clase !== 'texto' && clase !== 'linea' && clase !== 'rect' && clase !== 'qr') return; // tabla/imagen: todavía no implementados
    const elemento = crearElemento(clase satisfies ClaseDibujo);
    await agregarAlLienzo(lienzo, elemento);
  });
});
