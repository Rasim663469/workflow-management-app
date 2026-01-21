import { Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Festival } from '../festival/festival';
import { AuthService } from '@shared/auth/auth.service';
import { FestivalService } from '@services/festival.service';

@Component({
  selector: 'app-festival-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './festival-card.html',
  styleUrl: './festival-card.scss'
})
export class FestivalCard {
  @Input({ required: true }) festival!: Festival;
  readonly auth = inject(AuthService);
  private readonly festivalService = inject(FestivalService);
  readonly currentFestivalId = this.festivalService.currentFestivalId;

  canViewFestivalNumbers(): boolean {
    return this.auth.isLoggedIn() && !this.auth.isBenevole();
  }

  isCurrent(): boolean {
    const current = this.currentFestivalId();
    if (!current) return false;
    return String(current) === String(this.festival?.id);
  }

  setCurrent(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.festivalService.setCurrentFestival(this.festival?.id ?? null);
  }

  totalTables(): number {
    const fallback = (this.festival?.tariffZones ?? []).reduce(
      (sum, zone) => sum + (Number(zone.totalTables) || 0),
      0
    );
    const total = Number(this.festival?.totalTables ?? 0);
    return total || fallback;
  }

  totalAvailable(): number {
    const zones = this.festival?.tariffZones ?? [];
    return zones.reduce(
      (sum, zone) => sum + Number(zone.availableTables ?? zone.totalTables ?? 0),
      0
    );
  }

  zoneAvailable(zone: Festival['tariffZones'][number]): number {
    return Number(zone.availableTables ?? zone.totalTables ?? 0);
  }
}
