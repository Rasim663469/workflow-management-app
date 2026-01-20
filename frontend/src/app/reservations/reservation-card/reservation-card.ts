import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import {
  FactureDto,
  ReservationCard,
  ReservationContactDto,
  ReservationService,
  ReservationStatus,
} from '@services/reservation.service';

@Component({
  selector: 'app-reservation-card',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  templateUrl: './reservation-card.html',
  styleUrl: './reservation-card.scss',
})
export class ReservationCardComponent {
  @Input({ required: true }) reservation!: ReservationCard;
  @Input() lastContact?: string | null;
  @Output() editRequested = new EventEmitter<ReservationCard>();
  @Output() gamesRequested = new EventEmitter<ReservationCard>();

  private readonly reservationService = inject(ReservationService);
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

  readonly statuses: { value: ReservationStatus; label: string }[] = [
    { value: 'pas_de_contact', label: 'Pas de contact' },
    { value: 'contact_pris', label: 'Contact pris' },
    { value: 'discussion_en_cours', label: 'Discussion en cours' },
    { value: 'sera_absent', label: 'Sera absent' },
    { value: 'considere_absent', label: 'Considéré absent' },
    { value: 'present', label: 'Présent' },
    { value: 'facture', label: 'Facturé' },
    { value: 'facture_payee', label: 'Facture payée' },
    { value: 'annulée', label: 'Annulée' },
  ];
  private readonly statusLabels = new Map(
    this.statuses.map(status => [status.value, status.label])
  );

  ngOnChanges(): void {
    if (!this.reservation?.id) {
      return;
    }
    if (this.factureReservationId !== this.reservation.id) {
      this.factureReservationId = this.reservation.id;
      this.facture.set(null);
      if (this.shouldLoadFacture(this.reservation.statut)) {
        this.loadFacture(this.reservation.id);
      }
    }
  }

  updateStatus(value: ReservationStatus): void {
    this.error.set(null);
    this.saving.set(true);
    this.reservationService.updateStatus(this.reservation.id, value).subscribe({
      next: () => {
        this.reservation.statut = value;
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

  toggleContacts(): void {
    this.error.set(null);
    if (this.showContacts()) {
      this.showContacts.set(false);
      return;
    }
    this.loadingContacts.set(true);
    this.reservationService.loadContacts(this.reservation.id).subscribe({
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
    this.error.set(null);
    this.saving.set(true);
    this.reservationService.addContact(this.reservation.id).subscribe({
      next: () => {
        this.reservation.lastContact = new Date().toISOString();
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

  requestEdit(): void {
    this.editRequested.emit(this.reservation);
  }

  requestGames(): void {
    this.gamesRequested.emit(this.reservation);
  }

  toggleFactureDetails(): void {
    const next = !this.showFactureDetails();
    this.showFactureDetails.set(next);
    if (next && !this.facture() && !this.factureLoading()) {
      this.loadFacture(this.reservation.id);
    }
  }

  createFacture(): void {
    this.factureError.set(null);
    this.factureLoading.set(true);
    this.reservationService.createFacture(this.reservation.id).subscribe({
      next: response => {
        const facture = response?.facture ?? null;
        if (facture) {
          this.facture.set(facture);
          this.reservation.statut = 'facture';
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
    const facture = this.facture();
    if (!facture) return;
    this.factureError.set(null);
    this.factureLoading.set(true);
    this.reservationService.markFacturePayee(facture.id).subscribe({
      next: response => {
        const updated = response?.facture ?? null;
        if (updated) {
          this.facture.set(updated);
          this.reservation.statut = 'facture_payee';
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
    return this.reservation.statut === 'present' || this.reservation.statut === 'validée';
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
