import { AfterViewChecked, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CoachService } from '../../nucleo/coach.service';
import { describirContexto } from '../../nucleo/instruccion-coach';
import { MensajeChat } from '../../nucleo/modelos';
import { PerfilAtletaService } from '../../nucleo/perfil-atleta.service';

const MAX_MENSAJES = 30;
const MAX_CARACTERES = 2000;

@Component({
  selector: 'app-coach',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="pagina-cabecera">
      <h1>Coach</h1>
      <p>
        Un entrenador conversacional que conoce tus últimos cálculos. Responde sobre técnica, programación
        y cómo subir de rango; no da diagnósticos médicos ni dietas, y ante dolor te manda a un profesional.
      </p>
    </div>

    <div class="rejilla-2">
      <aside>
        <section class="tarjeta">
          <h2>Conexión</h2>
          @switch (coach.modo()) {
            @case ('backend') {
              <p class="estado ok">Por el backend Spring Boot</p>
              <p class="detalle">La llave de Gemini vive en el servidor. Modelo: <code>{{ coach.modelo() }}</code>.</p>
            }
            @case ('navegador') {
              <p class="estado aviso">Directo desde el navegador</p>
              <p class="detalle">
                Se usa la llave guardada en este navegador. Modelo: <code>{{ coach.modelo() }}</code>.
                Para pasar por el backend, levantá el Spring Boot con su llave.
              </p>
            }
            @default {
              <p class="estado error">Sin configurar</p>
              <p class="detalle">
                No hay backend con llave ni llave en el navegador. Pegá una llave gratuita de Google AI Studio
                en <a routerLink="/ajustes">Ajustes</a> o levantá el backend con la llave en
                <code>application-secrets.properties</code>.
              </p>
            }
          }
        </section>

        <section class="tarjeta">
          <h2>Contexto que se envía</h2>
          @if (perfil.vacio()) {
            <p class="detalle">Todavía no hay cálculos. El coach pedirá tus datos en vez de inventarlos.</p>
          } @else {
            <pre class="contexto">{{ contextoTexto() }}</pre>
            <button type="button" class="pequeno" (click)="perfil.limpiar()">Limpiar contexto</button>
          }
        </section>
      </aside>

      <section class="tarjeta chat">
        <h2 class="oculto-visual">Conversación</h2>
        <div class="hilo" #hilo aria-live="polite">
          @if (!mensajes().length) {
            <p class="detalle vacio">
              Ejemplos: «¿Cómo subo de Oro a Platino en press de banca?», «Armame una semana con la tabla
              de porcentajes», «¿Cuántas series de sentadilla hago por semana?»
            </p>
          }
          @for (m of mensajes(); track $index) {
            <div class="burbuja" [class.usuario]="m.rol === 'USUARIO'" [class.coach]="m.rol === 'COACH'">
              <span class="quien">{{ m.rol === 'USUARIO' ? 'Vos' : 'Coach' }}</span>
              <div class="texto">{{ m.contenido }}</div>
            </div>
          }
          @if (esperando()) {
            <div class="burbuja coach"><span class="quien">Coach</span><div class="texto detalle">Escribiendo</div></div>
          }
        </div>
        @if (error()) {
          <p class="mensaje error" role="alert">{{ error() }}</p>
        }
        @if (coach.modo() !== 'ninguno') {
          <form class="entrada" (ngSubmit)="enviar()">
            <label for="mensaje" class="oculto-visual">Mensaje para el coach</label>
            <textarea id="mensaje" name="mensaje" rows="2" [(ngModel)]="borrador" (keydown.enter)="enterEnvia($event)"
                      [maxlength]="maxCaracteres" placeholder="Escribí tu pregunta. Enter envía, Shift+Enter hace salto de línea."
                      [disabled]="esperando()"></textarea>
            <div class="acciones">
              <button type="submit" class="primario" [disabled]="esperando() || !borrador.trim()">Enviar</button>
              <button type="button" (click)="reiniciar()" [disabled]="!mensajes().length || esperando()">Nueva conversación</button>
              <span class="detalle num">{{ borrador.length }}/{{ maxCaracteres }}</span>
            </div>
          </form>
        }
      </section>
    </div>
  `,
  styles: `
    .contexto { font-family: var(--mono); font-size: 0.8rem; white-space: pre-wrap; background: var(--superficie-2); padding: 0.6rem; border-radius: var(--radio); margin: 0 0 0.6rem; }
    .chat { display: flex; flex-direction: column; min-height: 460px; }
    .hilo { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.6rem; padding: 0.25rem 0; max-height: 60vh; }
    .vacio { margin: auto 0; }
    .burbuja { max-width: 85%; border-radius: var(--radio); padding: 0.5rem 0.7rem; border: 1px solid var(--borde); }
    .burbuja.usuario { align-self: flex-end; background: var(--superficie-2); }
    .burbuja.coach { align-self: flex-start; background: var(--superficie); }
    .quien { display: block; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--texto-suave); margin-bottom: 0.15rem; }
    .texto { white-space: pre-wrap; overflow-wrap: anywhere; }
    .entrada { margin-top: 0.75rem; border-top: 1px solid var(--borde); padding-top: 0.75rem; }
    textarea { resize: vertical; }
  `,
})
export class CoachComponent implements AfterViewChecked {
  readonly coach = inject(CoachService);
  readonly perfil = inject(PerfilAtletaService);

  readonly hilo = viewChild<ElementRef<HTMLDivElement>>('hilo');
  readonly mensajes = signal<MensajeChat[]>([]);
  readonly esperando = signal(false);
  readonly error = signal<string | null>(null);
  readonly maxCaracteres = MAX_CARACTERES;
  borrador = '';
  private desplazarAlFinal = false;

  contextoTexto(): string {
    return describirContexto(this.perfil.contexto());
  }

  enterEnvia(evento: Event): void {
    const e = evento as KeyboardEvent;
    if (e.shiftKey) return;
    e.preventDefault();
    void this.enviar();
  }

  async enviar(): Promise<void> {
    const contenido = this.borrador.trim();
    if (!contenido || this.esperando()) return;
    if (this.mensajes().length >= MAX_MENSAJES - 1) {
      this.error.set('La conversación llegó al máximo de mensajes. Empezá una nueva.');
      return;
    }
    this.error.set(null);
    const conversacion = [...this.mensajes(), { rol: 'USUARIO' as const, contenido }];
    this.mensajes.set(conversacion);
    this.borrador = '';
    this.esperando.set(true);
    this.desplazarAlFinal = true;
    try {
      const r = await this.coach.responder(conversacion, this.perfil.contexto());
      this.mensajes.update((m) => [...m, { rol: 'COACH', contenido: r.respuesta }]);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo obtener respuesta');
      // Se quita el mensaje que no obtuvo respuesta para que el usuario lo reintente.
      this.mensajes.update((m) => m.slice(0, -1));
      this.borrador = contenido;
    } finally {
      this.esperando.set(false);
      this.desplazarAlFinal = true;
    }
  }

  reiniciar(): void {
    this.mensajes.set([]);
    this.error.set(null);
    this.borrador = '';
  }

  ngAfterViewChecked(): void {
    if (this.desplazarAlFinal) {
      const el = this.hilo()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
      this.desplazarAlFinal = false;
    }
  }
}
