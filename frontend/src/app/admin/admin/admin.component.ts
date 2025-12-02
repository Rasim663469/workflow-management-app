import { Component, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { UserService } from '@shared/users/user.service';
import { environment } from '@env/environment';
import { EditeurService } from '@services/editeur.service';

@Component({
  selector: 'app-admin',
  imports: [ReactiveFormsModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent {
  private readonly userService = inject(UserService);
  private readonly http = inject(HttpClient);
  private readonly editeurService = inject(EditeurService);
  readonly users = this.userService.users;
  readonly editeurs = this.editeurService.editeurs;

  readonly creating = signal(false);
  readonly success = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    nom: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    description: new FormControl<string>('', { nonNullable: true }),
  });

  constructor() {
    effect(() => this.userService.loadAll());
    effect(() => this.editeurService.loadAll());
  }

  submit(): void {
    this.success.set(null);
    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { nom, description } = this.form.getRawValue();
    this.creating.set(true);

    this.http
      .post(
        `${environment.apiUrl}/editeurs`,
        { nom: nom.trim(), description: description.trim() || null },
        { withCredentials: true }
      )
      .subscribe({
        next: () => {
          this.success.set('Éditeur créé avec succès.');
          this.creating.set(false);
          this.form.reset({ nom: '', description: '' });
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
}
