import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { mensajeDe, enteroEnRango, pesoEnRango } from '../../compartido/validadores';
import { FuerzaService } from '../../nucleo/fuerza.service';
import { HistorialService } from '../../nucleo/historial.service';
import { EJERCICIOS, Ejercicio, NOMBRE_EJERCICIO, ResumenSesion, Serie } from '../../nucleo/modelos';
import { LIMITES } from '../../nucleo/motor-fuerza';
import { PerfilAtletaService } from '../../nucleo/perfil-atleta.service';
import { UnidadesService } from '../../nucleo/unidades.service';

type GrupoSerie = FormGroup<{
  ejercicio: FormControl<Ejercicio>;
  peso: FormControl<number | null>;
  repeticiones: FormControl<number | null>;
}>;

@Component({
  selector: 'app-sesion',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="pagina-cabecera">
      <h1>Registrar una sesión</h1>
      <p>
        Anotá cada serie de trabajo. La app calcula el tonelaje (peso × repeticiones), el desglose por
        ejercicio y la intensidad promedio respecto al mejor 1RM estimado de cada ejercicio.
      </p>
    </div>

    <div class="rejilla-2">
      <form class="tarjeta" [formGroup]="form" (ngSubmit)="calcular()" novalidate>
        <h2>Series</h2>
        <div formArrayName="series" class="series">
          @for (grupo of series.controls; track grupo; let i = $index) {
            <fieldset [formGroupName]="i" class="serie">
              <legend class="oculto-visual">Serie {{ i + 1 }}</legend>
              <span class="indice num">{{ i + 1 }}</span>
              <div class="campo">
                <label [for]="'ej' + i">Ejercicio</label>
                <select [id]="'ej' + i" formControlName="ejercicio">
                  @for (e of ejercicios; track e) {
                    <option [value]="e">{{ nombre(e) }}</option>
                  }
                </select>
              </div>
              <div class="campo">
                <label [for]="'peso' + i">Peso ({{ unidades.unidad() }})</label>
                <input [id]="'peso' + i" type="number" inputmode="decimal" step="any" formControlName="peso"
                       [attr.aria-invalid]="grupo.controls.peso.invalid && grupo.controls.peso.touched ? 'true' : null">
                <span class="error-campo">{{ mensaje(grupo.controls.peso, 'El peso') }}</span>
              </div>
              <div class="campo">
                <label [for]="'reps' + i">Reps</label>
                <input [id]="'reps' + i" type="number" inputmode="numeric" step="1" formControlName="repeticiones"
                       [attr.aria-invalid]="grupo.controls.repeticiones.invalid && grupo.controls.repeticiones.touched ? 'true' : null">
                <span class="error-campo">{{ mensaje(grupo.controls.repeticiones, 'Las reps') }}</span>
              </div>
              <button type="button" class="pequeno quitar" (click)="quitar(i)" [disabled]="series.length === 1"
                      [attr.aria-label]="'Quitar serie ' + (i + 1)">Quitar</button>
            </fieldset>
          }
        </div>
        <div class="acciones">
          <button type="button" (click)="agregar()">Agregar serie</button>
          <button type="button" (click)="repetirUltima()">Repetir la última</button>
          <button type="submit" class="primario" [disabled]="calculando()">Calcular sesión</button>
          @if (resultado()) {
            <button type="button" (click)="guardar()" [disabled]="guardado()">
              {{ guardado() ? 'Guardada en historial' : 'Guardar en historial' }}
            </button>
          }
        </div>
        @if (errorGeneral()) {
          <p class="mensaje error" role="alert">{{ errorGeneral() }}</p>
        }
      </form>

      <section class="tarjeta" aria-live="polite">
        <h2>Resumen</h2>
        @if (resultado(); as r) {
          <div class="cifras">
            <div class="cifra">
              <div class="valor">{{ unidades.valor(r.tonelajeKg, 0) }}</div>
              <div class="rotulo">Tonelaje ({{ unidades.unidad() }})</div>
            </div>
            <div class="cifra">
              <div class="valor">{{ r.totalSeries }} / {{ r.totalRepeticiones }}</div>
              <div class="rotulo">Series / repeticiones</div>
            </div>
            <div class="cifra">
              <div class="valor">{{ r.intensidadPromedio }} %</div>
              <div class="rotulo">Intensidad promedio</div>
            </div>
          </div>
          <div class="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th>Ejercicio</th>
                  <th class="num">Series</th>
                  <th class="num">Reps</th>
                  <th class="num">Tonelaje</th>
                  <th class="num">Mejor 1RM est.</th>
                </tr>
              </thead>
              <tbody>
                @for (p of r.porEjercicio; track p.ejercicio) {
                  <tr>
                    <td>{{ p.nombre }}</td>
                    <td class="num">{{ p.series }}</td>
                    <td class="num">{{ p.repeticiones }}</td>
                    <td class="num">{{ unidades.valor(p.tonelajeKg, 0) }}</td>
                    <td class="num">{{ unidades.valor(p.mejorUnoRMKg) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="detalle">
            La intensidad de cada serie es su peso dividido entre el mejor 1RM estimado de ese ejercicio en la sesión.
          </p>
        } @else {
          <p class="detalle">Agregá las series y presioná Calcular sesión.</p>
        }
      </section>
    </div>
  `,
  styles: `
    .series { display: grid; gap: 0.5rem; }
    .serie { border: 1px solid var(--borde); border-radius: var(--radio); padding: 0.5rem 0.6rem 0; margin: 0; display: grid; grid-template-columns: 1.5rem 1fr; gap: 0 0.6rem; align-items: start; }
    .serie .indice { color: var(--texto-suave); font-size: 0.8rem; padding-top: 1.9rem; }
    .serie .campo { grid-column: 2; margin-bottom: 0.5rem; }
    .serie .quitar { grid-column: 2; justify-self: end; margin-bottom: 0.5rem; }
    @media (min-width: 560px) {
      .serie { grid-template-columns: 1.5rem 1.6fr 1fr 0.8fr auto; }
      .serie .campo { grid-column: auto; }
      .serie .quitar { grid-column: auto; margin-top: 1.55rem; }
    }
  `,
})
export class SesionComponent {
  private readonly fb = inject(FormBuilder);
  private readonly fuerza = inject(FuerzaService);
  private readonly historial = inject(HistorialService);
  private readonly perfil = inject(PerfilAtletaService);
  readonly unidades = inject(UnidadesService);

  readonly ejercicios = EJERCICIOS;
  readonly resultado = signal<ResumenSesion | null>(null);
  readonly calculando = signal(false);
  readonly guardado = signal(false);
  readonly errorGeneral = signal<string | null>(null);
  readonly mensaje = mensajeDe;

  readonly form = this.fb.nonNullable.group({
    series: this.fb.array<GrupoSerie>([
      this.nuevaSerie('SENTADILLA', this.unidades.sugerido(100), 5),
      this.nuevaSerie('SENTADILLA', this.unidades.sugerido(100), 5),
      this.nuevaSerie('PRESS_BANCA', this.unidades.sugerido(80), 8),
    ]),
  });

  get series(): FormArray<GrupoSerie> {
    return this.form.controls.series;
  }

  nombre(e: Ejercicio): string {
    return NOMBRE_EJERCICIO[e];
  }

  agregar(): void {
    this.series.push(this.nuevaSerie(this.perfil.contexto().ejercicio ?? 'SENTADILLA', null, null));
  }

  repetirUltima(): void {
    const ultima = this.series.at(this.series.length - 1).getRawValue();
    this.series.push(this.nuevaSerie(ultima.ejercicio, ultima.peso, ultima.repeticiones));
  }

  quitar(i: number): void {
    if (this.series.length > 1) this.series.removeAt(i);
  }

  async calcular(): Promise<void> {
    this.form.markAllAsTouched();
    this.errorGeneral.set(null);
    if (this.form.invalid) return;
    const series: Serie[] = this.series.getRawValue().map((s) => ({
      ejercicio: s.ejercicio,
      pesoKg: Math.round(this.unidades.aKg(Number(s.peso)) * 100) / 100,
      repeticiones: Number(s.repeticiones),
    }));
    this.calculando.set(true);
    try {
      const r = await this.fuerza.resumirSesion(series);
      this.resultado.set(r);
      this.guardado.set(false);
      this.perfil.registrarSesion(r);
    } catch (e) {
      this.errorGeneral.set(e instanceof Error ? e.message : 'No se pudo calcular');
    } finally {
      this.calculando.set(false);
    }
  }

  guardar(): void {
    const r = this.resultado();
    if (!r) return;
    this.historial.registrarSesion(r);
    this.guardado.set(true);
  }

  private nuevaSerie(ejercicio: Ejercicio, peso: number | null, reps: number | null): GrupoSerie {
    return this.fb.group({
      ejercicio: this.fb.nonNullable.control<Ejercicio>(ejercicio),
      peso: this.fb.control<number | null>(peso, [pesoEnRango(this.unidades, LIMITES.pesoMinKg, LIMITES.pesoMaxKg)]),
      repeticiones: this.fb.control<number | null>(reps, [enteroEnRango(LIMITES.repsMin, LIMITES.repsMax)]),
    });
  }
}
