import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@shared/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('secure-app');
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    // Redirige la racine "/" vers "/home" pour les invités comme pour les connectés
    if (this.router.url === '/' || window.location.pathname === '/') {
      this.router.navigateByUrl('/home');
    }
  }
}
