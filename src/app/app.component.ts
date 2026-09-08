import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CoachService } from './nucleo/coach.service';
import { FuerzaService } from './nucleo/fuerza.service';
import { UnidadesService } from './nucleo/unidades.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="barra">
      <div class="barra-interna">
        <a routerLink="/1rm" class="marca">
          <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="3" y="15" width="26" height="2" fill="currentColor"/>
            <rect x="5" y="9" width="4" height="14" rx="1" fill="var(--acento)"/>
            <rect x="23" y="9" width="4" height="14" rx="1" fill="var(--acento)"/>
            <rect x="9" y="11" width="3" height="10" rx="1" fill="var(--acento)"/>
            <rect x="20" y="11" width="3" height="10" rx="1" fill="var(--acento)"/>
          </svg>
          <span>Calculadora de Fuerza</span>
        </a>
        <nav aria-label="Secciones">
          <a routerLink="/1rm" routerLinkActive="activo">1RM</a>
          <a routerLink="/tabla" routerLinkActive="activo">Tabla</a>
          <a routerLink="/sesion" routerLinkActive="activo">Sesión</a>
          <a routerLink="/rango" routerLinkActive="activo">Rango</a>
          <a routerLink="/historial" routerLinkActive="activo">Historial</a>
          <a routerLink="/coach" routerLinkActive="activo">Coach</a>
          <a routerLink="/ajustes" routerLinkActive="activo">Ajustes</a>
        </nav>
        <div class="estado-barra">
          @switch (fuerza.modo()) {
            @case ('api') {
              <span class="estado ok" title="Los cálculos viajan al backend Spring Boot">API en línea</span>
            }
            @case ('local') {
              <span class="estado aviso" title="Sin backend: los cálculos se hacen en el navegador con las mismas reglas">Modo local</span>
            }
            @default {
              <span class="estado">Buscando backend</span>
            }
          }
          <span class="unidad num">{{ unidades.unidad() }}</span>
        </div>
      </div>
    </header>
    <main class="contenedor">
      <router-outlet />
    </main>
    <footer class="pie">
      <div class="contenedor pie-interna">
        <span>Proyecto de Ingeniería del Software 3 · Universidad CENFOTEC</span>
        <span>Angular {{ versionAngular }} · Spring Boot 3 · Gemini</span>
      </div>
    </footer>
  `,
  styles: `
    .barra { background: var(--superficie); border-bottom: 1px solid var(--borde); }
    .barra-interna { max-width: 980px; margin: 0 auto; padding: 0.6rem 1rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1.25rem; }
    .marca { display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700; color: var(--texto); text-decoration: none; margin-right: auto; }
    nav { display: flex; flex-wrap: wrap; gap: 0.15rem; order: 3; width: 100%; }
    nav a { color: var(--texto-suave); text-decoration: none; padding: 0.35rem 0.6rem; border-radius: var(--radio); border-bottom: 2px solid transparent; font-weight: 500; }
    nav a:hover { color: var(--texto); background: var(--superficie-2); }
    nav a.activo { color: var(--texto); border-bottom-color: var(--acento); }
    .estado-barra { display: inline-flex; align-items: center; gap: 0.9rem; }
    .unidad { font-size: 0.8rem; color: var(--texto-suave); border: 1px solid var(--borde); border-radius: var(--radio); padding: 0.1rem 0.4rem; }
    .pie { border-top: 1px solid var(--borde); color: var(--texto-suave); font-size: 0.8rem; }
    .pie-interna { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem; padding-top: 1rem; padding-bottom: 1.5rem; }
    @media (min-width: 900px) { nav { order: 0; width: auto; } }
  `,
})
export class AppComponent implements OnInit {
  readonly fuerza = inject(FuerzaService);
  readonly coach = inject(CoachService);
  readonly unidades = inject(UnidadesService);
  readonly versionAngular = '18';

  async ngOnInit(): Promise<void> {
    await this.fuerza.verificarBackend();
    await this.coach.verificarBackend();
  }
}
