import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { mensajeDe, enteroEnRango, pesoEnRango } from '../../compartido/validadores';
import { FuerzaService } from '../../nucleo/fuerza.service';
import { HistorialService } from '../../nucleo/historial.service';
import { EJERCICIOS, Ejercicio, EstimacionUnoRM, NOMBRE_EJERCICIO } from '../../nucleo/modelos';
import { LIMITES } from '../../nucleo/motor-fuerza';
import { PerfilAtletaService } from '../../nucleo/perfil-atleta.service';
import { UnidadesService } from '../../nucleo/unidades.service';

@Component({
  selector: 'app-uno-rm',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="pagina-cabecera">
      <h1>Estimar 1RM</h1>
      <p>
        Tomá una serie que hayas hecho hasta cerca del fallo (peso y repeticiones) y la app estima tu máximo
        para una repetición con cinco fórmulas distintas. Sobre 12 repeticiones la estimación pierde precisión.
      </p>
    </div>

    <div class="rejilla-2">
      <form class="tarjeta" [formGroup]="form" (ngSubmit)="estimar()" novalidate>
        <h2>Serie de referencia</h2>

        <div class="campo">
          <label for="ejercicio">Ejercicio</label>
          <select id="ejercicio" formControlName="ejercicio">
            @for (e of ejercicios; track e) {
              <option [value]="e">{{ nombre(e) }}</option>
            }
          </select>
        </div>

        <div class="fila-campos">
          <div class="campo">
            <label for="peso">Peso ({{ unidades.unidad() }})</label>
            <input id="peso" type="number" inputmode="decimal" step="any" formControlName="peso"
                   [attr.aria-invalid]="form.controls.peso.invalid && form.controls.peso.touched ? 'true' : null">
            <span class="error-campo">{{ error('peso', 'El peso') }}</span>
          </div>
          <div class="campo">
            <label for="reps">Repeticiones</label>
            <input id="reps" type="number" inputmode="numeric" step="1" formControlName="repeticiones"
                   [attr.aria-invalid]="form.controls.repeticiones.invalid && form.controls.repeticiones.touched ? 'true' : null">
            <span class="error-campo">{{ error('repeticiones', 'Las repeticiones') }}</span>
          </div>
        </div>

        <div class="acciones">
          <button type="submit" class="primario" [disabled]="calculando()">
            {{ calculando() ? 'Calculando' : 'Estimar 1RM' }}
          </button>
          @if (resultado()) {
            <button type="button" (click)="guardar()" [disabled]="guardado()">
              {{ guardado() ? 'Guardado en historial' : 'Guardar en historial' }}
            </button>
          }
        </div>

        @if (errorGeneral()) {
          <p class="mensaje error" role="alert">{{ errorGeneral() }}</p>
        }
      </form>

      <section class="tarjeta" aria-live="polite">
        <h2>Resultado</h2>
        @if (resultado(); as r) {
          <div class="cifras">
            <div class="cifra">
              <div class="valor">{{ unidades.fmt(r.promedioKg) }}</div>
              <div class="rotulo">1RM estimado (promedio de 5 fórmulas)</div>
            </div>
            <div class="cifra">
              <div class="valor">{{ unidades.valor(r.minimoKg) }} a {{ unidades.valor(r.maximoKg) }}</div>
              <div class="rotulo">Rango entre fórmulas ({{ unidades.unidad() }})</div>
            </div>
          </div>

          @if (!r.confiable) {
            <p class="mensaje aviso">
              Con {{ r.repeticiones }} repeticiones la estimación es poco confiable. Para un número más
              preciso usá una serie de 12 repeticiones o menos.
            </p>
          }

          <div class="tabla-envoltura">
            <table>
              <thead>
                <tr><th>Fórmula</th><th class="num">1RM ({{ unidades.unidad() }})</th></tr>
              </thead>
              <tbody>
                @for (f of r.porFormula; track f.formula) {
                  <tr><td>{{ f.nombre }}</td><td class="num">{{ unidades.valor(f.unoRMKg) }}</td></tr>
                }
              </tbody>
            </table>
          </div>

          <p class="acciones">
            <a class="boton" [routerLink]="['/tabla']" [queryParams]="{ unoRM: r.promedioKg }">Ver tabla de porcentajes con este 1RM</a>
            <a class="boton" [routerLink]="['/rango']" [queryParams]="{ unoRM: r.promedioKg, ejercicio: form.controls.ejercicio.value }">Ver mi rango</a>
          </p>
        } @else {
          <p class="detalle">Ingresá una serie y presioná Estimar 1RM. Por ejemplo, 100 kg × 5 repeticiones da 114.6 kg.</p>
        }
      </section>
    </div>
  `,
})
export class UnoRMComponent {
  private readonly fb = inject(FormBuilder);
  private readonly fuerza = inject(FuerzaService);
  private readonly historial = inject(HistorialService);
  private readonly perfil = inject(PerfilAtletaService);
  readonly unidades = inject(UnidadesService);

  readonly ejercicios = EJERCICIOS;
  readonly resultado = signal<EstimacionUnoRM | null>(null);
  readonly calculando = signal(false);
  readonly guardado = signal(false);
  readonly errorGeneral = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    ejercicio: this.fb.nonNullable.control<Ejercicio>(this.perfil.contexto().ejercicio ?? 'SENTADILLA'),
    peso: this.fb.control<number | null>(this.unidades.sugerido(100), [pesoEnRango(this.unidades, LIMITES.pesoMinKg, LIMITES.pesoMaxKg)]),
    repeticiones: this.fb.control<number | null>(5, [enteroEnRango(LIMITES.repsMin, LIMITES.repsMax)]),
  });

  nombre(e: Ejercicio): string {
    return NOMBRE_EJERCICIO[e];
  }

  error(campo: 'peso' | 'repeticiones', nombre: string): string {
    return mensajeDe(this.form.get(campo), nombre);
  }

  async estimar(): Promise<void> {
    this.form.markAllAsTouched();
    this.errorGeneral.set(null);
    if (this.form.invalid) return;
    const { ejercicio, peso, repeticiones } = this.form.getRawValue();
    this.calculando.set(true);
    try {
      const pesoKg = Math.round(this.unidades.aKg(Number(peso)) * 100) / 100;
      const r = await this.fuerza.estimarUnoRM(pesoKg, Number(repeticiones));
      this.resultado.set(r);
      this.guardado.set(false);
      this.perfil.registrarUnoRM(ejercicio, r);
    } catch (e) {
      this.errorGeneral.set(e instanceof Error ? e.message : 'No se pudo calcular');
    } finally {
      this.calculando.set(false);
    }
  }

  guardar(): void {
    const r = this.resultado();
    if (!r) return;
    this.historial.registrarUnoRM(this.form.controls.ejercicio.value, r);
    this.guardado.set(true);
  }
}
