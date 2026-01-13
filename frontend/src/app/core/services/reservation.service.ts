import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';
import { environment } from '@env/environment';

export type ReservationLineDto = {
  zone_tarifaire_id: number;
  nombre_tables: number;
  zone_nom?: string | null;
  prix_table?: number | null;
};

export type ReservationDto = {
  id: number;
  editeur_id: number;
  editeur_nom: string;
  festival_id: number;
  prix_total: number;
  prix_final: number;
  statut_workflow: string;
  tables_totales?: number;
  lignes?: ReservationLineDto[];
};

export type CreateReservationDto = {
  editeur_id: number;
  festival_id: number;
  lignes: ReservationLineDto[];
  remise_tables_offertes?: number;
  remise_argent?: number;
  editeur_presente_jeux?: boolean;
  statut_workflow?: string;
};

export type ReservationCard = {
  id: string;
  editeur: string;
  statut: string;
  prixTotal: number;
  prixFinal: number;
  tables: number;
  lignes: ReservationLineDto[];
};

export type ReservationStatus = 'brouillon' | 'envoyée' | 'validée' | 'annulée';

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly http = inject(HttpClient);

  private readonly _reservations = signal<ReservationCard[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly reservations = this._reservations.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  private mapToCard(dto: ReservationDto): ReservationCard {
    const lignes = dto.lignes ?? [];
    return {
      id: String(dto.id),
      editeur: dto.editeur_nom ?? `Éditeur ${dto.editeur_id}`,
      statut: dto.statut_workflow ?? 'PAS_DE_CONTACT',
      prixTotal: dto.prix_total ?? 0,
      prixFinal: dto.prix_final ?? dto.prix_total ?? 0,
      tables: dto.tables_totales ?? lignes.reduce((sum, line) => sum + (line.nombre_tables ?? 0), 0),
      lignes,
    };
  }

  loadByFestival(festivalId: number | string): void {
    if (!festivalId) {
      this._reservations.set([]);
      return;
    }

    this._loading.set(true);
    this._error.set(null);

    this.http
      .get<ReservationDto[]>(`${environment.apiUrl}/reservations/festival/${festivalId}`, {
        withCredentials: true,
      })
      .pipe(
        catchError(err => {
          const message =
            err?.error?.error ??
            (err instanceof Error ? err.message : 'Erreur lors du chargement des réservations');
          this._error.set(message);
          return of([] as ReservationDto[]);
        }),
        finalize(() => this._loading.set(false))
      )
      .subscribe(data => {
        const cards = (data ?? []).map(dto => this.mapToCard(dto));
        this._reservations.set(cards);
      });
  }

  create(payload: CreateReservationDto) {
    return this.http.post(`${environment.apiUrl}/reservations`, payload, { withCredentials: true });
  }

  updateStatus(id: string | number, statut_workflow: ReservationStatus) {
    return this.http.put(
      `${environment.apiUrl}/reservations/${id}`,
      { statut_workflow },
      { withCredentials: true }
    );
  }
}
