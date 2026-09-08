import { Injectable, computed, effect, signal } from '@angular/core';
import { Clasificacion, Ejercicio, EstimacionUnoRM, NOMBRE_EJERCICIO, NOMBRE_RANGO, Rango, ResumenSesion } from './modelos';

export type TipoEntrada = 'UNO_RM' | 'SESION' | 'RANGO';

export interface EntradaHistorial {
  id: string;
  fecha: string;
  tipo: TipoEntrada;
  ejercicio: Ejercicio | null;
  pesoKg: number | null;
  repeticiones: number | null;
  unoRMKg: number | null;
  tonelajeKg: number | null;
  rango: Rango | null;
  siguiente: Rango | null;
  faltaKg: number | null;
  dots: number | null;
  confiable: boolean | null;
  /** Texto fijo en kilos, pensado para el CSV. La tabla en pantalla se arma con la unidad activa. */
  detalle: string;
  /** Solo para sesiones: mejor 1RM por ejercicio, para la grafica de progreso. */
  porEjercicio: { ejercicio: Ejercicio; unoRMKg: number }[];
}

export interface PuntoProgreso {
  fecha: string;
  ejercicio: Ejercicio;
  unoRMKg: number;
}

const CLAVE = 'fuerza.historial';
const MAXIMO = 500;

export const NOMBRE_TIPO: Record<TipoEntrada, string> = {
  UNO_RM: '1RM',
  SESION: 'Sesión',
  RANGO: 'Rango',
};

/** Historial local de calculos. Vive en localStorage; nunca sale del navegador. */
@Injectable({ providedIn: 'root' })
export class HistorialService {
  readonly entradas = signal<EntradaHistorial[]>(cargar());

  /** Puntos de 1RM por ejercicio en orden cronologico, para la grafica. */
  readonly progreso = computed<PuntoProgreso[]>(() => {
    const puntos: PuntoProgreso[] = [];
    for (const e of this.entradas()) {
      if (e.tipo === 'SESION') {
        for (const p of e.porEjercicio) puntos.push({ fecha: e.fecha, ejercicio: p.ejercicio, unoRMKg: p.unoRMKg });
      } else if (e.ejercicio && e.unoRMKg !== null) {
        puntos.push({ fecha: e.fecha, ejercicio: e.ejercicio, unoRMKg: e.unoRMKg });
      }
    }
    return puntos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  });

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(CLAVE, JSON.stringify(this.entradas()));
      } catch {
        // Sin almacenamiento: el historial vive solo en memoria.
      }
    });
  }

  registrarUnoRM(ejercicio: Ejercicio, e: EstimacionUnoRM): void {
    this.agregar({
      tipo: 'UNO_RM',
      ejercicio,
      pesoKg: e.pesoKg,
      repeticiones: e.repeticiones,
      unoRMKg: e.promedioKg,
      tonelajeKg: null,
      rango: null,
      siguiente: null,
      faltaKg: null,
      dots: null,
      confiable: e.confiable,
      detalle: `${e.pesoKg} kg × ${e.repeticiones}${e.confiable ? '' : ' (poco confiable)'}`,
      porEjercicio: [],
    });
  }

  registrarSesion(r: ResumenSesion): void {
    this.agregar({
      tipo: 'SESION',
      ejercicio: null,
      pesoKg: null,
      repeticiones: r.totalRepeticiones,
      unoRMKg: null,
      tonelajeKg: r.tonelajeKg,
      rango: null,
      siguiente: null,
      faltaKg: null,
      dots: null,
      confiable: null,
      detalle: r.porEjercicio.map((p) => `${p.nombre} ${p.series}×`).join(', '),
      porEjercicio: r.porEjercicio.map((p) => ({ ejercicio: p.ejercicio, unoRMKg: p.mejorUnoRMKg })),
    });
  }

  registrarClasificacion(c: Clasificacion): void {
    this.agregar({
      tipo: 'RANGO',
      ejercicio: c.ejercicio,
      pesoKg: null,
      repeticiones: null,
      unoRMKg: c.unoRMKg,
      tonelajeKg: null,
      rango: c.rango,
      siguiente: c.siguiente,
      faltaKg: c.faltaKg,
      dots: c.dots,
      confiable: null,
      detalle: `DOTS ${c.dots}${c.siguiente ? ` · faltan ${c.faltaKg} kg para ${NOMBRE_RANGO[c.siguiente]}` : ' · techo de la escalera'}`,
      porEjercicio: [],
    });
  }

  eliminar(id: string): void {
    this.entradas.update((lista) => lista.filter((e) => e.id !== id));
  }

  limpiar(): void {
    this.entradas.set([]);
  }

  /** CSV con BOM para que Excel lo abra con acentos correctos. Separador coma, decimales con punto. */
  aCsv(): string {
    const cabecera = ['fecha', 'tipo', 'ejercicio', 'peso_kg', 'repeticiones', 'unoRM_kg', 'tonelaje_kg', 'rango', 'detalle'];
    const filas = this.entradas().map((e) => [
      e.fecha,
      NOMBRE_TIPO[e.tipo],
      e.ejercicio ? NOMBRE_EJERCICIO[e.ejercicio] : '',
      e.pesoKg ?? '',
      e.repeticiones ?? '',
      e.unoRMKg ?? '',
      e.tonelajeKg ?? '',
      e.rango ? NOMBRE_RANGO[e.rango] : '',
      e.detalle,
    ]);
    const escapar = (v: unknown) => {
      const texto = String(v);
      return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
    };
    return '\uFEFF' + [cabecera, ...filas].map((f) => f.map(escapar).join(',')).join('\r\n');
  }

  private agregar(datos: Omit<EntradaHistorial, 'id' | 'fecha'>): void {
    const entrada: EntradaHistorial = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      fecha: new Date().toISOString(),
      ...datos,
    };
    this.entradas.update((lista) => [entrada, ...lista].slice(0, MAXIMO));
  }
}

function cargar(): EntradaHistorial[] {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (!guardado) return [];
    const lista = JSON.parse(guardado);
    if (!Array.isArray(lista)) return [];
    // Entradas guardadas por versiones anteriores pueden no traer los campos nuevos.
    return lista.map((e) => ({ siguiente: null, faltaKg: null, dots: null, confiable: null, porEjercicio: [], ...e }));
  } catch {
    return [];
  }
}
