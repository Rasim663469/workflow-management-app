import { Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FestivalCard } from '../festival-card/festival-card';
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
  readonly festivals = this.festivalService.festivals;
  readonly loading = this.festivalService.loading;
  readonly error = this.festivalService.error;


  constructor() {
    effect(() => this.festivalService.loadAll());
  }



}
