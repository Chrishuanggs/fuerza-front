import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { ConfiguracionService } from './configuracion.service';
import { FuerzaService, mensajeDeError } from './fuerza.service';
import { instruccionCompleta } from './instruccion-coach';
import { ContextoAtleta, EstadoCoach, MensajeChat, RespuestaCoach } from './modelos';

export type ModoCoach = 'backend' | 'navegador' | 'ninguno';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * El coach tiene dos caminos. Con el backend en linea y con llave, la peticion va a Spring
 * Boot y la llave nunca sale del servidor. Sin backend, el usuario puede pegar su propia
 * llave en Ajustes: se guarda solo en su navegador y el front llama a Gemini directo.
 */
@Injectable({ providedIn: 'root' })
export class CoachService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfiguracionService);
  private readonly fuerza = inject(FuerzaService);

  readonly estadoBackend = signal<EstadoCoach | null>(null);

  readonly modo = computed<ModoCoach>(() => {
    if (this.fuerza.modo() === 'api' && this.estadoBackend()?.configurado) return 'backend';
    if (this.config.llaveGemini().trim()) return 'navegador';
    return 'ninguno';
  });

  readonly modelo = computed(() =>
    this.modo() === 'backend' ? (this.estadoBackend()?.modelo ?? '') : this.config.modeloGemini(),
  );

  async verificarBackend(): Promise<void> {
    if (this.fuerza.modo() !== 'api') {
      this.estadoBackend.set(null);
      return;
    }
    try {
      const estado = await firstValueFrom(
        this.http.get<EstadoCoach>(`${this.config.apiBase()}/coach/estado`).pipe(timeout(4000)),
      );
      this.estadoBackend.set(estado);
    } catch {
      this.estadoBackend.set(null);
    }
  }

  async responder(mensajes: MensajeChat[], contexto: ContextoAtleta): Promise<RespuestaCoach> {
    const modo = this.modo();
    if (modo === 'backend') return this.porBackend(mensajes, contexto);
    if (modo === 'navegador') return this.porNavegador(mensajes, contexto);
    throw new Error('El coach no está configurado');
  }

  private async porBackend(mensajes: MensajeChat[], contexto: ContextoAtleta): Promise<RespuestaCoach> {
    try {
      return await firstValueFrom(
        this.http
          .post<RespuestaCoach>(`${this.config.apiBase()}/coach`, { mensajes, contexto })
          .pipe(timeout(45000)),
      );
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status > 0) throw new Error(mensajeDeError(e));
      if (e instanceof Error && e.name === 'TimeoutError') throw new Error('El coach tardó demasiado en responder');
      throw new Error('No se pudo conectar con el backend');
    }
  }

  private async porNavegador(mensajes: MensajeChat[], contexto: ContextoAtleta): Promise<RespuestaCoach> {
    const modelo = this.config.modeloGemini().trim();
    const cuerpo = {
      system_instruction: { parts: [{ text: instruccionCompleta(contexto) }] },
      contents: mensajes.map((m) => ({
        role: m.rol === 'USUARIO' ? 'user' : 'model',
        parts: [{ text: m.contenido.trim() }],
      })),
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    };
    const respuesta = await this.llamarGemini(`${GEMINI_BASE}/models/${modelo}:generateContent`, {
      method: 'POST',
      body: JSON.stringify(cuerpo),
    });
    const candidatos = respuesta['candidates'] as { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[] | undefined;
    if (!candidatos || candidatos.length === 0) {
      const motivo = (respuesta['promptFeedback'] as { blockReason?: string } | undefined)?.blockReason;
      throw new Error(motivo ? `Gemini bloqueó la respuesta (${motivo})` : 'Gemini no devolvió ninguna respuesta');
    }
    const texto = (candidatos[0].content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!texto) {
      throw new Error(`Gemini devolvió una respuesta vacía${candidatos[0].finishReason ? ` (${candidatos[0].finishReason})` : ''}`);
    }
    return { respuesta: texto, modelo };
  }

  /** Lista los modelos que aceptan generateContent con la llave dada. Sirve para probar la llave en Ajustes. */
  async modelosDisponibles(llave: string): Promise<string[]> {
    const respuesta = await this.llamarGemini(`${GEMINI_BASE}/models?pageSize=100`, { method: 'GET' }, llave);
    const modelos = (respuesta['models'] as { name: string; supportedGenerationMethods?: string[] }[] | undefined) ?? [];
    return modelos
      .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m) => m.name.replace('models/', ''));
  }

  private async llamarGemini(url: string, init: RequestInit, llave = this.config.llaveGemini()): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': llave.trim() },
      });
    } catch {
      throw new Error('No se pudo contactar a Gemini. Revisá tu conexión');
    }
    let cuerpo: Record<string, unknown> = {};
    try {
      cuerpo = (await res.json()) as Record<string, unknown>;
    } catch {
      // Cuerpo vacio o no JSON; se reporta por estado.
    }
    if (!res.ok) {
      const detalle = (cuerpo['error'] as { message?: string } | undefined)?.message ?? '';
      throw new Error(describirErrorGemini(res.status, detalle, this.config.modeloGemini()));
    }
    return cuerpo;
  }
}

export function describirErrorGemini(estado: number, detalle: string, modelo: string): string {
  let base: string;
  switch (estado) {
    case 400:
      base = 'Gemini rechazó la petición';
      break;
    case 401:
    case 403:
      base = 'La llave de Gemini no es válida o no tiene permiso';
      break;
    case 404:
      base = `El modelo '${modelo}' no existe para esta llave. Probá la llave en Ajustes para ver la lista`;
      break;
    case 429:
      base = 'Se agotó la cuota gratuita de Gemini por ahora. Esperá un momento y volvé a intentar';
      break;
    case 503:
      base = 'Gemini está saturado en este momento. Volvé a intentar en unos segundos';
      break;
    default:
      base = `Gemini respondió con el estado ${estado}`;
  }
  return detalle ? `${base} (${detalle})` : base;
}
