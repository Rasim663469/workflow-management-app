import { Component, Input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Festival } from '../festival/festival';

@Component({
  selector: 'app-festival-card',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './festival-card.html',
  styleUrl: './festival-card.scss'
})
export class FestivalCard {
  @Input({ required: true }) festival!: Festival;

}
