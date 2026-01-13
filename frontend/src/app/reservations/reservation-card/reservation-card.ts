import { Component, Input, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ReservationCard, ReservationService, ReservationStatus } from '@services/reservation.service';

@Component({
  selector: 'app-reservation-card',
  standalone: true,
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './reservation-card.html',
  styleUrl: './reservation-card.scss',
})
export class ReservationCardComponent {
  @Input({ required: true }) reservation!: ReservationCard;
  @Input() lastContact?: string | null;

  private readonly reservationService = inject(ReservationService);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly statuses: { value: ReservationStatus; label: string }[] = [
    { value: 'brouillon', label: 'Brouillon' },
    { value: 'envoyée', label: 'Envoyée' },
    { value: 'validée', label: 'Validée' },
    { value: 'annulée', label: 'Annulée' },
  ];

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
}
