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

  readonly creatingJeu = signal(false);
  readonly jeuSuccess = signal<string | null>(null);
  readonly jeuError = signal<string | null>(null);
  readonly creatingUser = signal(false);
  readonly userSuccess = signal<string | null>(null);
  readonly userError = signal<string | null>(null);
  readonly updatingRoles = signal<Record<number, boolean>>({});
  readonly deletingUsers = signal<Record<number, boolean>>({});
  readonly roles: Array<{ value: 'super_admin' | 'super_organisateur' | 'organisateur' | 'benevole'; label: string }> = [
    { value: 'super_admin', label: 'Super admin' },
    { value: 'super_organisateur', label: 'Super-organisateur' },
    { value: 'organisateur', label: 'Organisateur' },
    { value: 'benevole', label: 'Bénévole' },
  ];

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

  readonly formUser = new FormGroup({
    login: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    password: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(4)],
    }),
    role: new FormControl<'super_admin' | 'super_organisateur' | 'organisateur' | 'benevole'>('benevole', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  constructor() {
    effect(() => this.userService.loadAll());
    effect(() => this.editeurService.loadAll());
    this.jeuService.loadTypes();
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

  submitUser(): void {
    this.userSuccess.set(null);
    this.userError.set(null);

    if (this.formUser.invalid) {
      this.formUser.markAllAsTouched();
      return;
    }

    const { login, password, role } = this.formUser.getRawValue();
    this.creatingUser.set(true);
    this.userService
      .createUser({
        login: login.trim(),
        password,
        role: role ?? 'benevole',
      })
      .subscribe({
        next: () => {
          this.userSuccess.set('Utilisateur créé avec succès.');
          this.creatingUser.set(false);
          this.formUser.reset({ login: '', password: '', role: 'benevole' });
          this.userService.loadAll();
        },
        error: err => {
          const message =
            err?.error?.error ??
            (err instanceof Error ? err.message : 'Erreur lors de la création utilisateur');
          this.userError.set(message);
          this.creatingUser.set(false);
        },
      });
  }

  updateRole(userId: number, role: 'super_admin' | 'super_organisateur' | 'organisateur' | 'benevole'): void {
    this.userError.set(null);
    this.userSuccess.set(null);
    this.updatingRoles.update(state => ({ ...state, [userId]: true }));
    this.userService.updateRole(userId, role).subscribe({
      next: () => {
        this.userSuccess.set('Rôle mis à jour.');
        this.updatingRoles.update(state => ({ ...state, [userId]: false }));
        this.userService.loadAll();
      },
      error: err => {
        const message =
          err?.error?.error ?? (err instanceof Error ? err.message : 'Erreur mise à jour rôle');
        this.userError.set(message);
        this.updatingRoles.update(state => ({ ...state, [userId]: false }));
      },
    });
  }

  deleteUser(userId: number): void {
    this.userError.set(null);
    this.userSuccess.set(null);
    this.deletingUsers.update(state => ({ ...state, [userId]: true }));
    this.userService.deleteUser(userId).subscribe({
      next: () => {
        this.userSuccess.set('Utilisateur supprimé.');
        this.deletingUsers.update(state => ({ ...state, [userId]: false }));
        this.userService.loadAll();
      },
      error: err => {
        const message =
          err?.error?.error ?? (err instanceof Error ? err.message : 'Erreur suppression utilisateur');
        this.userError.set(message);
        this.deletingUsers.update(state => ({ ...state, [userId]: false }));
      },
    });
  }

  toRole(value: string): 'super_admin' | 'super_organisateur' | 'organisateur' | 'benevole' {
    if (value === 'super_admin') return 'super_admin';
    if (value === 'super_organisateur') return 'super_organisateur';
    if (value === 'organisateur') return 'organisateur';
    return 'benevole';
  }
}
