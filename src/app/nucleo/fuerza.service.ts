import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, timeout } from 'rxjs';
import { ConfiguracionService } from './configuracion.service';
import { Clasificacion, Ejercicio, ErrorApi, EstadoApi, EstimacionUnoRM, FilaTabla, ResumenSesion, Serie, Sexo } from './modelos';
import * as motor from './motor-fuerza';

export type ModoCalculo = 'comprobando' | 'api' | 'local';

/**
 * Unico punto de la app que habla con el backend. Si el API esta en linea, los calculos
 * viajan por REST; si no, los hace el motor local con las mismas reglas. Los componentes
 * no saben cual de los dos respondio: solo ven el resultado y el indicador de modo.
 */
@Injectable({ providedIn: 'root' })
export class FuerzaService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfiguracionService);

  readonly modo = signal<ModoCalculo>('comprobando');
  readonly estadoApi = signal<EstadoApi | null>(null);
  readonly ultimoError = signal<string | null>(null);

  /** Pregunta al backend si esta vivo. Se llama al arrancar y desde Ajustes. */
  async verificarBackend(): Promise<boolean> {
    this.modo.set('comprobando');
    try {
      const estado = await firstValueFrom(
        this.http.get<EstadoApi>(`${this.config.apiBase()}/estado`).pipe(timeout(4000)),
      );
      this.estadoApi.set(estado);
      this.modo.set('api');
      this.ultimoError.set(null);
      return true;
    } catch (e) {
      this.estadoApi.set(null);
      this.modo.set('local');
      this.ultimoError.set(describirFallo(e));
      return false;
    }
  }

  estimarUnoRM(pesoKg: number, repeticiones: number): Promise<EstimacionUnoRM> {
    return this.ejecutar(
      () => this.http.post<EstimacionUnoRM>(`${this.config.apiBase()}/1rm`, { pesoKg, repeticiones }),
      () => motor.estimarUnoRM(pesoKg, repeticiones),
    );
  }

  tablaPorcentajes(unoRMKg: number, incrementoKg: number): Promise<FilaTabla[]> {
    return this.ejecutar(
      () =>
        this.http.get<FilaTabla[]>(`${this.config.apiBase()}/tabla`, {
          params: { unoRMKg: String(unoRMKg), incrementoKg: String(incrementoKg) },
        }),
      () => motor.tablaPorcentajes(unoRMKg, incrementoKg),
    );
  }

  resumirSesion(series: Serie[]): Promise<ResumenSesion> {
    return this.ejecutar(
      () => this.http.post<ResumenSesion>(`${this.config.apiBase()}/sesion`, { series }),
      () => motor.resumirSesion(series),
    );
  }

  clasificar(ejercicio: Ejercicio, sexo: Sexo, pesoCorporalKg: number, unoRMKg: number): Promise<Clasificacion> {
    return this.ejecutar(
      () =>
        this.http.post<Clasificacion>(`${this.config.apiBase()}/clasificacion`, {
          ejercicio,
          sexo,
          pesoCorporalKg,
          unoRMKg,
        }),
      () => motor.clasificar(ejercicio, sexo, pesoCorporalKg, unoRMKg),
    );
  }

  /**
   * Intenta por el API si esta en linea. Si el backend responde con un error de datos
   * (400 o 422) se muestra tal cual; si no responde, se pasa a modo local y se calcula ahi.
   */
  private async ejecutar<T>(porApi: () => Observable<T>, local: () => T): Promise<T> {
    if (this.modo() === 'api') {
      try {
        return await firstValueFrom(porApi().pipe(timeout(8000)));
      } catch (e) {
        if (e instanceof HttpErrorResponse && e.status > 0) {
          throw new Error(mensajeDeError(e));
        }
        this.modo.set('local');
        this.estadoApi.set(null);
        this.ultimoError.set(describirFallo(e));
      }
    }
    try {
      return local();
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'No se pudo calcular');
    }
  }
}

/** Traduce el ErrorResponse del backend a una linea legible. */
export function mensajeDeError(e: HttpErrorResponse): string {
  const cuerpo = e.error as Partial<ErrorApi> | null;
  if (cuerpo && typeof cuerpo === 'object' && cuerpo.mensaje) {
    const detalles = Array.isArray(cuerpo.detalles) && cuerpo.detalles.length ? ': ' + cuerpo.detalles.join('; ') : '';
    return cuerpo.mensaje + detalles;
  }
  return `El backend respondió con el estado ${e.status}`;
}

export function describirFallo(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    return e.status === 0 ? 'No se pudo conectar con el backend' : mensajeDeError(e);
  }
  if (e instanceof Error && e.name === 'TimeoutError') {
    return 'El backend no respondió a tiempo';
  }
  return e instanceof Error ? e.message : 'Error desconocido';
}
