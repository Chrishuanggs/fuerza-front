import { Injectable, inject } from '@angular/core';
import { ConfiguracionService, Unidad } from './configuracion.service';

export const KG_POR_LB = 0.45359237;

/**
 * Conversion y formato de pesos. El dominio y el backend trabajan siempre en kilos; la
 * unidad solo cambia lo que el usuario ve y escribe.
 */
@Injectable({ providedIn: 'root' })
export class UnidadesService {
  private readonly config = inject(ConfiguracionService);

  unidad(): Unidad {
    return this.config.unidad();
  }

  /** Convierte un valor escrito por el usuario (en la unidad activa) a kilos. */
  aKg(valor: number): number {
    return this.unidad() === 'lb' ? valor * KG_POR_LB : valor;
  }

  /** Convierte kilos a la unidad activa, sin redondear. */
  desdeKg(kg: number): number {
    return this.unidad() === 'lb' ? kg / KG_POR_LB : kg;
  }

  /** Numero listo para mostrar en la unidad activa. */
  valor(kg: number | null | undefined, decimales = 1): string {
    if (kg === null || kg === undefined || !Number.isFinite(kg)) return '';
    return this.desdeKg(kg).toFixed(decimales);
  }

  /** "112.5 kg" o "248.0 lb". */
  fmt(kg: number | null | undefined, decimales = 1): string {
    const v = this.valor(kg, decimales);
    return v === '' ? '' : `${v} ${this.unidad()}`;
  }

  /** Valor por defecto razonable para un campo de peso, en la unidad activa. */
  sugerido(kg: number): number {
    return this.unidad() === 'lb' ? Math.round(kg / KG_POR_LB) : kg;
  }
}
