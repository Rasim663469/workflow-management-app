import { Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FestivalCard } from '../festival-card/festival-card';
import { AuthService } from '@shared/auth/auth.service';
import { FestivalService } from '@services/festival.service';

import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-festivals-list',
  standalone: true,
  imports: [FestivalCard, RouterLink, JsonPipe],
  templateUrl: './festivals-list.html',
  styleUrl: './festivals-list.scss'
})
export class FestivalsList {
  readonly festivalService = inject(FestivalService);
  readonly authService = inject(AuthService);

  readonly festivals = this.festivalService.festivals;
  readonly loading = this.festivalService.loading;
  readonly error = this.festivalService.error;
  readonly isAdmin = this.authService.isAdmin;


  constructor() {
    effect(() => this.festivalService.loadAll());
  }



}
