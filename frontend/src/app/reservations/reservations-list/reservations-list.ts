import { Component, effect, inject, input, output, signal } from '@angular/core';
import { ReservationCardComponent } from '../reservation-card/reservation-card';
import { ReservationCard, ReservationService } from '@services/reservation.service';

@Component({
  selector: 'app-reservations-list',
  standalone: true,
  imports: [ReservationCardComponent],
  templateUrl: './reservations-list.html',
  styleUrl: './reservations-list.scss',
})
export class ReservationsListComponent {
  private readonly reservationService = inject(ReservationService);

  festivalId = input.required<number | string>();
  editRequested = output<ReservationCard>();
  gamesRequested = output<ReservationCard>();

  readonly reservations = this.reservationService.reservations;
  readonly loading = this.reservationService.loading;
  readonly error = this.reservationService.error;

  private currentFestival = signal<number | string | null>(null);

  constructor() {
    effect(() => {
      const id = this.festivalId();
      if (id && id !== this.currentFestival()) {
        this.currentFestival.set(id);
        this.reservationService.loadByFestival(id);
      }
    });
  }

  handleEditRequest(reservation: ReservationCard): void {
    this.editRequested.emit(reservation);
  }

  handleGamesRequest(reservation: ReservationCard): void {
    this.gamesRequested.emit(reservation);
  }
}
