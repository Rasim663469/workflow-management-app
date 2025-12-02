import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';
import { environment } from '@env/environment';
import { JeuDto } from '../../jeux/jeu/jeu.dto';

@Injectable({ providedIn: 'root' })
export class JeuService {
  private readonly http = inject(HttpClient);

  private readonly _jeux = signal<JeuDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly jeux = this._jeux.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  loadByEditeur(editeurId: string | number): void {
    const normalizedId = `${editeurId ?? ''}`.trim();

    if (!normalizedId) {
      this._jeux.set([]);
      return;
    }

    this._loading.set(true);
    this._error.set(null);

    this.http
      .get<JeuDto[]>(`${environment.apiUrl}/editeurs/${normalizedId}/jeux`, {
        withCredentials: true,
      })
      .pipe(
        catchError(err => {
          const message =
            err instanceof Error ? err.message : 'Erreur lors du chargement des jeux';
          this._error.set(message);
          return of([] as JeuDto[]);
        }),
        finalize(() => this._loading.set(false))
      )
      .subscribe(data => this._jeux.set(data ?? []));
  }
}
