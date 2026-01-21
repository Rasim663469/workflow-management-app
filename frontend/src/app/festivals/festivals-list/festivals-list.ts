import { Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FestivalCard } from '../festival-card/festival-card';
import { AuthService } from '@shared/auth/auth.service';
import { FestivalService } from '@services/festival.service';

@Component({
  selector: 'app-festivals-list',
  standalone: true,
  imports: [FestivalCard, RouterLink],
  templateUrl: './festivals-list.html',
  styleUrl: './festivals-list.scss'
})
export class FestivalsList {
  private readonly festivalService = inject(FestivalService);
  private readonly auth = inject(AuthService);
  readonly festivals = this.festivalService.festivals;
  readonly loading = this.festivalService.loading;
  readonly error = this.festivalService.error;
  readonly canManageFestivals = this.auth.canManageFestivals;


  constructor() {
    effect(() => this.festivalService.loadAll());
  }



}
