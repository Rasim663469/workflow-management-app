import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import {
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

  private readonly reservationService = inject(ReservationService);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly contacts = signal<ReservationContactDto[]>([]);
  readonly loadingContacts = signal(false);
  readonly showContacts = signal(false);

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
}
