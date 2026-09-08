/**
 * Motor de calculo local. Es el espejo exacto de FuerzaServiceImpl en fuerza-api, para
 * que la app publicada en GitHub Pages funcione aunque el backend no este disponible.
 * Si se cambia una regla aqui, hay que cambiarla tambien en Java (y viceversa).
 */
import {
  Clasificacion,
  Ejercicio,
  EstimacionUnoRM,
  FilaTabla,
  FormulaUnoRM,
  NOMBRE_EJERCICIO,
  NOMBRE_RANGO,
  Rango,
  RANGOS,
  ResumenSesion,
  Serie,
  Sexo,
  Umbral,
  VolumenEjercicio,
} from './modelos';

export const LIMITES = {
  pesoMinKg: 1,
  pesoMaxKg: 600,
  repsMin: 1,
  repsMax: 30,
  repsConfiables: 12,
  pesoCorporalMinKg: 30,
  pesoCorporalMaxKg: 250,
  incrementoMinKg: 0.25,
  incrementoMaxKg: 10,
  incrementoDefaultKg: 2.5,
} as const;

/** Multiplos del peso corporal para Bronce, Plata, Oro, Platino, Diamante y Obsidiana. */
const MULTIPLOS: Record<Ejercicio, readonly number[]> = {
  SENTADILLA: [0.75, 1.25, 1.75, 2.25, 2.6, 3.0],
  PRESS_BANCA: [0.5, 0.75, 1.1, 1.45, 1.75, 2.0],
  PESO_MUERTO: [1.0, 1.5, 2.0, 2.5, 3.0, 3.5],
  PRESS_MILITAR: [0.35, 0.55, 0.75, 0.95, 1.15, 1.4],
};

const FACTOR_SEXO: Record<Sexo, number> = { MASCULINO: 1.0, FEMENINO: 0.7 };

const DOTS_MASCULINO = [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093];
const DOTS_FEMENINO = [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];

const TOLERANCIA = 1e-9;

export class ReglaDominioError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ReglaDominioError';
  }
}

export const FORMULAS: { formula: FormulaUnoRM; nombre: string; calcular: (peso: number, reps: number) => number }[] = [
  { formula: 'EPLEY', nombre: 'Epley', calcular: (w, r) => w * (1 + r / 30) },
  { formula: 'BRZYCKI', nombre: 'Brzycki', calcular: (w, r) => (w * 36) / (37 - r) },
  { formula: 'LOMBARDI', nombre: 'Lombardi', calcular: (w, r) => w * Math.pow(r, 0.1) },
  { formula: 'LANDER', nombre: 'Lander', calcular: (w, r) => (100 * w) / (101.3 - 2.67123 * r) },
  { formula: 'OCONNER', nombre: "O'Conner", calcular: (w, r) => w * (1 + r / 40) },
];

/**
 * Descompone la representacion decimal mas corta de un numero (la misma que usa
 * BigDecimal.valueOf en Java) en signo, parte entera y parte fraccionaria.
 */
function partesDecimales(valor: number): { negativo: boolean; entero: string; fraccion: string } | null {
  const texto = String(valor);
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(texto);
  if (!m) return null;
  return { negativo: m[1] === '-', entero: m[2], fraccion: m[3] ?? '' };
}

/** Redondeo HALF_UP a n decimales sobre la representacion decimal, igual que BigDecimal en Java. */
export function redondear(valor: number, decimales: number): number {
  const partes = partesDecimales(valor);
  if (!partes) {
    const factor = Math.pow(10, decimales);
    return Math.round(valor * factor) / factor;
  }
  if (partes.fraccion.length <= decimales) return valor;
  const conservada = partes.fraccion.slice(0, decimales);
  let unidades = BigInt(partes.entero + conservada);
  if (Number(partes.fraccion[decimales]) >= 5) unidades += 1n;
  const resultado = Number(unidades) / Math.pow(10, decimales);
  return partes.negativo ? -resultado : resultado;
}

export function unDecimal(valor: number): number {
  return redondear(valor, 1);
}

/** Redondea hacia abajo al multiplo del incremento, sobre la representacion decimal (como en Java). */
export function haciaAbajoAlDisco(valorKg: number, incrementoKg: number): number {
  const v = partesDecimales(valorKg);
  const i = partesDecimales(incrementoKg);
  if (!v || !i || v.negativo || i.negativo) {
    return Math.floor(valorKg / incrementoKg) * incrementoKg;
  }
  const escala = Math.max(v.fraccion.length, i.fraccion.length);
  const valor = BigInt(v.entero + v.fraccion.padEnd(escala, '0'));
  const incremento = BigInt(i.entero + i.fraccion.padEnd(escala, '0'));
  const pasos = valor / incremento;
  return Number(pasos) * incrementoKg;
}

export function validarPeso(pesoKg: number): void {
  if (!Number.isFinite(pesoKg) || pesoKg < LIMITES.pesoMinKg || pesoKg > LIMITES.pesoMaxKg) {
    throw new ReglaDominioError(`El peso debe estar entre ${LIMITES.pesoMinKg} y ${LIMITES.pesoMaxKg} kg`);
  }
}

export function validarRepeticiones(reps: number): void {
  if (!Number.isInteger(reps) || reps < LIMITES.repsMin || reps > LIMITES.repsMax) {
    throw new ReglaDominioError(`Las repeticiones deben estar entre ${LIMITES.repsMin} y ${LIMITES.repsMax}`);
  }
}

export function validarPesoCorporal(pesoCorporalKg: number): void {
  if (!Number.isFinite(pesoCorporalKg) || pesoCorporalKg < LIMITES.pesoCorporalMinKg || pesoCorporalKg > LIMITES.pesoCorporalMaxKg) {
    throw new ReglaDominioError(
      `El peso corporal debe estar entre ${LIMITES.pesoCorporalMinKg} y ${LIMITES.pesoCorporalMaxKg} kg`,
    );
  }
}

function estimarFormula(calcular: (w: number, r: number) => number, pesoKg: number, reps: number): number {
  return reps === 1 ? pesoKg : calcular(pesoKg, reps);
}

function promedioUnoRM(pesoKg: number, reps: number): number {
  let suma = 0;
  for (const f of FORMULAS) {
    suma += estimarFormula(f.calcular, pesoKg, reps);
  }
  return suma / FORMULAS.length;
}

export function estimarUnoRM(pesoKg: number, repeticiones: number): EstimacionUnoRM {
  validarPeso(pesoKg);
  validarRepeticiones(repeticiones);
  const porFormula = [];
  let suma = 0;
  let minimo = Number.POSITIVE_INFINITY;
  let maximo = Number.NEGATIVE_INFINITY;
  for (const f of FORMULAS) {
    const valor = estimarFormula(f.calcular, pesoKg, repeticiones);
    suma += valor;
    minimo = Math.min(minimo, valor);
    maximo = Math.max(maximo, valor);
    porFormula.push({ formula: f.formula, nombre: f.nombre, unoRMKg: unDecimal(valor) });
  }
  return {
    pesoKg,
    repeticiones,
    porFormula,
    promedioKg: unDecimal(suma / FORMULAS.length),
    minimoKg: unDecimal(minimo),
    maximoKg: unDecimal(maximo),
    confiable: repeticiones <= LIMITES.repsConfiables,
  };
}

export function repeticionesEstimadas(porcentaje: number): number {
  const reps = 37 - (36 * porcentaje) / 100;
  return Math.max(1, Math.floor(reps + TOLERANCIA));
}

export function objetivo(porcentaje: number): string {
  if (porcentaje >= 90) return 'Fuerza máxima';
  if (porcentaje >= 80) return 'Fuerza';
  if (porcentaje >= 70) return 'Hipertrofia';
  if (porcentaje >= 60) return 'Técnica y volumen';
  return 'Calentamiento y resistencia';
}

export function tablaPorcentajes(unoRMKg: number, incrementoKg: number): FilaTabla[] {
  validarPeso(unoRMKg);
  if (!Number.isFinite(incrementoKg) || incrementoKg < LIMITES.incrementoMinKg || incrementoKg > LIMITES.incrementoMaxKg) {
    throw new ReglaDominioError(`El incremento debe estar entre ${LIMITES.incrementoMinKg} y ${LIMITES.incrementoMaxKg} kg`);
  }
  const filas: FilaTabla[] = [];
  for (let porcentaje = 100; porcentaje >= 50; porcentaje -= 5) {
    const exacto = (unoRMKg * porcentaje) / 100;
    filas.push({
      porcentaje,
      pesoExactoKg: unDecimal(exacto),
      pesoRedondeadoKg: haciaAbajoAlDisco(exacto, incrementoKg),
      repeticionesEstimadas: repeticionesEstimadas(porcentaje),
      objetivo: objetivo(porcentaje),
    });
  }
  return filas;
}

export function validarSerie(serie: Serie): void {
  if (!serie.ejercicio) {
    throw new ReglaDominioError('La serie debe indicar un ejercicio');
  }
  validarPeso(serie.pesoKg);
  validarRepeticiones(serie.repeticiones);
}

export function resumirSesion(series: Serie[]): ResumenSesion {
  if (!series || series.length === 0) {
    throw new ReglaDominioError('La sesión debe tener al menos una serie');
  }
  series.forEach(validarSerie);

  // Se agrupa en el orden del enum, igual que el EnumMap de Java.
  const agrupadas = new Map<Ejercicio, Serie[]>();
  for (const ejercicio of Object.keys(MULTIPLOS) as Ejercicio[]) {
    const delEjercicio = series.filter((s) => s.ejercicio === ejercicio);
    if (delEjercicio.length > 0) {
      agrupadas.set(ejercicio, delEjercicio);
    }
  }

  const porEjercicio: VolumenEjercicio[] = [];
  let tonelajeTotal = 0;
  let repsTotales = 0;
  let sumaIntensidades = 0;

  for (const [ejercicio, delEjercicio] of agrupadas) {
    let mejorUnoRM = 0;
    let tonelaje = 0;
    let reps = 0;
    for (const s of delEjercicio) {
      mejorUnoRM = Math.max(mejorUnoRM, promedioUnoRM(s.pesoKg, s.repeticiones));
      tonelaje += s.pesoKg * s.repeticiones;
      reps += s.repeticiones;
    }
    for (const s of delEjercicio) {
      sumaIntensidades += (s.pesoKg / mejorUnoRM) * 100;
    }
    tonelajeTotal += tonelaje;
    repsTotales += reps;
    porEjercicio.push({
      ejercicio,
      nombre: NOMBRE_EJERCICIO[ejercicio],
      series: delEjercicio.length,
      repeticiones: reps,
      tonelajeKg: unDecimal(tonelaje),
      mejorUnoRMKg: unDecimal(mejorUnoRM),
    });
  }

  return {
    totalSeries: series.length,
    totalRepeticiones: repsTotales,
    tonelajeKg: unDecimal(tonelajeTotal),
    intensidadPromedio: unDecimal(sumaIntensidades / series.length),
    porEjercicio,
  };
}

export function umbralKg(ejercicio: Ejercicio, rango: Rango, sexo: Sexo, pesoCorporalKg: number): number {
  if (rango === 'HIERRO') return 0;
  const indice = RANGOS.indexOf(rango) - 1;
  return MULTIPLOS[ejercicio][indice] * FACTOR_SEXO[sexo] * pesoCorporalKg;
}

export function dots(levantadoKg: number, pesoCorporalKg: number, sexo: Sexo): number {
  const c = sexo === 'FEMENINO' ? DOTS_FEMENINO : DOTS_MASCULINO;
  const pc = pesoCorporalKg;
  const denominador = c[0] + c[1] * pc + c[2] * pc * pc + c[3] * pc * pc * pc + c[4] * pc * pc * pc * pc;
  return (levantadoKg * 500) / denominador;
}

export function clasificar(ejercicio: Ejercicio, sexo: Sexo, pesoCorporalKg: number, unoRMKg: number): Clasificacion {
  if (!ejercicio || !sexo) {
    throw new ReglaDominioError('Debe indicar ejercicio y sexo');
  }
  validarPesoCorporal(pesoCorporalKg);
  validarPeso(unoRMKg);

  let rango: Rango = 'HIERRO';
  const escalera: Umbral[] = [];
  for (const candidato of RANGOS) {
    if (candidato === 'HIERRO') continue;
    const umbral = umbralKg(ejercicio, candidato, sexo, pesoCorporalKg);
    const alcanzado = unoRMKg + TOLERANCIA >= umbral;
    if (alcanzado) rango = candidato;
    escalera.push({ rango: candidato, kg: unDecimal(umbral), alcanzado });
  }

  const indice = RANGOS.indexOf(rango);
  const siguiente: Rango | null = indice + 1 < RANGOS.length ? RANGOS[indice + 1] : null;
  let umbralSiguienteKg: number | null = null;
  let faltaKg: number | null = null;
  if (siguiente) {
    const umbral = umbralKg(ejercicio, siguiente, sexo, pesoCorporalKg);
    umbralSiguienteKg = unDecimal(umbral);
    faltaKg = unDecimal(Math.max(0, umbral - unoRMKg));
  }

  return {
    ejercicio,
    sexo,
    pesoCorporalKg,
    unoRMKg,
    fuerzaRelativa: redondear(unoRMKg / pesoCorporalKg, 2),
    rango,
    siguiente,
    umbralSiguienteKg,
    faltaKg,
    dots: redondear(dots(unoRMKg, pesoCorporalKg, sexo), 2),
    escalera,
  };
}

export function nombreRango(rango: Rango | null): string {
  return rango ? NOMBRE_RANGO[rango] : '';
}
