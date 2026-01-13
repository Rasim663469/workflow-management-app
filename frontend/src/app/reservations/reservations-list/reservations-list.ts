import { Component, effect, inject, Input, signal } from '@angular/core';
import { ReservationCardComponent } from '../reservation-card/reservation-card';
import { ReservationService } from '@services/reservation.service';

@Component({
  selector: 'app-reservations-list',
  standalone: true,
  imports: [ReservationCardComponent],
  templateUrl: './reservations-list.html',
  styleUrl: './reservations-list.scss',
})
export class ReservationsListComponent {
  private readonly reservationService = inject(ReservationService);

  @Input({ required: true }) festivalId!: number | string;

  readonly reservations = this.reservationService.reservations;
  readonly loading = this.reservationService.loading;
  readonly error = this.reservationService.error;

  private currentFestival = signal<number | string | null>(null);

  constructor() {
    effect(() => {
      const id = this.currentFestival();
      if (id) {
        this.reservationService.loadByFestival(id);
      }
    });
  }

  ngOnChanges(): void {
    if (this.festivalId !== this.currentFestival()) {
      this.currentFestival.set(this.festivalId);
    }
  }
}
