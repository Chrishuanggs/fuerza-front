import { AfterViewInit, Component, ElementRef, OnDestroy, effect, inject, signal, viewChild } from '@angular/core';
import { CategoryScale, Chart, LineController, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js';
import { ConfiguracionService } from '../../nucleo/configuracion.service';
import { EntradaHistorial, HistorialService, NOMBRE_TIPO, PuntoProgreso } from '../../nucleo/historial.service';
import { EJERCICIOS, Ejercicio, NOMBRE_EJERCICIO, NOMBRE_RANGO } from '../../nucleo/modelos';
import { UnidadesService } from '../../nucleo/unidades.service';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip);

@Component({
  selector: 'app-historial',
  standalone: true,
  template: `
    <div class="pagina-cabecera">
      <h1>Historial</h1>
      <p>
        Todo lo que guardaste desde las pantallas de 1RM, Sesión y Rango. Se almacena solo en este navegador;
        podés exportarlo a CSV para abrirlo en Excel o borrarlo cuando querás.
      </p>
    </div>

    <section class="tarjeta">
      <div class="cabecera-seccion">
        <h2>Progreso del 1RM estimado</h2>
        <span class="detalle">{{ unidades.unidad() }} · un punto por cálculo guardado</span>
      </div>
      @if (progreso().length) {
        <div class="grafica">
          <canvas #lienzo role="img" aria-label="Evolución del 1RM estimado por ejercicio"></canvas>
        </div>
        <ul class="leyenda" aria-hidden="true">
          @for (e of ejerciciosConDatos(); track e; let i = $index) {
            <li><span class="muestra" [style.background]="colorDe(e)"></span>{{ nombre(e) }}</li>
          }
        </ul>
      } @else {
        <p class="detalle">Todavía no hay cálculos guardados con 1RM. Guardá una estimación, una sesión o un rango y aparecerán aquí.</p>
      }
    </section>

    <section class="tarjeta">
      <div class="cabecera-seccion">
        <h2>Registros ({{ entradas().length }})</h2>
        <div class="acciones">
          <button type="button" (click)="exportar()" [disabled]="!entradas().length">Exportar CSV</button>
          @if (confirmandoBorrado()) {
            <button type="button" class="peligro" (click)="borrarTodo()">Confirmar borrado</button>
            <button type="button" (click)="confirmandoBorrado.set(false)">Cancelar</button>
          } @else {
            <button type="button" (click)="confirmandoBorrado.set(true)" [disabled]="!entradas().length">Borrar todo</button>
          }
        </div>
      </div>
      @if (entradas().length) {
        <div class="tabla-envoltura">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Ejercicio</th>
                <th class="num">1RM</th>
                <th class="num">Tonelaje</th>
                <th>Detalle</th>
                <th><span class="oculto-visual">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (e of entradas(); track e.id) {
                <tr>
                  <td class="num fecha">{{ fecha(e.fecha) }}</td>
                  <td>{{ tipo(e) }}</td>
                  <td>{{ e.ejercicio ? nombre(e.ejercicio) : '' }}</td>
                  <td class="num">{{ unidades.valor(e.unoRMKg) }}</td>
                  <td class="num">{{ unidades.valor(e.tonelajeKg, 0) }}</td>
                  <td>
                    @if (e.rango) { <span [class]="'rango-' + e.rango.toLowerCase()"><span class="marca-rango" aria-hidden="true"></span>{{ nombreRango(e) }}</span> · }
                    {{ detalle(e) }}
                  </td>
                  <td><button type="button" class="pequeno" (click)="historial.eliminar(e.id)" [attr.aria-label]="'Eliminar registro del ' + e.fecha">Quitar</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="detalle">No hay registros.</p>
      }
    </section>
  `,
  styles: `
    .cabecera-seccion { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0.5rem 1rem; margin-bottom: 0.5rem; }
    .cabecera-seccion .acciones { margin-top: 0; }
    .grafica { position: relative; height: 300px; }
    .leyenda { list-style: none; display: flex; flex-wrap: wrap; gap: 0.4rem 1.2rem; margin: 0.6rem 0 0; padding: 0; font-size: 0.85rem; color: var(--texto-suave); }
    .muestra { display: inline-block; width: 0.8rem; height: 0.8rem; border-radius: 2px; margin-right: 0.4rem; vertical-align: -0.1em; }
    td.fecha { white-space: nowrap; }
  `,
})
export class HistorialComponent implements AfterViewInit, OnDestroy {
  readonly historial = inject(HistorialService);
  readonly unidades = inject(UnidadesService);
  private readonly config = inject(ConfiguracionService);

  readonly lienzo = viewChild<ElementRef<HTMLCanvasElement>>('lienzo');
  readonly entradas = this.historial.entradas;
  readonly progreso = this.historial.progreso;
  readonly confirmandoBorrado = signal(false);

  private grafica: Chart | null = null;
  private observadorTema: MediaQueryList | null = null;
  private readonly redibujar = () => this.dibujar();

  constructor() {
    // Se redibuja cuando cambian los datos, la unidad o el tema.
    effect(() => {
      this.progreso();
      this.config.unidad();
      this.config.tema();
      setTimeout(() => this.dibujar(), 0);
    });
  }

  ngAfterViewInit(): void {
    this.observadorTema = window.matchMedia('(prefers-color-scheme: dark)');
    this.observadorTema.addEventListener('change', this.redibujar);
    this.dibujar();
  }

  ngOnDestroy(): void {
    this.observadorTema?.removeEventListener('change', this.redibujar);
    this.grafica?.destroy();
    this.grafica = null;
  }

  ejerciciosConDatos(): Ejercicio[] {
    const presentes = new Set(this.progreso().map((p) => p.ejercicio));
    return EJERCICIOS.filter((e) => presentes.has(e));
  }

  colorDe(e: Ejercicio): string {
    const indice = EJERCICIOS.indexOf(e) + 1;
    return getComputedStyle(document.documentElement).getPropertyValue(`--serie-${indice}`).trim();
  }

  nombre(e: Ejercicio): string {
    return NOMBRE_EJERCICIO[e];
  }

  nombreRango(e: EntradaHistorial): string {
    return e.rango ? NOMBRE_RANGO[e.rango] : '';
  }

  tipo(e: EntradaHistorial): string {
    return NOMBRE_TIPO[e.tipo];
  }

  fecha(iso: string): string {
    return formatearFecha(iso);
  }

  /** Detalle en la unidad activa (el campo detalle de la entrada queda fijo en kilos para el CSV). */
  detalle(e: EntradaHistorial): string {
    switch (e.tipo) {
      case 'UNO_RM':
        return `${this.unidades.fmt(e.pesoKg)} × ${e.repeticiones}${e.confiable === false ? ' (poco confiable)' : ''}`;
      case 'RANGO':
        return `DOTS ${e.dots}${e.siguiente ? ` · faltan ${this.unidades.fmt(e.faltaKg)} para ${NOMBRE_RANGO[e.siguiente]}` : ' · techo de la escalera'}`;
      default:
        return e.detalle;
    }
  }

  exportar(): void {
    const blob = new Blob([this.historial.aCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `historial-fuerza-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }

  borrarTodo(): void {
    this.historial.limpiar();
    this.confirmandoBorrado.set(false);
  }

  private dibujar(): void {
    const canvas = this.lienzo()?.nativeElement;
    this.grafica?.destroy();
    this.grafica = null;
    if (!canvas) return;
    const puntos = this.progreso();
    if (!puntos.length) return;

    const estilos = getComputedStyle(document.documentElement);
    const textoSuave = estilos.getPropertyValue('--texto-suave').trim();
    const borde = estilos.getPropertyValue('--borde').trim();
    const superficie = estilos.getPropertyValue('--superficie').trim();
    const texto = estilos.getPropertyValue('--texto').trim();
    const unidad = this.unidades.unidad();

    // Eje X: fechas (categorias ordenadas) para que funcione sin adaptador de fechas.
    const fechas = Array.from(new Set(puntos.map((p) => p.fecha))).sort();
    const etiquetas = fechas.map((f) => formatearFecha(f));

    const datasets = this.ejerciciosConDatos().map((ejercicio) => {
      const porFecha = new Map<string, PuntoProgreso>();
      for (const p of puntos) if (p.ejercicio === ejercicio) porFecha.set(p.fecha, p);
      const color = this.colorDe(ejercicio);
      return {
        label: NOMBRE_EJERCICIO[ejercicio],
        data: fechas.map((f) => {
          const p = porFecha.get(f);
          return p ? Number(this.unidades.valor(p.unoRMKg)) : null;
        }),
        borderColor: color,
        backgroundColor: color,
        pointBackgroundColor: color,
        pointBorderColor: superficie,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
        spanGaps: true,
        tension: 0,
      };
    });

    this.grafica = new Chart(canvas, {
      type: 'line',
      data: { labels: etiquetas, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: superficie,
            titleColor: texto,
            bodyColor: texto,
            borderColor: borde,
            borderWidth: 1,
            callbacks: {
              label: (item) => `${item.dataset.label}: ${item.formattedValue} ${unidad}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: textoSuave, maxRotation: 0, autoSkip: true },
            grid: { display: false },
            border: { color: borde },
          },
          y: {
            title: { display: true, text: `1RM (${unidad})`, color: textoSuave },
            ticks: { color: textoSuave },
            grid: { color: borde },
            border: { display: false },
          },
        },
      },
    });
  }
}

function formatearFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
}
