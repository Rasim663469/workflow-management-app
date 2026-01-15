import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, of, tap } from 'rxjs';
import { environment } from '@env/environment';
import { JeuDto } from '../../jeux/jeu/jeu.dto';

export interface JeuTypeRef {
  id: number;
  libelle: string;
  zoneId?: number | null;
}

export interface MecanismeRef {
  id: number;
  nom: string;
  description?: string | null;
}

@Injectable({ providedIn: 'root' })
export class JeuService {
  private readonly http = inject(HttpClient);

  private readonly _jeux = signal<JeuDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _catalogue = signal<JeuDto[]>([]);
  private readonly _catalogueLoading = signal(false);
  private readonly _catalogueError = signal<string | null>(null);
  private readonly _types = signal<JeuTypeRef[]>([]);
  private readonly _mecanismes = signal<MecanismeRef[]>([]);

  readonly jeux = this._jeux.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly catalogue = this._catalogue.asReadonly();
  readonly catalogueLoading = this._catalogueLoading.asReadonly();
  readonly catalogueError = this._catalogueError.asReadonly();
  readonly types = this._types.asReadonly();
  readonly mecanismes = this._mecanismes.asReadonly();

  private normalizeJeu(dto: any): JeuDto {
    return {
      id: `${dto.id ?? ''}`,
      editeurId: Number(dto.editeurId ?? dto.editeur_id ?? 0),
      name: dto.name ?? dto.nom ?? 'Nom non renseigné',
      authors: dto.authors ?? dto.auteurs ?? null,
      ageMin: dto.ageMin ?? dto.age_min ?? null,
      ageMax: dto.ageMax ?? dto.age_max ?? null,
      type: dto.type ?? dto.type_jeu ?? null,
      mecanismes: Array.isArray(dto.mecanismes) ? dto.mecanismes : [],
      editeurName: dto.editeurName ?? dto.editeur_name ?? dto.editeur ?? null,
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

  loadCatalogue(filters?: {
    q?: string | null;
    type?: string | null;
    mecanisme?: string | number | null;
    editeurId?: string | number | null;
    sort?: string | null;
  }): void {
    const params: Record<string, string> = {};
    if (filters?.q) params['q'] = filters.q;
    if (filters?.type) params['type'] = filters.type;
    if (filters?.mecanisme) params['mecanisme'] = `${filters.mecanisme}`;
    if (filters?.editeurId) params['editeur_id'] = `${filters.editeurId}`;
    if (filters?.sort) params['sort'] = filters.sort;

    this._catalogueLoading.set(true);
    this._catalogueError.set(null);

    this.http
      .get<JeuDto[]>(`${environment.apiUrl}/jeux`, {
        withCredentials: true,
        params,
      })
      .pipe(
        catchError(err => {
          const message =
            err instanceof Error ? err.message : 'Erreur lors du chargement des jeux';
          this._catalogueError.set(message);
          return of([] as JeuDto[]);
        }),
        finalize(() => this._catalogueLoading.set(false))
      )
      .subscribe(data => {
        const normalized = (data ?? []).map(dto => this.normalizeJeu(dto));
        this._catalogue.set(normalized);
      });
  }

  loadTypes(): void {
    this.http
      .get<JeuTypeRef[]>(`${environment.apiUrl}/types-jeu`, { withCredentials: true })
      .pipe(catchError(() => of([] as JeuTypeRef[])))
      .subscribe(data => {
        const normalized = (data ?? []).map(item => ({
          id: Number(item.id),
          libelle: `${item.libelle ?? ''}`.trim(),
          zoneId: item.zoneId ?? (item as any).zone_id ?? null,
        }));
        this._types.set(normalized.filter(item => item.libelle));
      });
  }

  loadMecanismes(): void {
    this.http
      .get<MecanismeRef[]>(`${environment.apiUrl}/mecanismes`, { withCredentials: true })
      .pipe(catchError(() => of([] as MecanismeRef[])))
      .subscribe(data => {
        const normalized = (data ?? []).map(item => ({
          id: Number(item.id),
          nom: `${item.nom ?? ''}`.trim(),
          description: item.description ?? null,
        }));
        this._mecanismes.set(normalized.filter(item => item.nom));
      });
  }
}
