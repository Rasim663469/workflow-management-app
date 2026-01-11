import { Component, Input, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Festival } from '../festival/festival';
import { AuthService } from '@shared/auth/auth.service';
import { FestivalService } from '@services/festival.service';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-festival-card',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './festival-card.html',
  styleUrl: './festival-card.scss'
})
export class FestivalCard {
  @Input({ required: true }) festival!: Festival;

  private readonly festivalService = inject(FestivalService);
  private readonly authService = inject(AuthService);

  readonly isAdmin = this.authService.isAdmin;

  //Mettre une sécurité pour réserver aux admins 
  deleteFestival(): void {
    this.festivalService.deleteFestival(this.festival.id);
  }


}
