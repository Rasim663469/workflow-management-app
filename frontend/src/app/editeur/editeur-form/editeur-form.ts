import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EditeurService } from '@services/editeur.service';

@Component({
    selector: 'app-editeur-form',
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: './editeur-form.html',
    styleUrl: './editeur-form.scss'
})
export class EditeurFormComponent {
    private readonly editeurService = inject(EditeurService);
    private readonly router = inject(Router);

    readonly creating = signal(false);
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

    submit(): void {
        this.error.set(null);

        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const { nom, login, description } = this.form.getRawValue();
        this.creating.set(true);

        this.editeurService
            .create({
                nom: nom.trim(),
                login: login.trim(),
                description: description.trim() || null,
            })
            .subscribe({
                next: () => {
                    this.creating.set(false);
                    this.router.navigate(['/editeurs']);
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

    cancel(): void {
        this.router.navigate(['/editeurs']);
    }
}
