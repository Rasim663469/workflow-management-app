import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Si non connecté, on laisse passer vers home (ne pas bloquer les invités)
  if (!auth.isLoggedIn()) {
    router.navigate(['/home']);
    return false;
  }
  return true;
};
