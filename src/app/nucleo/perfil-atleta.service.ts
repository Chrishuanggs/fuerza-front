import { Injectable, computed, effect, signal } from '@angular/core';
import { Clasificacion, ContextoAtleta, Ejercicio, EstimacionUnoRM, ResumenSesion } from './modelos';

const CLAVE = 'fuerza.perfil';

const VACIO: ContextoAtleta = {
  ejercicio: null,
  sexo: null,
  pesoCorporalKg: null,
  unoRMKg: null,
  rango: null,
  siguiente: null,
  faltaKg: null,
  tonelajeUltimaSesionKg: null,
  seriesUltimaSesion: null,
};

/**
 * Lo ultimo que la app calculo. Las pantallas de 1RM, Sesion y Rango escriben aqui y el
 * coach lo lee para no responder a ciegas.
 */
@Injectable({ providedIn: 'root' })
export class PerfilAtletaService {
  readonly contexto = signal<ContextoAtleta>(cargar());
  readonly vacio = computed(() => {
    const c = this.contexto();
    return c.ejercicio === null && c.unoRMKg === null && c.rango === null && c.tonelajeUltimaSesionKg === null;
  });

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(CLAVE, JSON.stringify(this.contexto()));
      } catch {
        // Sin almacenamiento: se mantiene solo en memoria.
      }
    });
  }

  registrarUnoRM(ejercicio: Ejercicio, e: EstimacionUnoRM): void {
    this.contexto.update((c) => ({
      ...c,
      ejercicio,
      unoRMKg: e.promedioKg,
      // El rango anterior era de otro calculo; se limpia para no mezclar datos.
      rango: c.ejercicio === ejercicio ? c.rango : null,
      siguiente: c.ejercicio === ejercicio ? c.siguiente : null,
      faltaKg: c.ejercicio === ejercicio ? c.faltaKg : null,
    }));
  }

  registrarClasificacion(c: Clasificacion): void {
    this.contexto.update((actual) => ({
      ...actual,
      ejercicio: c.ejercicio,
      sexo: c.sexo,
      pesoCorporalKg: c.pesoCorporalKg,
      unoRMKg: c.unoRMKg,
      rango: c.rango,
      siguiente: c.siguiente,
      faltaKg: c.faltaKg,
    }));
  }

  registrarSesion(r: ResumenSesion): void {
    this.contexto.update((c) => ({
      ...c,
      tonelajeUltimaSesionKg: r.tonelajeKg,
      seriesUltimaSesion: r.totalSeries,
    }));
  }

  limpiar(): void {
    this.contexto.set({ ...VACIO });
  }
}

function cargar(): ContextoAtleta {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (!guardado) return { ...VACIO };
    return { ...VACIO, ...JSON.parse(guardado) };
  } catch {
    return { ...VACIO };
  }
}
