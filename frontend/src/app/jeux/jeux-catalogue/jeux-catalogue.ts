import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EditeurService } from '@services/editeur.service';
import { JeuService } from '@services/jeu.service';
import { JeuDto } from '../jeu/jeu.dto';

@Component({
  selector: 'app-jeux-catalogue',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './jeux-catalogue.html',
  styleUrl: './jeux-catalogue.scss',
})
export class JeuxCatalogueComponent {
  private readonly jeuService = inject(JeuService);
  private readonly editeurService = inject(EditeurService);
  private readonly destroyRef = inject(DestroyRef);

  readonly catalogue = this.jeuService.catalogue;
  readonly loading = this.jeuService.catalogueLoading;
  readonly error = this.jeuService.catalogueError;
  readonly types = this.jeuService.types;
  readonly mecanismes = this.jeuService.mecanismes;
  readonly editeurs = this.editeurService.editeurs;

  readonly filterForm = new FormGroup({
    q: new FormControl<string>('', { nonNullable: true }),
    type: new FormControl<string>('', { nonNullable: true }),
    mecanisme: new FormControl<string>('', { nonNullable: true }),
    editeurId: new FormControl<string>('', { nonNullable: true }),
    sort: new FormControl<string>('nom', { nonNullable: true }),
  });
  readonly activeTab = signal('Tous');
  readonly tabs = computed(() => ['Tous', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '0-9']);

  readonly filteredCatalogue = computed(() => {
    const tab = this.activeTab();
    const list = [...this.catalogue()].sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? '', 'fr', { sensitivity: 'base' })
    );

    if (tab === 'Tous') return list;
    return list.filter(jeu => this.firstBucket(jeu.name) === tab);
  });

  constructor() {
    this.editeurService.loadAll();
    this.jeuService.loadTypes();
    this.jeuService.loadMecanismes();
    this.filterForm.controls.q.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyFilters());
    this.applyFilters();
  }

  applyFilters(): void {
    const { q, type, mecanisme, editeurId, sort } = this.filterForm.getRawValue();
    this.jeuService.loadCatalogue({
      q: q.trim() || null,
      type: type || null,
      mecanisme: mecanisme || null,
      editeurId: editeurId || null,
      sort: sort || null,
    });
  }

  resetFilters(): void {
    this.filterForm.reset({ q: '', type: '', mecanisme: '', editeurId: '', sort: 'nom' });
    this.applyFilters();
  }

  ageRange(jeu: JeuDto): string {
    const { ageMin, ageMax } = jeu;
    if (ageMin && ageMax) return `${ageMin} - ${ageMax} ans`;
    if (ageMin) return `À partir de ${ageMin} ans`;
    if (ageMax) return `Jusqu'à ${ageMax} ans`;
    return 'Âge non renseigné';
  }

  selectTab(tab: string): void {
    this.activeTab.set(tab);
  }

  private firstBucket(name?: string | null): string {
    const value = (name ?? '').trim();
    if (!value) return '0-9';
    const first = value[0]?.toUpperCase() ?? '';
    if (first >= 'A' && first <= 'Z') return first;
    if (first >= '0' && first <= '9') return '0-9';
    return '0-9';
  }
}
