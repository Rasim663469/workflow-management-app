import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';
import { environment } from '@env/environment';
import { EditeurDto } from '../../editeur/editeurs/editeur/editeurDTO';

@Injectable({ providedIn: 'root' })
export class EditeurService {
  private readonly http = inject(HttpClient);

  private readonly _editeurs  = signal<EditeurDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error   = signal<string | null>(null);

  readonly editeurs   = this._editeurs.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error   = this._error.asReadonly();

  private normalizeEditeur(dto: EditeurDto): EditeurDto {
    const login = dto.login?.trim() || 'editeur';

    return {
      id: String(dto.id ?? login ?? `editeur-${Math.random().toString(36).slice(2, 8)}`),
      login,
      name: dto.name?.trim() || login,
      description: dto.description?.trim() || 'Aucune description fournie.',
    };
  }

  loadAll(): void {
    this._loading.set(true);
    this._error.set(null);

    this.http.get<EditeurDto[]>(`${environment.apiUrl}/editeurs`, { withCredentials: true })
      .pipe(
        catchError(err => {
          const message = err instanceof Error ? err.message : 'Erreur lors du chargement des éditeurs';
          this._error.set(message);
          return of([] as EditeurDto[]);
        }),
        finalize(() => this._loading.set(false))
      )
      .subscribe(data => {
        const normalized = (data ?? []).map(dto => this.normalizeEditeur(dto));
        this._editeurs.set(normalized);
      });

  }
}
