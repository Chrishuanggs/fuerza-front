import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '1rm' },
  {
    path: '1rm',
    title: '1RM · Calculadora de Fuerza',
    loadComponent: () => import('./paginas/uno-rm/uno-rm.component').then((m) => m.UnoRMComponent),
  },
  {
    path: 'tabla',
    title: 'Tabla de porcentajes · Calculadora de Fuerza',
    loadComponent: () => import('./paginas/tabla/tabla.component').then((m) => m.TablaComponent),
  },
  {
    path: 'sesion',
    title: 'Sesión · Calculadora de Fuerza',
    loadComponent: () => import('./paginas/sesion/sesion.component').then((m) => m.SesionComponent),
  },
  {
    path: 'rango',
    title: 'Rango · Calculadora de Fuerza',
    loadComponent: () => import('./paginas/rango/rango.component').then((m) => m.RangoComponent),
  },
  {
    path: 'historial',
    title: 'Historial · Calculadora de Fuerza',
    loadComponent: () => import('./paginas/historial/historial.component').then((m) => m.HistorialComponent),
  },
  {
    path: 'coach',
    title: 'Coach · Calculadora de Fuerza',
    loadComponent: () => import('./paginas/coach/coach.component').then((m) => m.CoachComponent),
  },
  {
    path: 'ajustes',
    title: 'Ajustes · Calculadora de Fuerza',
    loadComponent: () => import('./paginas/ajustes/ajustes.component').then((m) => m.AjustesComponent),
  },
  { path: '**', redirectTo: '1rm' },
];
