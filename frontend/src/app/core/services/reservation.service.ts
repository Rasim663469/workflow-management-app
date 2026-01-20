import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';
import { environment } from '@env/environment';

export type ReservationLineDto = {
  zone_tarifaire_id: number;
  nombre_tables: number;
  surface_m2?: number | null;
  zone_nom?: string | null;
  prix_table?: number | null;
  prix_m2?: number | null;
};

export type ReservationContactDto = {
  id: number;
  editeur_id: number;
  festival_id: number;
  date_contact: string;
  notes?: string | null;
};

export type FactureDto = {
  id: number;
  reservation_id: number;
  numero: string;
  montant_ttc: number;
  statut: 'facture' | 'payee';
  emise_le: string;
  payee_le?: string | null;
};
export type ReservationDto = {
  id: number;
  editeur_id: number;
  editeur_nom: string;
  festival_id: number;
  prix_total: number;
  prix_final: number;
  remise_tables_offertes?: number | null;
  remise_argent?: number | null;
  editeur_presente_jeux?: boolean | null;
  besoin_animateur?: boolean | null;
  prises_electriques?: number | null;
  notes?: string | null;
  souhait_grandes_tables?: number | null;
  souhait_tables_standard?: number | null;
  souhait_tables_mairie?: number | null;
  date_facturation?: string | null;
  date_paiement?: string | null;
  statut_workflow: string;
  tables_totales?: number;
  lignes?: ReservationLineDto[];
  last_contact?: string | null;
};

export type CreateReservationDto = {
  editeur_id: number;
  festival_id: number;
  lignes: ReservationLineDto[];
  remise_tables_offertes?: number;
  remise_argent?: number;
  editeur_presente_jeux?: boolean;
  besoin_animateur?: boolean;
  prises_electriques?: number;
  notes?: string | null;
  souhait_grandes_tables?: number;
  souhait_tables_standard?: number;
  souhait_tables_mairie?: number;
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
  editeurId: number;
  festivalId: number;
  remiseTablesOffertes?: number | null;
  remiseArgent?: number | null;
  editeurPresenteJeux?: boolean | null;
  besoinAnimateur?: boolean | null;
  prisesElectriques?: number | null;
  notes?: string | null;
  souhaitGrandesTables?: number | null;
  souhaitTablesStandard?: number | null;
  souhaitTablesMairie?: number | null;
  dateFacturation?: string | null;
  datePaiement?: string | null;
  lastContact?: string | null;
};

export type ReservationStatus =
  | 'brouillon'
  | 'pas_de_contact'
  | 'contact_pris'
  | 'discussion_en_cours'
  | 'sera_absent'
  | 'considere_absent'
  | 'present'
  | 'facture'
  | 'facture_payee'
  | 'envoyée'
  | 'validée'
  | 'annulée';

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly http = inject(HttpClient);

  private readonly _reservations = signal<ReservationCard[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly reservations = this._reservations.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  private tablesFromArea(surfaceM2?: number | null): number {
    const value = Number(surfaceM2 ?? 0);
    if (!value || value <= 0) return 0;
    return Math.ceil(value / 4);
  }

  private mapToCard(dto: ReservationDto): ReservationCard {
    const lignes = dto.lignes ?? [];
    return {
      id: String(dto.id),
      editeur: dto.editeur_nom ?? `Éditeur ${dto.editeur_id}`,
      statut: this.normalizeStatus(dto.statut_workflow),
      prixTotal: dto.prix_total ?? 0,
      prixFinal: dto.prix_final ?? dto.prix_total ?? 0,
      tables:
        dto.tables_totales ??
        lignes.reduce(
          (sum, line) =>
            sum + (line.nombre_tables ?? 0) + this.tablesFromArea(line.surface_m2),
          0
        ),
      lignes,
      editeurId: dto.editeur_id,
      festivalId: dto.festival_id,
      remiseTablesOffertes: dto.remise_tables_offertes ?? 0,
      remiseArgent: dto.remise_argent ?? 0,
      editeurPresenteJeux: dto.editeur_presente_jeux ?? false,
      besoinAnimateur: dto.besoin_animateur ?? false,
      prisesElectriques: dto.prises_electriques ?? 0,
      notes: dto.notes ?? null,
      souhaitGrandesTables: dto.souhait_grandes_tables ?? 0,
      souhaitTablesStandard: dto.souhait_tables_standard ?? 0,
      souhaitTablesMairie: dto.souhait_tables_mairie ?? 0,
      dateFacturation: dto.date_facturation ?? null,
      datePaiement: dto.date_paiement ?? null,
      lastContact: dto.last_contact ?? null,
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

  update(id: string | number, payload: Partial<CreateReservationDto>) {
    return this.http.put(`${environment.apiUrl}/reservations/${id}`, payload, {
      withCredentials: true,
    });
  }

  updateStatus(id: string | number, statut_workflow: ReservationStatus) {
    return this.http.put(
      `${environment.apiUrl}/reservations/${id}`,
      { statut_workflow },
      { withCredentials: true }
    );
  }

  addContact(id: string | number, notes?: string) {
    return this.http.post(
      `${environment.apiUrl}/reservations/${id}/contacts`,
      { notes },
      { withCredentials: true }
    );
  }

  loadContacts(id: string | number) {
    return this.http.get<ReservationContactDto[]>(
      `${environment.apiUrl}/reservations/${id}/contacts`,
      { withCredentials: true }
    );
  }
  createFacture(reservationId: string | number) {
    return this.http.post<{ facture: FactureDto }>(
      `${environment.apiUrl}/reservations/${reservationId}/factures`,
      {},
      { withCredentials: true }
    );
  }

  markFacturePayee(factureId: string | number) {
    return this.http.put<{ facture: FactureDto }>(
      `${environment.apiUrl}/factures/${factureId}/payee`,
      {},
      { withCredentials: true }
    );
  }

  getFactureByReservation(reservationId: string | number) {
    return this.http.get<FactureDto>(
      `${environment.apiUrl}/factures/reservation/${reservationId}`,
      { withCredentials: true }
    );
  }

  private normalizeStatus(value?: string | null): string {
    if (!value) return 'pas_de_contact';
    if (value === 'brouillon') return 'pas_de_contact';
    if (value === 'envoyée') return 'discussion_en_cours';
    if (value === 'validée') return 'present';
    return value;
  }
}