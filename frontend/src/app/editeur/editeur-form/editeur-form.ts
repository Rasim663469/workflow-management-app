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
    readonly reservantTypes = [
        { value: 'editeur', label: 'Éditeur' },
        { value: 'prestataire', label: 'Prestataire' },
        { value: 'boutique', label: 'Boutique' },
        { value: 'animation', label: 'Animation' },
        { value: 'association', label: 'Association' },
    ];

    readonly form = new FormGroup({
        nom: new FormControl<string>('', {
            nonNullable: true,
            validators: [Validators.required, Validators.minLength(2)],
        }),
        description: new FormControl<string>('', { nonNullable: true }),
        type_reservant: new FormControl<string>('editeur', { nonNullable: true }),
        est_reservant: new FormControl<boolean>(true, { nonNullable: true }),
    });

    submit(): void {
        this.error.set(null);

        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const { nom, description, type_reservant, est_reservant } = this.form.getRawValue();
        this.creating.set(true);

        this.editeurService
            .create({
                nom: nom.trim(),
                description: description.trim() || null,
                type_reservant,
                est_reservant,
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
