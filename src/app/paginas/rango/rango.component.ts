import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EscaleraRangosComponent } from '../../compartido/escalera-rangos.component';
import { mensajeDe, pesoEnRango } from '../../compartido/validadores';
import { FuerzaService } from '../../nucleo/fuerza.service';
import { HistorialService } from '../../nucleo/historial.service';
import { Clasificacion, EJERCICIOS, Ejercicio, NOMBRE_EJERCICIO, NOMBRE_RANGO, Rango, Sexo } from '../../nucleo/modelos';
import { LIMITES } from '../../nucleo/motor-fuerza';
import { PerfilAtletaService } from '../../nucleo/perfil-atleta.service';
import { UnidadesService } from '../../nucleo/unidades.service';

@Component({
  selector: 'app-rango',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, EscaleraRangosComponent],
  template: `
    <div class="pagina-cabecera">
      <h1>Mi rango</h1>
      <p>
        Tu 1RM comparado con tu peso corporal te ubica en una escalera de siete rangos, de Hierro a
        Obsidiana. También se calcula tu puntaje DOTS, que permite comparar atletas de distinto peso.
      </p>
    </div>

    <div class="rejilla-2">
      <form class="tarjeta" [formGroup]="form" (ngSubmit)="clasificar()" novalidate>
        <h2>Datos del atleta</h2>
        <div class="campo">
          <label for="ejercicio">Ejercicio</label>
          <select id="ejercicio" formControlName="ejercicio">
            @for (e of ejercicios; track e) {
              <option [value]="e">{{ nombre(e) }}</option>
            }
          </select>
        </div>
        <div class="campo">
          <span class="etiqueta">Sexo</span>
          <div class="opciones">
            <label><input type="radio" formControlName="sexo" value="MASCULINO"> Masculino</label>
            <label><input type="radio" formControlName="sexo" value="FEMENINO"> Femenino</label>
          </div>
          <span class="ayuda">Los umbrales femeninos son el 70 % de los masculinos.</span>
        </div>
        <div class="fila-campos">
          <div class="campo">
            <label for="pesoCorporal">Peso corporal ({{ unidades.unidad() }})</label>
            <input id="pesoCorporal" type="number" inputmode="decimal" step="any" formControlName="pesoCorporal"
                   [attr.aria-invalid]="form.controls.pesoCorporal.invalid && form.controls.pesoCorporal.touched ? 'true' : null">
            <span class="error-campo">{{ mensaje(form.controls.pesoCorporal, 'El peso corporal') }}</span>
          </div>
          <div class="campo">
            <label for="unoRM">1RM ({{ unidades.unidad() }})</label>
            <input id="unoRM" type="number" inputmode="decimal" step="any" formControlName="unoRM"
                   [attr.aria-invalid]="form.controls.unoRM.invalid && form.controls.unoRM.touched ? 'true' : null">
            <span class="error-campo">{{ mensaje(form.controls.unoRM, 'El 1RM') }}</span>
          </div>
        </div>
        <div class="acciones">
          <button type="submit" class="primario" [disabled]="calculando()">Calcular rango</button>
          @if (resultado()) {
            <button type="button" (click)="guardar()" [disabled]="guardado()">
              {{ guardado() ? 'Guardado en historial' : 'Guardar en historial' }}
            </button>
          }
        </div>
        <p class="detalle">¿No sabés tu 1RM? <a routerLink="/1rm">Estimalo desde una serie</a>.</p>
        @if (errorGeneral()) {
          <p class="mensaje error" role="alert">{{ errorGeneral() }}</p>
        }
      </form>

      <section class="tarjeta" aria-live="polite">
        <h2>Resultado</h2>
        @if (resultado(); as r) {
          <div class="cifras">
            <div class="cifra">
              <div class="valor" [class]="'valor rango-' + r.rango.toLowerCase()">
                <span class="marca-rango" aria-hidden="true"></span>{{ nombreRango(r.rango) }}
              </div>
              <div class="rotulo">Rango en {{ nombre(r.ejercicio) }}</div>
            </div>
            <div class="cifra">
              <div class="valor">{{ r.fuerzaRelativa }}×</div>
              <div class="rotulo">Fuerza relativa (1RM / peso corporal)</div>
            </div>
            <div class="cifra">
              <div class="valor">{{ r.dots }}</div>
              <div class="rotulo">Puntaje DOTS</div>
            </div>
          </div>

          @if (r.siguiente) {
            <p class="mensaje ok">
              Te faltan <strong class="num">{{ unidades.fmt(r.faltaKg) }}</strong> para {{ nombreRango(r.siguiente) }}
              (umbral: {{ unidades.fmt(r.umbralSiguienteKg) }}).
            </p>
          } @else {
            <p class="mensaje ok">Obsidiana es el techo de la escalera. No hay un rango siguiente.</p>
          }

          <h3>Escalera para tu peso corporal</h3>
          <app-escalera-rangos [escalera]="r.escalera" [actual]="r.rango" />
        } @else {
          <p class="detalle">Completá los datos y presioná Calcular rango. Por ejemplo, 100 kg de press de banca a 75 kg de peso corporal es Oro.</p>
        }
      </section>
    </div>
  `,
  styles: `
    .opciones { display: flex; gap: 1rem; }
    .opciones label { font-weight: 500; display: inline-flex; align-items: center; gap: 0.35rem; }
    h3 { margin-top: 1rem; }
  `,
})
export class RangoComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly fuerza = inject(FuerzaService);
  private readonly historial = inject(HistorialService);
  private readonly perfil = inject(PerfilAtletaService);
  readonly unidades = inject(UnidadesService);

  /** Llegan desde 1RM como ?unoRM=114.6&ejercicio=SENTADILLA (kilos). */
  readonly unoRM = input<string>();
  readonly ejercicio = input<string>();

  readonly ejercicios = EJERCICIOS;
  readonly resultado = signal<Clasificacion | null>(null);
  readonly calculando = signal(false);
  readonly guardado = signal(false);
  readonly errorGeneral = signal<string | null>(null);
  readonly mensaje = mensajeDe;

  readonly form = this.fb.nonNullable.group({
    ejercicio: this.fb.nonNullable.control<Ejercicio>(this.perfil.contexto().ejercicio ?? 'PRESS_BANCA'),
    sexo: this.fb.nonNullable.control<Sexo>(this.perfil.contexto().sexo ?? 'MASCULINO'),
    pesoCorporal: this.fb.control<number | null>(
      this.perfil.contexto().pesoCorporalKg ? Number(this.unidades.valor(this.perfil.contexto().pesoCorporalKg)) : null,
      [pesoEnRango(this.unidades, LIMITES.pesoCorporalMinKg, LIMITES.pesoCorporalMaxKg)],
    ),
    unoRM: this.fb.control<number | null>(
      this.perfil.contexto().unoRMKg ? Number(this.unidades.valor(this.perfil.contexto().unoRMKg)) : null,
      [pesoEnRango(this.unidades, LIMITES.pesoMinKg, LIMITES.pesoMaxKg)],
    ),
  });

  ngOnInit(): void {
    const kg = Number(this.unoRM());
    if (Number.isFinite(kg) && kg > 0) {
      this.form.controls.unoRM.setValue(Number(this.unidades.valor(kg)));
    }
    const ej = this.ejercicio();
    if (ej && (EJERCICIOS as readonly string[]).includes(ej)) {
      this.form.controls.ejercicio.setValue(ej as Ejercicio);
    }
  }

  nombre(e: Ejercicio): string {
    return NOMBRE_EJERCICIO[e];
  }

  nombreRango(r: Rango): string {
    return NOMBRE_RANGO[r];
  }

  async clasificar(): Promise<void> {
    this.form.markAllAsTouched();
    this.errorGeneral.set(null);
    if (this.form.invalid) return;
    const { ejercicio, sexo, pesoCorporal, unoRM } = this.form.getRawValue();
    this.calculando.set(true);
    try {
      const pesoCorporalKg = Math.round(this.unidades.aKg(Number(pesoCorporal)) * 100) / 100;
      const unoRMKg = Math.round(this.unidades.aKg(Number(unoRM)) * 100) / 100;
      const r = await this.fuerza.clasificar(ejercicio, sexo, pesoCorporalKg, unoRMKg);
      this.resultado.set(r);
      this.guardado.set(false);
      this.perfil.registrarClasificacion(r);
    } catch (e) {
      this.errorGeneral.set(e instanceof Error ? e.message : 'No se pudo calcular');
    } finally {
      this.calculando.set(false);
    }
  }

  guardar(): void {
    const r = this.resultado();
    if (!r) return;
    this.historial.registrarClasificacion(r);
    this.guardado.set(true);
  }
}
