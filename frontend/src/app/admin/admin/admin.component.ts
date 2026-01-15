import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { UserService } from '@shared/users/user.service';
import { environment } from '@env/environment';
import { EditeurService } from '@services/editeur.service';
import { JeuService } from '@services/jeu.service';

@Component({
  selector: 'app-admin',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent {
  private readonly userService = inject(UserService);
  private readonly http = inject(HttpClient);
  private readonly editeurService = inject(EditeurService);
  private readonly jeuService = inject(JeuService);
  readonly users = this.userService.users;
  readonly editeurs = this.editeurService.editeurs;
  readonly types = this.jeuService.types;

  readonly creating = signal(false);
  readonly success = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    login: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    nom: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    description: new FormControl<string>('', { nonNullable: true }),
  });

  readonly creatingJeu = signal(false);
  readonly jeuSuccess = signal<string | null>(null);
  readonly jeuError = signal<string | null>(null);

  readonly formJeu = new FormGroup({
    nom: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    editeur_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    auteurs: new FormControl<string>('', { nonNullable: true }),
    age_min: new FormControl<number | null>(null),
    age_max: new FormControl<number | null>(null),
    type_jeu: new FormControl<string>('', { nonNullable: true }),
  });

  constructor() {
    effect(() => this.userService.loadAll());
    effect(() => this.editeurService.loadAll());
    this.jeuService.loadTypes();
  }

  submit(): void {
    this.success.set(null);
    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { nom, login, description } = this.form.getRawValue();
    this.creating.set(true);

    this.http
      .post(
        `${environment.apiUrl}/editeurs`,
        { nom: nom.trim(), login: login.trim(), description: description.trim() || null },
        { withCredentials: true }
      )
      .subscribe({
        next: () => {
          this.success.set('Éditeur créé avec succès.');
          this.creating.set(false);
          this.form.reset({ nom: '', login: '', description: '' });
          this.editeurService.loadAll();
        },
        error: err => {
          const message =
            err?.error?.error ??
            (err instanceof Error ? err.message : 'Erreur lors de la création');
          this.error.set(message);
          this.creating.set(false);
        },
      });
  }

  submitJeu(): void {
    this.jeuSuccess.set(null);
    this.jeuError.set(null);

    if (this.formJeu.invalid) {
      this.formJeu.markAllAsTouched();
      return;
    }

    const { nom, editeur_id, auteurs, age_min, age_max, type_jeu } = this.formJeu.getRawValue();
    if (editeur_id == null) {
      this.jeuError.set('Sélectionnez un éditeur');
      return;
    }

    this.creatingJeu.set(true);
    this.jeuService
      .create({
        nom: nom.trim(),
        editeur_id: Number(editeur_id),
        auteurs: auteurs.trim() || null,
        age_min: age_min ?? null,
        age_max: age_max ?? null,
        type_jeu: type_jeu.trim() || null,
      })
      .subscribe({
        next: () => {
          this.jeuSuccess.set('Jeu créé avec succès.');
          this.creatingJeu.set(false);
          this.formJeu.reset({
            nom: '',
            editeur_id: null,
            auteurs: '',
            age_min: null,
            age_max: null,
            type_jeu: '',
          });
        },
        error: err => {
          const message =
            err?.error?.error ??
            (err instanceof Error ? err.message : 'Erreur lors de la création du jeu');
          this.jeuError.set(message);
          this.creatingJeu.set(false);
        },
      });
  }
}
