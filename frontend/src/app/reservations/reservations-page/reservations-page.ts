import { Component, effect, inject, signal } from '@angular/core';
import { ReservationsListComponent } from '../reservations-list/reservations-list';
import { ReservationFormComponent } from '../reservation-form/reservation-form';
import { CrmListComponent } from '../../crm/crm-list/crm-list';
import { FestivalService } from '@services/festival.service';
import { ReservationCard, ReservationService } from '@services/reservation.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PlanZonesComponent } from '../../plan-zones/plan-zones';
import { ReservationGamesComponent } from '../reservation-games/reservation-games';
import { AuthService } from '@shared/auth/auth.service';

@Component({
  selector: 'app-reservations-page',
  standalone: true,
  imports: [
    ReservationsListComponent,
    ReservationFormComponent,
    ReservationGamesComponent,
    PlanZonesComponent,
    CrmListComponent,
  ],
  templateUrl: './reservations-page.html',
  styleUrl: './reservations-page.scss',
})
export class ReservationsPageComponent {
  private readonly festivalService = inject(FestivalService);
  private readonly reservationService = inject(ReservationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly festivals = this.festivalService.remoteFestivals;
  readonly loadingFestivals = this.festivalService.loading;
  readonly selectedFestivalId = this.festivalService.currentFestivalId;
  readonly currentFestival = this.festivalService.currentFestival;
  readonly editingReservation = signal<ReservationCard | null>(null);
  readonly gamesReservation = signal<ReservationCard | null>(null);
  readonly activeTab = signal<'suivi' | 'reservations' | 'nouvelle' | 'jeux' | 'plan'>('suivi');

  constructor() {
    effect(() => this.festivalService.loadAll());
    effect(() => {
      const current = this.festivalService.currentFestivalId();
      if (current) {
        this.reservationService.loadByFestival(current);
      }
    });
    effect(() => {
      if (!this.auth.canManageReservations()) {
        const tab = this.activeTab();
        if (tab === 'suivi' || tab === 'nouvelle') {
          this.activeTab.set('reservations');
        }
      }
      if (!this.auth.canManagePlacement()) {
        const tab = this.activeTab();
        if (tab === 'jeux' || tab === 'plan') {
          this.activeTab.set('reservations');
        }
      }
    });
  }

  ngOnInit(): void {
    // Initialiser depuis la query (festivalId/tab) si présent
    this.route.queryParamMap.subscribe(params => {
      const festivalId = params.get('festivalId');
      if (festivalId) {
        this.festivalService.setCurrentFestival(festivalId);
      }
      const tab = params.get('tab');
      if (tab) {
        this.setActiveTabFromQuery(tab);
      }
    });
  }

  private setActiveTabFromQuery(tab: string): void {
    if (tab === 'jeux' || tab === 'plan') {
      if (this.auth.canManagePlacement()) {
        this.activeTab.set(tab);
      }
      return;
    }
    if (tab === 'nouvelle' || tab === 'suivi') {
      if (this.auth.canManageReservations()) {
        this.activeTab.set(tab);
      }
      return;
    }
    if (tab === 'reservations') {
      this.activeTab.set('reservations');
    }
  }

  onFestivalChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    this.festivalService.setCurrentFestival(value);
    this.reservationService.loadByFestival(value);
    this.editingReservation.set(null);
    this.gamesReservation.set(null);

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
    this.activeTab.set('nouvelle');
  }

  handleGamesRequested(reservation: ReservationCard): void {
    this.gamesReservation.set(reservation);
    this.activeTab.set('jeux');
  }

  handleCancelled(): void {
    this.editingReservation.set(null);
    this.activeTab.set('reservations');
  }

  handleUpdated(): void {
    const id = this.selectedFestivalId();
    if (id) {
      this.reservationService.loadByFestival(id);
    }
    this.editingReservation.set(null);
    this.activeTab.set('reservations');
  }
}
