import {
  clasificar,
  estimarUnoRM,
  haciaAbajoAlDisco,
  ReglaDominioError,
  resumirSesion,
  tablaPorcentajes,
  unDecimal,
} from './motor-fuerza';

/** Los mismos casos que FuerzaServiceImplTest en fuerza-api: los dos motores deben coincidir. */
describe('motor de fuerza', () => {
  it('1RM de 100 x 5 promedia 114.6 kg', () => {
    const e = estimarUnoRM(100, 5);
    expect(e.promedioKg).toBe(114.6);
    expect(e.minimoKg).toBe(112.5);
    expect(e.maximoKg).toBe(117.5);
    expect(e.confiable).toBeTrue();
    const porFormula = Object.fromEntries(e.porFormula.map((f) => [f.formula, f.unoRMKg]));
    expect(porFormula['EPLEY']).toBe(116.7);
    expect(porFormula['BRZYCKI']).toBe(112.5);
    expect(porFormula['LOMBARDI']).toBe(117.5);
    expect(porFormula['LANDER']).toBe(113.7);
    expect(porFormula['OCONNER']).toBe(112.5);
  });

  it('una repeticion es el 1RM en todas las formulas', () => {
    const e = estimarUnoRM(140, 1);
    expect(e.promedioKg).toBe(140);
    expect(e.minimoKg).toBe(140);
    expect(e.maximoKg).toBe(140);
  });

  it('mas de doce repeticiones no es confiable', () => {
    expect(estimarUnoRM(60, 12).confiable).toBeTrue();
    expect(estimarUnoRM(60, 13).confiable).toBeFalse();
  });

  it('rechaza entradas fuera de rango', () => {
    expect(() => estimarUnoRM(0, 5)).toThrowError(ReglaDominioError);
    expect(() => estimarUnoRM(601, 5)).toThrowError(ReglaDominioError);
    expect(() => estimarUnoRM(100, 0)).toThrowError(ReglaDominioError);
    expect(() => estimarUnoRM(100, 31)).toThrowError(ReglaDominioError);
    expect(() => estimarUnoRM(100, 2.5)).toThrowError(ReglaDominioError);
    expect(() => tablaPorcentajes(100, 0)).toThrowError(ReglaDominioError);
    expect(() => clasificar('SENTADILLA', 'MASCULINO', 29, 100)).toThrowError(ReglaDominioError);
    expect(() => resumirSesion([])).toThrowError(ReglaDominioError);
    expect(() => resumirSesion([{ ejercicio: 'SENTADILLA', pesoKg: 700, repeticiones: 5 }])).toThrowError(ReglaDominioError);
  });

  it('la tabla va de 100 a 50 y redondea hacia abajo al disco', () => {
    const tabla = tablaPorcentajes(114.6, 2.5);
    expect(tabla.length).toBe(11);
    expect(tabla[0].porcentaje).toBe(100);
    expect(tabla[10].porcentaje).toBe(50);
    expect(tabla[0].pesoExactoKg).toBe(114.6);
    expect(tabla[0].pesoRedondeadoKg).toBe(112.5);
    expect(tabla[4].porcentaje).toBe(80);
    expect(tabla[4].pesoExactoKg).toBe(91.7);
    expect(tabla[4].pesoRedondeadoKg).toBe(90);
    expect(tabla[4].repeticionesEstimadas).toBe(8);
    expect(tabla[4].objetivo).toBe('Fuerza');
    expect(tabla[0].repeticionesEstimadas).toBe(1);
    expect(tabla[0].objetivo).toBe('Fuerza máxima');
    expect(tabla[10].repeticionesEstimadas).toBe(19);
  });

  it('el redondeo al disco no sufre errores binarios', () => {
    expect(haciaAbajoAlDisco(97.5, 2.5)).toBe(97.5);
    expect(haciaAbajoAlDisco(100, 2.5)).toBe(100);
    expect(haciaAbajoAlDisco(99.9, 1.25)).toBe(98.75);
    expect(haciaAbajoAlDisco(114.6 * 0.95, 2.5)).toBe(107.5);
    expect(unDecimal(1.05)).toBe(1.1);
    expect(unDecimal(108.75)).toBe(108.8);
    expect(unDecimal(114.56666666)).toBe(114.6);
  });

  it('la sesion suma tonelaje y desglosa por ejercicio', () => {
    const r = resumirSesion([
      { ejercicio: 'SENTADILLA', pesoKg: 100, repeticiones: 5 },
      { ejercicio: 'SENTADILLA', pesoKg: 100, repeticiones: 5 },
      { ejercicio: 'PRESS_BANCA', pesoKg: 80, repeticiones: 8 },
    ]);
    expect(r.totalSeries).toBe(3);
    expect(r.totalRepeticiones).toBe(18);
    expect(r.tonelajeKg).toBe(1640);
    expect(r.porEjercicio.length).toBe(2);
    expect(r.porEjercicio[0].ejercicio).toBe('SENTADILLA');
    expect(r.porEjercicio[0].series).toBe(2);
    expect(r.porEjercicio[0].tonelajeKg).toBe(1000);
    expect(r.porEjercicio[0].mejorUnoRMKg).toBe(114.6);
    expect(r.intensidadPromedio).toBe(85.1);
  });

  it('press de banca de 100 kg a 75 kg es Oro', () => {
    const c = clasificar('PRESS_BANCA', 'MASCULINO', 75, 100);
    expect(c.rango).toBe('ORO');
    expect(c.siguiente).toBe('PLATINO');
    expect(c.umbralSiguienteKg).toBe(108.8);
    expect(c.faltaKg).toBe(8.8);
    expect(c.dots).toBe(71.74);
    expect(c.fuerzaRelativa).toBe(1.33);
    expect(c.escalera.length).toBe(6);
    expect(c.escalera[2].alcanzado).toBeTrue();
    expect(c.escalera[3].alcanzado).toBeFalse();
  });

  it('los kilos faltantes llevan exactamente al siguiente umbral', () => {
    const c = clasificar('SENTADILLA', 'MASCULINO', 80, 100);
    expect(c.rango).toBe('PLATA');
    expect(clasificar('SENTADILLA', 'MASCULINO', 80, 100 + (c.faltaKg ?? 0)).rango).toBe('ORO');
  });

  it('Obsidiana es el techo', () => {
    const c = clasificar('PESO_MUERTO', 'MASCULINO', 80, 300);
    expect(c.rango).toBe('OBSIDIANA');
    expect(c.siguiente).toBeNull();
    expect(c.faltaKg).toBeNull();
    expect(c.umbralSiguienteKg).toBeNull();
  });

  it('debajo de Bronce es Hierro', () => {
    const c = clasificar('SENTADILLA', 'MASCULINO', 80, 50);
    expect(c.rango).toBe('HIERRO');
    expect(c.siguiente).toBe('BRONCE');
    expect(c.faltaKg).toBe(10);
  });

  it('los umbrales femeninos usan factor 0.70', () => {
    const c = clasificar('PRESS_BANCA', 'FEMENINO', 60, 50);
    expect(c.rango).toBe('ORO');
    expect(c.umbralSiguienteKg).toBe(60.9);
    expect(c.faltaKg).toBe(10.9);
  });

  it('justo en el umbral cuenta como alcanzado', () => {
    expect(clasificar('PRESS_BANCA', 'MASCULINO', 80, 88).rango).toBe('ORO');
  });
});
