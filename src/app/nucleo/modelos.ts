/**
 * Tipos que espejan los records y enums de Java en fuerza-api.
 * Los nombres de los enums deben coincidir letra por letra con el backend.
 */

export type Ejercicio = 'SENTADILLA' | 'PRESS_BANCA' | 'PESO_MUERTO' | 'PRESS_MILITAR';
export type Sexo = 'MASCULINO' | 'FEMENINO';
export type Rango = 'HIERRO' | 'BRONCE' | 'PLATA' | 'ORO' | 'PLATINO' | 'DIAMANTE' | 'OBSIDIANA';
export type FormulaUnoRM = 'EPLEY' | 'BRZYCKI' | 'LOMBARDI' | 'LANDER' | 'OCONNER';

export const EJERCICIOS: readonly Ejercicio[] = ['SENTADILLA', 'PRESS_BANCA', 'PESO_MUERTO', 'PRESS_MILITAR'];
export const RANGOS: readonly Rango[] = ['HIERRO', 'BRONCE', 'PLATA', 'ORO', 'PLATINO', 'DIAMANTE', 'OBSIDIANA'];

export const NOMBRE_EJERCICIO: Record<Ejercicio, string> = {
  SENTADILLA: 'Sentadilla',
  PRESS_BANCA: 'Press de banca',
  PESO_MUERTO: 'Peso muerto',
  PRESS_MILITAR: 'Press militar',
};

export const NOMBRE_RANGO: Record<Rango, string> = {
  HIERRO: 'Hierro',
  BRONCE: 'Bronce',
  PLATA: 'Plata',
  ORO: 'Oro',
  PLATINO: 'Platino',
  DIAMANTE: 'Diamante',
  OBSIDIANA: 'Obsidiana',
};

export const NOMBRE_SEXO: Record<Sexo, string> = {
  MASCULINO: 'Masculino',
  FEMENINO: 'Femenino',
};

export interface EstimacionFormula {
  formula: FormulaUnoRM;
  nombre: string;
  unoRMKg: number;
}

export interface EstimacionUnoRM {
  pesoKg: number;
  repeticiones: number;
  porFormula: EstimacionFormula[];
  promedioKg: number;
  minimoKg: number;
  maximoKg: number;
  confiable: boolean;
}

export interface FilaTabla {
  porcentaje: number;
  pesoExactoKg: number;
  pesoRedondeadoKg: number;
  repeticionesEstimadas: number;
  objetivo: string;
}

export interface Serie {
  ejercicio: Ejercicio;
  pesoKg: number;
  repeticiones: number;
}

export interface VolumenEjercicio {
  ejercicio: Ejercicio;
  nombre: string;
  series: number;
  repeticiones: number;
  tonelajeKg: number;
  mejorUnoRMKg: number;
}

export interface ResumenSesion {
  totalSeries: number;
  totalRepeticiones: number;
  tonelajeKg: number;
  intensidadPromedio: number;
  porEjercicio: VolumenEjercicio[];
}

export interface Umbral {
  rango: Rango;
  kg: number;
  alcanzado: boolean;
}

export interface Clasificacion {
  ejercicio: Ejercicio;
  sexo: Sexo;
  pesoCorporalKg: number;
  unoRMKg: number;
  fuerzaRelativa: number;
  rango: Rango;
  siguiente: Rango | null;
  umbralSiguienteKg: number | null;
  faltaKg: number | null;
  dots: number;
  escalera: Umbral[];
}

export type RolChat = 'USUARIO' | 'COACH';

export interface MensajeChat {
  rol: RolChat;
  contenido: string;
}

export interface ContextoAtleta {
  ejercicio: Ejercicio | null;
  sexo: Sexo | null;
  pesoCorporalKg: number | null;
  unoRMKg: number | null;
  rango: Rango | null;
  siguiente: Rango | null;
  faltaKg: number | null;
  tonelajeUltimaSesionKg: number | null;
  seriesUltimaSesion: number | null;
}

export interface RespuestaCoach {
  respuesta: string;
  modelo: string;
}

export interface EstadoCoach {
  configurado: boolean;
  modelo: string;
  proveedor: string;
}

export interface EstadoApi {
  estado: string;
  servicio: string;
  version: string;
  coachConfigurado: boolean;
}

export interface ErrorApi {
  estado: number;
  tipo: string;
  mensaje: string;
  detalles: string[];
  momento: string;
}
