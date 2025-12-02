import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-editeur-detail',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  templateUrl: './editeur-detail.html',
  styleUrl: './editeur-detail.scss'
})
export class EditeurDetailComponent {
  private readonly route = inject(ActivatedRoute);
  readonly editeurId = this.route.snapshot.paramMap.get('id') ?? '';
}
