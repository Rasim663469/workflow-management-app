import { Component, inject, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@shared/auth/auth.service';
import { FestivalService } from '@services/festival.service';
import { FestivalsList } from 'app/festivals/festivals-list/festivals-list';

@Component({
  selector: 'app-home',
  imports: [RouterLink, FestivalsList],
  standalone: true,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  readonly title = 'Home Page';

  readonly auth = inject(AuthService);

  private readonly festivalService = inject(FestivalService);
  readonly festivals = this.festivalService.festivals;

  constructor() {
    effect(() => this.festivalService.loadAll());
  }

}
