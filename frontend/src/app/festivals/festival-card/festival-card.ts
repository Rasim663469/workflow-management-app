import { Component, Input, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Festival } from '../festival/festival';
import { AuthService } from '@shared/auth/auth.service';

@Component({
  selector: 'app-festival-card',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './festival-card.html',
  styleUrl: './festival-card.scss'
})
export class FestivalCard {
  @Input({ required: true }) festival!: Festival;
  readonly auth = inject(AuthService);
}
