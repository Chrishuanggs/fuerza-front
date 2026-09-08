import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { mensajeDe, pesoEnRango } from '../../compartido/validadores';
import { FuerzaService } from '../../nucleo/fuerza.service';
import { FilaTabla } from '../../nucleo/modelos';
import { LIMITES } from '../../nucleo/motor-fuerza';
import { PerfilAtletaService } from '../../nucleo/perfil-atleta.service';
import { KG_POR_LB, UnidadesService } from '../../nucleo/unidades.service';

/** Incrementos exactos en binario: el redondeo al disco coincide con el del backend. */
const INCREMENTOS_KG = [0.5, 1, 1.25, 2, 2.5, 5];
const INCREMENTOS_LB = [1, 2.5, 5, 10];

@Component({
  selector: 'app-tabla',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="pagina-cabecera">
      <h1>Tabla de porcentajes</h1>
      <p>
        Cargas de trabajo del 100 % al 50 % de tu 1RM, redondeadas hacia abajo al disco más pequeño que
        tengás disponible, con las repeticiones que normalmente se pueden hacer a cada porcentaje.
      </p>
    </div>

    <div class="rejilla-2">
      <form class="tarjeta" [formGroup]="form" (ngSubmit)="calcular()" novalidate>
        <h2>Referencia</h2>
        <div class="campo">
          <label for="unoRM">1RM ({{ unidades.unidad() }})</label>
          <input id="unoRM" type="number" inputmode="decimal" step="any" formControlName="unoRM"
                 [attr.aria-invalid]="form.controls.unoRM.invalid && form.controls.unoRM.touched ? 'true' : null">
          <span class="error-campo">{{ mensaje(form.controls.unoRM, 'El 1RM') }}</span>
        </div>
        <div class="campo">
          <label for="incremento">Disco más pequeño ({{ unidades.unidad() }})</label>
          <select id="incremento" formControlName="incremento">
            @for (i of incrementos(); track i) {
              <option [value]="i">{{ i }}</option>
            }
          </select>
          <span class="ayuda">El salto mínimo que podés cargar en la barra (dos discos de 1.25 kg son 2.5 kg).</span>
        </div>
        <div class="acciones">
          <button type="submit" class="primario" [disabled]="calculando()">Calcular tabla</button>
        </div>
        @if (errorGeneral()) {
          <p class="mensaje error" role="alert">{{ errorGeneral() }}</p>
        }
      </form>

      <section class="tarjeta" aria-live="polite">
        <h2>Cargas de trabajo</h2>
        @if (filas().length) {
          <div class="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th class="num">%</th>
                  <th class="num">Exacto</th>
                  <th class="num">En barra</th>
                  <th class="num">Reps</th>
                  <th>Objetivo</th>
                </tr>
              </thead>
              <tbody>
                @for (f of filas(); track f.porcentaje) {
                  <tr [class.destacada]="f.porcentaje === 100">
                    <td class="num">{{ f.porcentaje }}</td>
                    <td class="num">{{ unidades.valor(f.pesoExactoKg) }}</td>
                    <td class="num">{{ unidades.valor(f.pesoRedondeadoKg, decimalesBarra()) }}</td>
                    <td class="num">{{ f.repeticionesEstimadas }}</td>
                    <td>{{ f.objetivo }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="detalle">Pesos en {{ unidades.unidad() }}. Las repeticiones son una guía (inversa de Brzycki), no una meta.</p>
        } @else {
          <p class="detalle">Ingresá tu 1RM y presioná Calcular tabla.</p>
        }
      </section>
    </div>
  `,
})
export class TablaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly fuerza = inject(FuerzaService);
  private readonly perfil = inject(PerfilAtletaService);
  readonly unidades = inject(UnidadesService);

  /** Llega desde la pantalla de 1RM como ?unoRM=114.6 (siempre en kilos). */
  readonly unoRM = input<string>();

  readonly filas = signal<FilaTabla[]>([]);
  readonly calculando = signal(false);
  readonly errorGeneral = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    unoRM: this.fb.control<number | null>(null, [pesoEnRango(this.unidades, LIMITES.pesoMinKg, LIMITES.pesoMaxKg)]),
    incremento: this.fb.nonNullable.control<number>(this.unidades.unidad() === 'lb' ? 5 : 2.5),
  });

  incrementos(): number[] {
    return this.unidades.unidad() === 'lb' ? INCREMENTOS_LB : INCREMENTOS_KG;
  }

  decimalesBarra(): number {
    return this.unidades.unidad() === 'lb' ? 1 : 2;
  }

  mensaje = mensajeDe;

  ngOnInit(): void {
    const desdeUrl = Number(this.unoRM());
    const kg = Number.isFinite(desdeUrl) && desdeUrl > 0 ? desdeUrl : this.perfil.contexto().unoRMKg;
    if (kg) {
      this.form.controls.unoRM.setValue(Number(this.unidades.valor(kg)));
      void this.calcular();
    }
  }

  async calcular(): Promise<void> {
    this.form.markAllAsTouched();
    this.errorGeneral.set(null);
    if (this.form.invalid) return;
    const { unoRM, incremento } = this.form.getRawValue();
    this.calculando.set(true);
    try {
      const unoRMKg = Math.round(this.unidades.aKg(Number(unoRM)) * 100) / 100;
      // El incremento se manda en kilos; en libras se convierte exacto (1 lb = 0.45359237 kg).
      const incrementoKg = this.unidades.unidad() === 'lb' ? Number(incremento) * KG_POR_LB : Number(incremento);
      this.filas.set(await this.fuerza.tablaPorcentajes(unoRMKg, incrementoKg));
    } catch (e) {
      this.errorGeneral.set(e instanceof Error ? e.message : 'No se pudo calcular');
    } finally {
      this.calculando.set(false);
    }
  }
}
