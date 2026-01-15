import { Component, computed, effect, inject, signal } from '@angular/core';
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
  readonly activeTab = signal('Tous');
  readonly searchQuery = signal('');
  readonly tabs = computed(() => [
    'Tous',
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    '0-9',
  ]);

  readonly filteredEditeurs = computed(() => {
    const tab = this.activeTab();
    const query = this.searchQuery().trim().toLowerCase();
    let list = [...this.editeurs()].sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? '', 'fr', { sensitivity: 'base' })
    );

    if (query) {
      list = list.filter(editeur => {
        const name = (editeur.name ?? '').toLowerCase();
        const description = (editeur.description ?? '').toLowerCase();
        return name.includes(query) || description.includes(query);
      });
    }

    if (tab === 'Tous') return list;

    return list.filter(editeur => this.firstBucket(editeur.name) === tab);
  });

  constructor() {
    effect(() => this.editeurService.loadAll());
  }

  selectTab(tab: string): void {
    this.activeTab.set(tab);
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
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
