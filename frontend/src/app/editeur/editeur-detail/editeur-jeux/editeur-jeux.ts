import { Component, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Jeu } from 'app/jeux/jeu/jeu';
import { JeuService } from '@services/jeu.service';

@Component({
  selector: 'app-editeur-jeux',
  standalone: true,
  imports: [],
  templateUrl: './editeur-jeux.html',
  styleUrl: './editeur-jeux.scss'
})
export class EditeurJeuxComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly jeuService = inject(JeuService);

  readonly editeurId = this.route.parent?.snapshot.paramMap.get('id') ?? '';
  readonly jeux = this.jeuService.jeux;
  readonly loading = this.jeuService.loading;
  readonly error = this.jeuService.error;

  constructor() {
    effect(() => {
      this.jeuService.loadByEditeur(this.editeurId);
    });
  }

  ageRange(jeu: Jeu): string {
    const { ageMin, ageMax } = jeu;

    if (ageMin && ageMax) return `${ageMin} - ${ageMax} ans`;
    if (ageMin) return `À partir de ${ageMin} ans`;
    if (ageMax) return `Jusqu'à ${ageMax} ans`;
    return 'Âge non renseigné';
  }
}
