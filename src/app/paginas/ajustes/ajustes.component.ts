import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CoachService } from '../../nucleo/coach.service';
import { BACKEND_POR_DEFECTO, ConfiguracionService, MODELO_POR_DEFECTO, Tema, Unidad } from '../../nucleo/configuracion.service';
import { FuerzaService } from '../../nucleo/fuerza.service';
import { HistorialService } from '../../nucleo/historial.service';
import { PerfilAtletaService } from '../../nucleo/perfil-atleta.service';

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="pagina-cabecera">
      <h1>Ajustes</h1>
      <p>Todo lo que configurás aquí se guarda solo en este navegador.</p>
    </div>

    <div class="rejilla">
      <section class="tarjeta">
        <h2>Backend</h2>
        <div class="campo">
          <label for="backend">Dirección del API (Spring Boot)</label>
          <input id="backend" type="url" [(ngModel)]="backendUrl" name="backend" placeholder="http://localhost:8080" spellcheck="false">
          <span class="ayuda">La app llama a <code>{{ backendUrl || porDefecto }}/api/v1/fuerza</code>. Si no responde, calcula en el navegador.</span>
        </div>
        <div class="acciones">
          <button type="button" class="primario" (click)="probarBackend()" [disabled]="probandoBackend()">Guardar y probar</button>
          <button type="button" (click)="backendUrl = porDefecto; probarBackend()">Restablecer</button>
        </div>
        @if (fuerza.modo() === 'api') {
          <p class="mensaje ok">Backend en línea: {{ fuerza.estadoApi()?.servicio }} {{ fuerza.estadoApi()?.version }}.
            Coach {{ fuerza.estadoApi()?.coachConfigurado ? 'con llave configurada' : 'sin llave configurada' }}.</p>
        } @else if (fuerza.modo() === 'local') {
          <p class="mensaje aviso">Sin backend ({{ fuerza.ultimoError() }}). Los cálculos se hacen en el navegador con las mismas reglas.</p>
        }
      </section>

      <section class="tarjeta">
        <h2>Coach sin backend</h2>
        <p class="detalle">
          Si no tenés el Spring Boot corriendo, podés pegar tu propia llave gratuita de
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>.
          Se guarda en este navegador y solo se envía a Google.
        </p>
        <div class="campo">
          <label for="llave">Llave de Gemini</label>
          <input id="llave" [type]="mostrarLlave() ? 'text' : 'password'" [(ngModel)]="llave" name="llave" autocomplete="off" spellcheck="false">
          <label class="detalle marcar"><input type="checkbox" [checked]="mostrarLlave()" (change)="mostrarLlave.set(!mostrarLlave())"> Mostrar llave</label>
        </div>
        <div class="campo">
          <label for="modelo">Modelo</label>
          <input id="modelo" type="text" [(ngModel)]="modelo" name="modelo" list="modelos" spellcheck="false">
          <datalist id="modelos">
            @for (m of modelosEncontrados(); track m) {
              <option [value]="m"></option>
            }
          </datalist>
          <span class="ayuda">Por defecto <code>{{ modeloPorDefecto }}</code>. Los nombres cambian con el tiempo; probá la llave para ver la lista.</span>
        </div>
        <div class="acciones">
          <button type="button" class="primario" (click)="guardarLlave()">Guardar</button>
          <button type="button" (click)="probarLlave()" [disabled]="!llave.trim() || probandoLlave()">Probar llave</button>
          <button type="button" class="peligro" (click)="borrarLlave()" [disabled]="!config.llaveGemini()">Borrar llave</button>
        </div>
        @if (mensajeLlave(); as m) {
          <p class="mensaje" [class.ok]="m.ok" [class.error]="!m.ok">{{ m.texto }}</p>
        }
      </section>

      <section class="tarjeta">
        <h2>Presentación</h2>
        <div class="campo">
          <span class="etiqueta">Unidad de peso</span>
          <div class="opciones">
            <label><input type="radio" name="unidad" value="kg" [checked]="config.unidad() === 'kg'" (change)="cambiarUnidad('kg')"> Kilogramos</label>
            <label><input type="radio" name="unidad" value="lb" [checked]="config.unidad() === 'lb'" (change)="cambiarUnidad('lb')"> Libras</label>
          </div>
          <span class="ayuda">Los cálculos siempre se hacen en kilos (1 lb = 0.45359237 kg).</span>
        </div>
        <div class="campo">
          <span class="etiqueta">Tema</span>
          <div class="opciones">
            <label><input type="radio" name="tema" value="sistema" [checked]="config.tema() === 'sistema'" (change)="cambiarTema('sistema')"> Sistema</label>
            <label><input type="radio" name="tema" value="claro" [checked]="config.tema() === 'claro'" (change)="cambiarTema('claro')"> Claro</label>
            <label><input type="radio" name="tema" value="oscuro" [checked]="config.tema() === 'oscuro'" (change)="cambiarTema('oscuro')"> Oscuro</label>
          </div>
        </div>
      </section>

      <section class="tarjeta">
        <h2>Datos locales</h2>
        <p class="detalle">Historial: {{ historial.entradas().length }} registros. Contexto del coach: {{ perfil.vacio() ? 'vacío' : 'con datos' }}.</p>
        <div class="acciones">
          <button type="button" (click)="perfil.limpiar()" [disabled]="perfil.vacio()">Limpiar contexto del coach</button>
          @if (confirmandoBorrado()) {
            <button type="button" class="peligro" (click)="borrarHistorial()">Confirmar borrado del historial</button>
            <button type="button" (click)="confirmandoBorrado.set(false)">Cancelar</button>
          } @else {
            <button type="button" (click)="confirmandoBorrado.set(true)" [disabled]="!historial.entradas().length">Borrar historial</button>
          }
        </div>
      </section>
    </div>
  `,
  styles: `
    .opciones { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; }
    .opciones label, .marcar { font-weight: 500; display: inline-flex; align-items: center; gap: 0.35rem; }
  `,
})
export class AjustesComponent {
  readonly config = inject(ConfiguracionService);
  readonly fuerza = inject(FuerzaService);
  readonly coach = inject(CoachService);
  readonly historial = inject(HistorialService);
  readonly perfil = inject(PerfilAtletaService);

  readonly porDefecto = BACKEND_POR_DEFECTO;
  readonly modeloPorDefecto = MODELO_POR_DEFECTO;

  backendUrl = this.config.backendUrl();
  llave = this.config.llaveGemini();
  modelo = this.config.modeloGemini();

  readonly probandoBackend = signal(false);
  readonly probandoLlave = signal(false);
  readonly mostrarLlave = signal(false);
  readonly mensajeLlave = signal<{ ok: boolean; texto: string } | null>(null);
  readonly modelosEncontrados = signal<string[]>([]);
  readonly confirmandoBorrado = signal(false);

  async probarBackend(): Promise<void> {
    const url = this.backendUrl.trim() || BACKEND_POR_DEFECTO;
    this.backendUrl = url;
    this.config.backendUrl.set(url);
    this.probandoBackend.set(true);
    try {
      await this.fuerza.verificarBackend();
      await this.coach.verificarBackend();
    } finally {
      this.probandoBackend.set(false);
    }
  }

  guardarLlave(): void {
    this.config.llaveGemini.set(this.llave.trim());
    this.config.modeloGemini.set(this.modelo.trim() || MODELO_POR_DEFECTO);
    this.modelo = this.config.modeloGemini();
    this.mensajeLlave.set({ ok: true, texto: this.llave.trim() ? 'Llave y modelo guardados en este navegador.' : 'Llave vacía: el coach usará solo el backend.' });
  }

  async probarLlave(): Promise<void> {
    this.probandoLlave.set(true);
    this.mensajeLlave.set(null);
    try {
      const modelos = await this.coach.modelosDisponibles(this.llave.trim());
      this.modelosEncontrados.set(modelos);
      const modeloActual = this.modelo.trim();
      const existe = modelos.includes(modeloActual);
      this.mensajeLlave.set({
        ok: existe,
        texto: existe
          ? `La llave funciona y acepta ${modelos.length} modelos, incluido ${modeloActual}.`
          : `La llave funciona, pero ${modeloActual} no está en la lista. Modelos disponibles: ${modelos.join(', ')}`,
      });
    } catch (e) {
      this.mensajeLlave.set({ ok: false, texto: e instanceof Error ? e.message : 'No se pudo probar la llave' });
    } finally {
      this.probandoLlave.set(false);
    }
  }

  borrarLlave(): void {
    this.llave = '';
    this.config.llaveGemini.set('');
    this.mensajeLlave.set({ ok: true, texto: 'Llave borrada de este navegador.' });
  }

  cambiarUnidad(u: Unidad): void {
    this.config.unidad.set(u);
  }

  cambiarTema(t: Tema): void {
    this.config.tema.set(t);
  }

  borrarHistorial(): void {
    this.historial.limpiar();
    this.confirmandoBorrado.set(false);
  }
}
