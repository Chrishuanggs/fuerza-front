import { Injectable, effect, signal } from '@angular/core';

export type Unidad = 'kg' | 'lb';
export type Tema = 'sistema' | 'claro' | 'oscuro';

export const BACKEND_POR_DEFECTO = 'http://localhost:8080';
export const MODELO_POR_DEFECTO = 'gemini-3.5-flash-lite';

const PREFIJO = 'fuerza.';

/**
 * Preferencias del usuario. Todo vive en localStorage del navegador: nada sale de la
 * maquina del usuario salvo lo que el mismo envia al backend o a Gemini.
 */
@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  readonly backendUrl = signal(leer('backendUrl', BACKEND_POR_DEFECTO));
  readonly llaveGemini = signal(leer('llaveGemini', ''));
  readonly modeloGemini = signal(leer('modeloGemini', MODELO_POR_DEFECTO));
  readonly unidad = signal<Unidad>(leer('unidad', 'kg') === 'lb' ? 'lb' : 'kg');
  readonly tema = signal<Tema>(comoTema(leer('tema', 'sistema')));

  constructor() {
    effect(() => guardar('backendUrl', this.backendUrl()));
    effect(() => guardar('llaveGemini', this.llaveGemini()));
    effect(() => guardar('modeloGemini', this.modeloGemini()));
    effect(() => guardar('unidad', this.unidad()));
    effect(() => {
      guardar('tema', this.tema());
      aplicarTema(this.tema());
    });
  }

  /** URL base del API sin barra final. */
  apiBase(): string {
    return this.backendUrl().replace(/\/+$/, '') + '/api/v1/fuerza';
  }
}

function comoTema(valor: string): Tema {
  return valor === 'claro' || valor === 'oscuro' ? valor : 'sistema';
}

function leer(clave: string, porDefecto: string): string {
  try {
    const valor = localStorage.getItem(PREFIJO + clave);
    return valor === null ? porDefecto : valor;
  } catch {
    return porDefecto;
  }
}

function guardar(clave: string, valor: string): void {
  try {
    localStorage.setItem(PREFIJO + clave, valor);
  } catch {
    // Sin almacenamiento (modo privado estricto): la app sigue funcionando en memoria.
  }
}

function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  if (tema === 'sistema') {
    raiz.removeAttribute('data-tema');
  } else {
    raiz.setAttribute('data-tema', tema);
  }
}
