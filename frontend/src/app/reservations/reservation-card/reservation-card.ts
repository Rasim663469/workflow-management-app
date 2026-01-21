import { Component, effect, inject, input, output, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  FactureDto,
  ReservationCard,
  ReservationContactDto,
  ReservationService,
  ReservationStatus,
} from '@services/reservation.service';
import { AuthService } from '@shared/auth/auth.service';

@Component({
  selector: 'app-reservation-card',
  standalone: true,
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './reservation-card.html',
  styleUrl: './reservation-card.scss',
})
export class ReservationCardComponent {
  reservation = input.required<ReservationCard>();
  lastContact = input<string | null>();
  editRequested = output<ReservationCard>();
  gamesRequested = output<ReservationCard>();

  private readonly reservationService = inject(ReservationService);
  readonly auth = inject(AuthService);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly contacts = signal<ReservationContactDto[]>([]);
  readonly loadingContacts = signal(false);
  readonly showContacts = signal(false);
  readonly facture = signal<FactureDto | null>(null);
  readonly factureLoading = signal(false);
  readonly factureError = signal<string | null>(null);
  private factureReservationId: string | null = null;
  readonly showFactureDetails = signal(false);
  readonly contactTypes: Record<string, string> = {
    email: 'Email',
    telephone: 'Téléphone',
    physique: 'Physique',
    autre: 'Autre',
  };



  readonly statuses: { value: ReservationStatus; label: string }[] = [
    { value: 'present', label: 'Présent' },
    { value: 'facture', label: 'Facturé' },
    { value: 'facture_payee', label: 'Facture payée' },
    { value: 'annulée', label: 'Annulée' },
  ];
  private readonly statusLabels = new Map(
    this.statuses.map(status => [status.value, status.label])
  );

  constructor() {
    effect(() => {
      const reservation = this.reservation();
      if (!reservation?.id) {
        return;
      }
      if (this.factureReservationId !== reservation.id) {
        this.factureReservationId = reservation.id;
        this.facture.set(null);
        if (this.shouldLoadFacture(reservation.statut)) {
          this.loadFacture(reservation.id);
        }
      }
    });
  }

  updateStatus(value: ReservationStatus): void {
    if (!this.auth.canManageReservations()) {
      return;
    }
    this.error.set(null);
    this.saving.set(true);
    const reservation = this.reservation();
    this.reservationService.updateStatus(reservation.id, value).subscribe({
      next: () => {
        reservation.statut = value;
        this.saving.set(false);
      },
      error: err => {
        const message =
          err?.error?.error ??
          (err instanceof Error ? err.message : 'Erreur lors de la mise à jour du statut');
        this.error.set(message);
        this.saving.set(false);
      },
    });
  }

  labelForStatus(value: string): string {
    return this.statusLabels.get(value as ReservationStatus) ?? value;
  }

  factureBreakdown() {
    const reservation = this.reservation();
    const totalCatalogue = reservation.prixTotal ?? 0;
    const totalTables = reservation.tables ?? 0;
    const remiseTables = reservation.remiseTablesOffertes ?? 0;
    const remiseArgent = reservation.remiseArgent ?? 0;
    const prixMoyen = totalTables > 0 ? totalCatalogue / totalTables : 0;
    const valeurRemiseTables = Math.min(remiseTables, totalTables) * prixMoyen;
    const totalFinal =
      reservation.prixFinal ?? Math.max(0, totalCatalogue - valeurRemiseTables - remiseArgent);

    const lignes = (reservation.lignes ?? []).map(line => {
      const tables = line.nombre_tables ?? 0;
      const surface = line.surface_m2 ?? 0;
      const prixTable = line.prix_table ?? 0;
      const prixM2 = line.prix_m2 ?? 0;
      const total = tables * prixTable + surface * prixM2;
      return {
        zone: line.zone_nom ?? 'Zone',
        tables,
        surface,
        prixTable,
        prixM2,
        total,
      };
    });

    return { totalCatalogue, totalTables, remiseTables, valeurRemiseTables, remiseArgent, totalFinal, lignes };
  }

  toggleContacts(): void {
    if (!this.auth.canManageReservations()) {
      return;
    }
    this.error.set(null);
    if (this.showContacts()) {
      this.showContacts.set(false);
      return;
    }
    const reservation = this.reservation();
    if (!reservation?.id) {
      this.loadingContacts.set(false);
      return;
    }
    this.loadingContacts.set(true);
    this.reservationService.loadContacts(reservation.id).subscribe({
      next: data => {
        this.contacts.set(data ?? []);
        this.showContacts.set(true);
        this.loadingContacts.set(false);
      },
      error: err => {
        const message =
          err?.error?.error ??
          (err instanceof Error ? err.message : 'Erreur lors du chargement des contacts');
        this.error.set(message);
        this.loadingContacts.set(false);
      },
    });
  }

  addContactNow(): void {
    if (!this.auth.canManageReservations()) {
      return;
    }
    this.error.set(null);
    this.saving.set(true);
    const note = 'Contact ajouté depuis la fiche réservation';
    const reservation = this.reservation();
    this.reservationService.addContact(reservation.id, note, 'telephone').subscribe({
      next: () => {
        reservation.lastContact = new Date().toISOString();
        this.saving.set(false);
        if (this.showContacts()) {
          this.toggleContacts();
          this.toggleContacts();
        }
      },
      error: err => {
        const message =
          err?.error?.error ??
          (err instanceof Error ? err.message : 'Erreur lors de la création du contact');
        this.error.set(message);
        this.saving.set(false);
      },
    });
  }

  contactTypeLabel(type?: string | null): string {
    if (!type) return 'Non renseigné';
    return this.contactTypes[type] ?? type;
  }

  requestEdit(): void {
    if (!this.auth.canManageReservations()) {
      return;
    }
    this.editRequested.emit(this.reservation());
  }

  requestGames(): void {
    if (!this.auth.canManagePlacement()) {
      return;
    }
    this.gamesRequested.emit(this.reservation());
  }

  toggleFactureDetails(): void {
    const next = !this.showFactureDetails();
    this.showFactureDetails.set(next);
    if (next && !this.facture() && !this.factureLoading()) {
      this.loadFacture(this.reservation().id);
    }
  }

  createFacture(): void {
    if (!this.auth.canManageReservations()) {
      return;
    }
    this.factureError.set(null);
    this.factureLoading.set(true);
    const reservation = this.reservation();
    this.reservationService.createFacture(reservation.id).subscribe({
      next: response => {
        const facture = response?.facture ?? null;
        if (facture) {
          this.facture.set(facture);
          reservation.statut = 'facture';
          this.showFactureDetails.set(true);
        }
        this.factureLoading.set(false);
      },
      error: err => {
        const message =
          err?.error?.error ??
          (err instanceof Error ? err.message : 'Erreur lors de la création de la facture');
        this.factureError.set(message);
        this.factureLoading.set(false);
      },
    });
  }

  markFacturePayee(): void {
    if (!this.auth.canManageReservations()) {
      return;
    }
    const facture = this.facture();
    if (!facture) return;
    this.factureError.set(null);
    this.factureLoading.set(true);
    this.reservationService.markFacturePayee(facture.id).subscribe({
      next: response => {
        const updated = response?.facture ?? null;
        if (updated) {
          this.facture.set(updated);
          this.reservation().statut = 'facture_payee';
          this.showFactureDetails.set(true);
        }
        this.factureLoading.set(false);
      },
      error: err => {
        const message =
          err?.error?.error ??
          (err instanceof Error ? err.message : 'Erreur lors de la mise à jour de la facture');
        this.factureError.set(message);
        this.factureLoading.set(false);
      },
    });
  }

  canCreateFacture(): boolean {
    return this.reservation().statut === 'present';
  }

  canMarkPayee(): boolean {
    const facture = this.facture();
    return Boolean(facture && facture.statut !== 'payee');
  }

  private shouldLoadFacture(status: string): boolean {
    return status === 'facture' || status === 'facture_payee';
  }

  private loadFacture(reservationId: string): void {
    this.factureError.set(null);
    this.factureLoading.set(true);
    this.reservationService.getFactureByReservation(reservationId).subscribe({
      next: data => {
        this.facture.set(data ?? null);
        this.factureLoading.set(false);
      },
      error: err => {
        if (err?.status === 404) {
          this.facture.set(null);
          this.factureLoading.set(false);
          return;
        }
        const message =
          err?.error?.error ??
          (err instanceof Error ? err.message : 'Erreur lors du chargement de la facture');
        this.factureError.set(message);
        this.factureLoading.set(false);
      },
    });
  }
}
