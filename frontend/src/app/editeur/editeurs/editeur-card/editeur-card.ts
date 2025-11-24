import { Component, Input } from '@angular/core';
import { Editeur } from '../editeur/editeur';

@Component({
  selector: 'app-editeur-card',
  standalone: true,
  imports: [],
  templateUrl: './editeur-card.html',
  styleUrl: './editeur-card.scss'
})
export class EditeurCard {
  @Input({ required: true }) editeur!: Editeur;

}
