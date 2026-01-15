import { Component, effect, inject, signal } from '@angular/core';
import { ReservationsListComponent } from '../reservations-list/reservations-list';
import { ReservationFormComponent } from '../reservation-form/reservation-form';
import { FestivalService } from '@services/festival.service';
import { ReservationCard, ReservationService } from '@services/reservation.service';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-reservations-page',
  standalone: true,
  imports: [ReservationsListComponent, ReservationFormComponent, FormsModule],
  templateUrl: './reservations-page.html',
  styleUrl: './reservations-page.scss',
})
export class ReservationsPageComponent {
  private readonly festivalService = inject(FestivalService);
  private readonly reservationService = inject(ReservationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly festivals = this.festivalService.remoteFestivals;
  readonly loadingFestivals = this.festivalService.loading;
  readonly selectedFestivalId = this.festivalService.currentFestivalId;
  readonly editingReservation = signal<ReservationCard | null>(null);

  constructor() {
    effect(() => this.festivalService.loadAll());
    effect(() => {
      const current = this.festivalService.currentFestivalId();
      if (current) {
        this.reservationService.loadByFestival(current);
      }
    });
  }

  ngOnInit(): void {
    // Initialiser depuis la query (festivalId) si présent
    this.route.queryParamMap.subscribe(params => {
      const festivalId = params.get('festivalId');
      if (festivalId) {
        this.festivalService.setCurrentFestival(festivalId);
      }
    });
  }

  onFestivalChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    this.festivalService.setCurrentFestival(value);
    this.reservationService.loadByFestival(value);
    this.editingReservation.set(null);

    // Mettre à jour la query pour navigation directe depuis les cartes
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { festivalId: value || null },
      queryParamsHandling: 'merge',
    });
  }

  handleCreated(): void {
    const id = this.selectedFestivalId();
    if (id) {
      this.reservationService.loadByFestival(id);
    }
  }

  handleEditRequested(reservation: ReservationCard): void {
    this.editingReservation.set(reservation);
  }

  handleCancelled(): void {
    this.editingReservation.set(null);
  }

  handleUpdated(): void {
    const id = this.selectedFestivalId();
    if (id) {
      this.reservationService.loadByFestival(id);
    }
    this.editingReservation.set(null);
  }
}
