import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, of, tap } from 'rxjs';
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

  private normalizeJeu(dto: any): JeuDto {
    return {
      id: `${dto.id ?? ''}`,
      editeurId: Number(dto.editeurId ?? dto.editeur_id ?? 0),
      name: dto.name ?? dto.nom ?? 'Nom non renseigné',
      authors: dto.authors ?? dto.auteurs ?? null,
      ageMin: dto.ageMin ?? dto.age_min ?? null,
      ageMax: dto.ageMax ?? dto.age_max ?? null,
      type: dto.type ?? dto.type_jeu ?? null,
    };
  }

  create(payload: {
    nom: string;
    editeur_id: number;
    auteurs?: string | null;
    age_min?: number | null;
    age_max?: number | null;
    type_jeu?: string | null;
  }) {
    this._error.set(null);
    return this.http
      .post(`${environment.apiUrl}/jeux`, payload, { withCredentials: true })
      .pipe(
        tap(() => this.loadByEditeur(payload.editeur_id)),
        catchError(err => {
          const message =
            err instanceof Error ? err.message : 'Erreur lors de la création du jeu';
          this._error.set(message);
          return of(null);
        })
      );
  }

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
      .subscribe(data => {
        const normalized = (data ?? []).map(dto => this.normalizeJeu(dto));
        this._jeux.set(normalized);
      });
  }
}
