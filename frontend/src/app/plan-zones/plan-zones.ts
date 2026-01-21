import { Component, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ZonePlanService, ZonePlanDto } from '@services/zone-plan.service';
import { ZoneTarifaireDto, ZoneTarifaireService } from '@services/zone-tarifaire.service';
import { AuthService } from '@shared/auth/auth.service';

@Component({
  selector: 'app-plan-zones',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './plan-zones.html',
  styleUrl: './plan-zones.scss',
})
export class PlanZonesComponent {
  private readonly zonePlanService = inject(ZonePlanService);
  private readonly zoneTarifaireService = inject(ZoneTarifaireService);
  readonly auth = inject(AuthService);

  festivalId = input.required<number | string>();

  readonly zones = signal<ZonePlanDto[]>([]);
  readonly zonesTarifaires = signal<ZoneTarifaireDto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly editingId = signal<number | null>(null);

  readonly form = new FormGroup({
    nom: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    zone_tarifaire_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    nombre_tables: new FormControl<number>(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
  });

  readonly editForm = new FormGroup({
    nom: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    zone_tarifaire_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    nombre_tables: new FormControl<number>(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
  });

  constructor() {
    effect(() => {
      const festivalId = this.festivalId();
      if (festivalId) {
        this.loadData();
      }
    });
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.zonePlanService.listByFestival(this.festivalId()).subscribe({
      next: rows => {
        this.zones.set(rows ?? []);
        this.loading.set(false);
      },
      error: err => {
        const message =
          err?.error?.error ?? (err instanceof Error ? err.message : 'Erreur chargement zones plan');
        this.error.set(message);
        this.loading.set(false);
      },
    });

    this.zoneTarifaireService.listByFestival(this.festivalId()).subscribe({
      next: rows => this.zonesTarifaires.set(rows ?? []),
      error: () => this.zonesTarifaires.set([]),
    });
  }

  create(): void {
    if (!this.auth.canManagePlacement()) {
      this.error.set('Vous ne pouvez pas modifier les zones du plan.');
      return;
    }
    this.error.set(null);
    this.success.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { nom, zone_tarifaire_id, nombre_tables } = this.form.getRawValue();
    if (!zone_tarifaire_id) return;

    this.zonePlanService
      .create({
        festival_id: Number(this.festivalId()),
        zone_tarifaire_id: Number(zone_tarifaire_id),
        nom: nom.trim(),
        nombre_tables: Number(nombre_tables ?? 0),
      })
      .subscribe({
        next: () => {
          this.success.set('Zone plan créée.');
          this.form.reset({ nom: '', zone_tarifaire_id: null, nombre_tables: 1 });
          this.loadData();
        },
        error: err => {
          const message =
            err?.error?.error ?? (err instanceof Error ? err.message : 'Erreur création zone plan');
          this.error.set(message);
        },
      });
  }

  delete(id: number): void {
    if (!this.auth.canManagePlacement()) {
      this.error.set('Vous ne pouvez pas modifier les zones du plan.');
      return;
    }
    this.error.set(null);
    this.success.set(null);
    this.zonePlanService.delete(id).subscribe({
      next: () => {
        this.success.set('Zone plan supprimée.');
        this.zones.update(list => list.filter(item => item.id !== id));
      },
      error: err => {
        const message =
          err?.error?.error ?? (err instanceof Error ? err.message : 'Erreur suppression zone plan');
        this.error.set(message);
      },
    });
  }

  zoneTarifaireName(id: number): string {
    return this.zonesTarifaires().find(zone => zone.id === id)?.nom ?? 'Zone tarifaire';
  }

  startEdit(zone: ZonePlanDto): void {
    if (!this.auth.canManagePlacement()) {
      this.error.set('Vous ne pouvez pas modifier les zones du plan.');
      return;
    }
    this.error.set(null);
    this.success.set(null);
    this.editingId.set(zone.id);
    this.editForm.reset({
      nom: zone.nom ?? '',
      zone_tarifaire_id: zone.zone_tarifaire_id ?? null,
      nombre_tables: Number(zone.nombre_tables ?? 1),
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editForm.reset({ nom: '', zone_tarifaire_id: null, nombre_tables: 1 });
  }

  saveEdit(zoneId: number): void {
    if (!this.auth.canManagePlacement()) {
      this.error.set('Vous ne pouvez pas modifier les zones du plan.');
      return;
    }
    this.error.set(null);
    this.success.set(null);
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const { nom, zone_tarifaire_id, nombre_tables } = this.editForm.getRawValue();
    if (!zone_tarifaire_id) return;

    this.zonePlanService
      .update(zoneId, {
        nom: nom.trim(),
        zone_tarifaire_id: Number(zone_tarifaire_id),
        nombre_tables: Number(nombre_tables ?? 0),
      })
      .subscribe({
        next: () => {
          this.success.set('Zone plan mise à jour.');
          this.zones.update(list =>
            list.map(item =>
              item.id === zoneId
                ? {
                    ...item,
                    nom: nom.trim(),
                    zone_tarifaire_id: Number(zone_tarifaire_id),
                    nombre_tables: Number(nombre_tables ?? 0),
                  }
                : item
            )
          );
          this.cancelEdit();
        },
        error: err => {
          const message =
            err?.error?.error ?? (err instanceof Error ? err.message : 'Erreur mise à jour zone plan');
          this.error.set(message);
        },
      });
  }
}
