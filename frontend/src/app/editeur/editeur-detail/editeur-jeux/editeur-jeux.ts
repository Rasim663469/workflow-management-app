import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Jeu } from 'app/jeux/jeu/jeu';
import { JeuService } from '@services/jeu.service';

@Component({
  selector: 'app-editeur-jeux',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './editeur-jeux.html',
  styleUrl: './editeur-jeux.scss'
})
export class EditeurJeuxComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly jeuService = inject(JeuService);
  private readonly fb = inject(FormBuilder);

  readonly editeurId = input<string>('');
  readonly editeurName = input<string>('');
  readonly jeuDrafts = signal<Record<string, { nom: string; auteurs: string; age_min: number | null; age_max: number | null; type_jeu: string }>>({});
  readonly editing = signal<Record<string, boolean>>({});

  readonly resolvedEditeurId = computed(() => {
    const direct = this.editeurId().trim();
    if (direct) return direct;
    return this.route.parent?.snapshot.paramMap.get('id') ?? '';
  });
  readonly resolvedEditeurName = computed(() => {
    const name = this.editeurName().trim();
    if (name) return name;
    return 'cet editeur';
  });
  readonly jeux = this.jeuService.jeux;
  readonly loading = this.jeuService.loading;
  readonly error = this.jeuService.error;

  readonly form = this.fb.group({
    nom: ['', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }],
    auteurs: [''],
    age_min: [null as number | null],
    age_max: [null as number | null],
    type_jeu: [''],
  });

  constructor() {
    effect(() => {
      const id = this.resolvedEditeurId().trim();
      if (!id) return;
      this.jeuService.loadByEditeur(id);
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const editeurId = Number(this.resolvedEditeurId());
    if (!editeurId) return;

    const { nom, auteurs, age_min, age_max, type_jeu } = this.form.getRawValue();
    const safeNom = (nom ?? '').trim();
    if (!safeNom) return;
    this.jeuService
      .create({
        nom: safeNom,
        editeur_id: editeurId,
        auteurs: auteurs?.trim() || null,
        age_min: age_min ?? null,
        age_max: age_max ?? null,
        type_jeu: type_jeu?.trim() || null,
      })
      .subscribe(() => {
        this.form.reset({
          nom: '',
          auteurs: '',
          age_min: null,
          age_max: null,
          type_jeu: '',
        });
      });
  }

  startEdit(jeu: Jeu): void {
    this.jeuDrafts.set({
      ...this.jeuDrafts(),
      [jeu.id]: {
        nom: jeu.name ?? '',
        auteurs: jeu.authors ?? '',
        age_min: jeu.ageMin ?? null,
        age_max: jeu.ageMax ?? null,
        type_jeu: jeu.type ?? '',
      },
    });
    this.editing.set({ ...this.editing(), [jeu.id]: true });
  }

  cancelEdit(jeuId: string): void {
    const nextDrafts = { ...this.jeuDrafts() };
    delete nextDrafts[jeuId];
    this.jeuDrafts.set(nextDrafts);

    const nextEditing = { ...this.editing() };
    delete nextEditing[jeuId];
    this.editing.set(nextEditing);
  }

  updateDraft(jeuId: string, field: 'nom' | 'auteurs' | 'age_min' | 'age_max' | 'type_jeu', value: string | number | null): void {
    const current = this.jeuDrafts();
    const existing = current[jeuId] ?? { nom: '', auteurs: '', age_min: null, age_max: null, type_jeu: '' };
    this.jeuDrafts.set({
      ...current,
      [jeuId]: { ...existing, [field]: value },
    });
  }

  saveEdit(jeuId: string): void {
    const draft = this.jeuDrafts()[jeuId];
    if (!draft?.nom) return;
    const editeurId = this.resolvedEditeurId();
    if (!editeurId) return;

    this.jeuService.update(
      jeuId,
      {
        nom: draft.nom.trim(),
        auteurs: draft.auteurs?.trim() || null,
        age_min: draft.age_min ?? null,
        age_max: draft.age_max ?? null,
        type_jeu: draft.type_jeu?.trim() || null,
      },
      editeurId
    );
    this.cancelEdit(jeuId);
  }

  removeJeu(jeuId: string): void {
    const editeurId = this.resolvedEditeurId();
    if (!editeurId) return;
    this.jeuService.delete(jeuId, editeurId);
  }

  ageRange(jeu: Jeu): string {
    const { ageMin, ageMax } = jeu;

    if (ageMin && ageMax) return `${ageMin} - ${ageMax} ans`;
    if (ageMin) return `À partir de ${ageMin} ans`;
    if (ageMax) return `Jusqu'à ${ageMax} ans`;
    return 'Âge non renseigné';
  }

  toNumberOrNull(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
}
