import { Component } from '@angular/core';
import { EditeursList } from './editeurs/editeurs-list/editeurs-list';

@Component({
  selector: 'app-editeur',
  standalone: true,
  imports: [EditeursList],
  templateUrl: './editeur.html',
  styleUrl: './editeur.scss'
})
export class EditeurComponent {}
