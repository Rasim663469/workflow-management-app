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

  roleLabel(role?: string | null): string {
    switch (role) {
      case 'super_admin':
        return 'Super admin';
      case 'super_organisateur':
        return 'Super-organisateur';
      case 'organisateur':
        return 'Organisateur';
      case 'benevole':
        return 'Bénévole';
      default:
        return 'Invité';
    }
  }

  constructor() {
    // Redirige la racine "/" vers "/home" pour les invités comme pour les connectés
    if (this.router.url === '/' || window.location.pathname === '/') {
      this.router.navigateByUrl('/home');
    }
  }
}
