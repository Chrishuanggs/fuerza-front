import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { UnidadesService } from '../nucleo/unidades.service';

/** Valida un peso escrito en la unidad activa contra limites definidos en kilos. */
export function pesoEnRango(unidades: UnidadesService, minKg: number, maxKg: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = Number(control.value);
    if (control.value === null || control.value === '' || Number.isNaN(valor)) {
      return { requerido: true };
    }
    const kg = unidades.aKg(valor);
    if (kg < minKg || kg > maxKg) {
      return {
        rango: {
          min: unidades.valor(minKg, 0),
          max: unidades.valor(maxKg, 0),
          unidad: unidades.unidad(),
        },
      };
    }
    return null;
  };
}

export function enteroEnRango(min: number, max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = Number(control.value);
    if (control.value === null || control.value === '' || Number.isNaN(valor)) {
      return { requerido: true };
    }
    if (!Number.isInteger(valor)) {
      return { entero: true };
    }
    if (valor < min || valor > max) {
      return { rango: { min, max, unidad: '' } };
    }
    return null;
  };
}

/** Texto del primer error de un control, listo para mostrar debajo del campo. */
export function mensajeDe(control: AbstractControl | null, nombre = 'El valor'): string {
  if (!control || !control.errors || !(control.touched || control.dirty)) return '';
  const e = control.errors;
  if (e['requerido'] || e['required']) return `${nombre} es obligatorio`;
  if (e['entero']) return `${nombre} debe ser un número entero`;
  if (e['rango']) {
    const r = e['rango'] as { min: string | number; max: string | number; unidad: string };
    return `${nombre} debe estar entre ${r.min} y ${r.max}${r.unidad ? ' ' + r.unidad : ''}`;
  }
  if (e['url']) return `${nombre} debe ser una URL válida (http://localhost:8080)`;
  return `${nombre} no es válido`;
}
