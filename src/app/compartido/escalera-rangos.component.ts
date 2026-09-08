import { Component, inject, input } from '@angular/core';
import { NOMBRE_RANGO, Rango, Umbral } from '../nucleo/modelos';
import { UnidadesService } from '../nucleo/unidades.service';

/** La escalera completa de rangos con los kilos que exige cada uno para este atleta. */
@Component({
  selector: 'app-escalera-rangos',
  standalone: true,
  template: `
    <ol class="escalera">
      @for (u of escalera(); track u.rango) {
        <li [class.alcanzado]="u.alcanzado" [class.actual]="u.rango === actual()" [class]="'rango-' + u.rango.toLowerCase()">
          <span class="marca-rango" aria-hidden="true"></span>
          <span class="nombre">{{ nombre(u.rango) }}</span>
          <span class="kg num">{{ unidades.fmt(u.kg) }}</span>
          <span class="etiqueta">
            @if (u.rango === actual()) { actual } @else if (u.alcanzado) { alcanzado } @else { pendiente }
          </span>
        </li>
      }
    </ol>
  `,
  styles: `
    .escalera { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.25rem; }
    li { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 0.6rem; padding: 0.45rem 0.6rem; border: 1px solid var(--borde); border-radius: var(--radio); }
    li .nombre { font-weight: 600; color: var(--texto); }
    li .kg { color: var(--texto); }
    li .etiqueta { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--texto-suave); min-width: 5.5em; text-align: right; }
    li.alcanzado { background: var(--superficie-2); }
    li.actual { border-color: currentColor; }
    li:not(.alcanzado) .nombre, li:not(.alcanzado) .kg { color: var(--texto-suave); }
  `,
})
export class EscaleraRangosComponent {
  readonly unidades = inject(UnidadesService);
  readonly escalera = input.required<Umbral[]>();
  readonly actual = input.required<Rango>();

  nombre(r: Rango): string {
    return NOMBRE_RANGO[r];
  }
}
