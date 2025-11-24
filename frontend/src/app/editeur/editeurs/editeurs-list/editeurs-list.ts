import { Component, effect, inject } from '@angular/core';
import { EditeurCard } from '../editeur-card/editeur-card';
import { EditeurService } from '@services/editeur.service';

@Component({
  selector: 'app-editeurs-list',
  standalone: true,
  imports: [EditeurCard],
  templateUrl: './editeurs-list.html',
  styleUrl: './editeurs-list.scss'
})
export class EditeursList {
  private readonly editeurService = inject(EditeurService);
  readonly editeurs = this.editeurService.editeurs;
  readonly loading = this.editeurService.loading;
  readonly error = this.editeurService.error;


  constructor() {
    effect(() => this.editeurService.loadAll());
  }



}
