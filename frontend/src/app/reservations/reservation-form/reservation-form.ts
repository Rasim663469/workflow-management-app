import { Component, EventEmitter, Input, Output, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { ReservationService } from '@services/reservation.service';
import { EditeurService } from '@services/editeur.service';
import { ZoneTarifaireDto, ZoneTarifaireService } from '@services/zone-tarifaire.service';

type LineForm = {
  zone_tarifaire_id: number | null;
  nombre_tables: number;
};

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [ReactiveFormsModule, CurrencyPipe],
  templateUrl: './reservation-form.html',
  styleUrl: './reservation-form.scss',
})
export class ReservationFormComponent {
  private readonly reservationService = inject(ReservationService);
  private readonly editeurService = inject(EditeurService);
  private readonly zoneTarifaireService = inject(ZoneTarifaireService);

  @Input({ required: true }) festivalId!: number | string;
  @Output() created = new EventEmitter<void>();

  readonly editeurs = this.editeurService.editeurs;
  readonly editeursLoading = this.editeurService.loading;

  readonly zones = signal<ZoneTarifaireDto[]>([]);
  readonly loadingZones = signal(false);
  readonly errorZones = signal<string | null>(null);
  readonly totalEstimate = signal<number>(0);
  readonly zoneErrors = signal<Record<number, string>>({});

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly submitSuccess = signal<string | null>(null);

  readonly form = new FormGroup({
    editeur_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    remise_tables_offertes: new FormControl<number>(0, { nonNullable: true }),
    remise_argent: new FormControl<number>(0, { nonNullable: true }),
  });

  readonly lignes = signal<LineForm[]>([{ zone_tarifaire_id: null, nombre_tables: 1 }]);

  constructor() {
    effect(() => this.editeurService.loadAll());
  }

  ngOnChanges(): void {
    this.loadZones();
  }

  private loadZones(): void {
    if (!this.festivalId) {
      this.zones.set([]);
      return;
    }

    this.loadingZones.set(true);
    this.errorZones.set(null);
    this.zoneTarifaireService.listByFestival(this.festivalId).subscribe({
      next: data => {
        this.zones.set(data ?? []);
        this.loadingZones.set(false);
        this.recomputeTotal();
      },
      error: err => {
        const message =
          err?.error?.error ??
          (err instanceof Error ? err.message : 'Erreur lors du chargement des zones tarifaires');
        this.errorZones.set(message);
        this.loadingZones.set(false);
      },
    });
  }

  addLine(): void {
    this.lignes.update(lines => [...lines, { zone_tarifaire_id: null, nombre_tables: 1 }]);
    this.recomputeTotal();
  }

  removeLine(index: number): void {
    this.lignes.update(lines => lines.filter((_, i) => i !== index));
    this.recomputeTotal();
  }

  updateLine(index: number, patch: Partial<LineForm>): void {
    this.lignes.update(lines =>
      lines.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
    this.recomputeTotal();
  }

  submit(): void {
    this.submitError.set(null);
    this.submitSuccess.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const editeurId = this.form.value.editeur_id;
    if (editeurId == null) {
      this.submitError.set('Sélectionnez un éditeur.');
      return;
    }

    const lignesPayload = this.lignes()
      .filter(line => line.zone_tarifaire_id !== null && line.nombre_tables > 0)
      .map(line => ({
        zone_tarifaire_id: Number(line.zone_tarifaire_id),
        nombre_tables: Number(line.nombre_tables),
      }));

    if (lignesPayload.length === 0) {
      this.submitError.set('Ajoutez au moins une zone tarifaire.');
      return;
    }

    // validation tables disponibles
    const errors: Record<number, string> = {};
    for (const line of lignesPayload) {
      const zone = this.zones().find(z => z.id === line.zone_tarifaire_id);
      if (zone && line.nombre_tables > zone.nombre_tables_disponibles) {
        errors[line.zone_tarifaire_id] = `Max ${zone.nombre_tables_disponibles} table(s) disponibles`;
      }
    }
    this.zoneErrors.set(errors);
    if (Object.keys(errors).length > 0) {
      this.submitError.set('Corrigez les quantités qui dépassent les tables disponibles.');
      return;
    }

    this.submitting.set(true);
    this.reservationService
      .create({
        editeur_id: Number(editeurId),
        festival_id: Number(this.festivalId),
        lignes: lignesPayload,
        remise_tables_offertes: Number(this.form.value.remise_tables_offertes ?? 0),
        remise_argent: Number(this.form.value.remise_argent ?? 0),
        statut_workflow: 'brouillon',
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
        this.submitSuccess.set('Réservation créée.');
        this.created.emit();
        this.form.reset({
          editeur_id: null,
          remise_tables_offertes: 0,
          remise_argent: 0,
        });
        this.lignes.set([{ zone_tarifaire_id: null, nombre_tables: 1 }]);
        this.recomputeTotal();
      },
        error: err => {
          const message =
            err?.error?.error ??
            (err instanceof Error ? err.message : 'Erreur lors de la création');
          this.submitError.set(message);
          this.submitting.set(false);
        },
      });
  }

  toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    return Number(value ?? 0);
  }

  private recomputeTotal(): void {
    const zonesMap = new Map(this.zones().map(z => [z.id, z.prix_table]));
    const total = this.lignes().reduce((sum, line) => {
      const price = zonesMap.get(line.zone_tarifaire_id ?? -1) ?? 0;
      const qty = Number(line.nombre_tables) || 0;
      return sum + qty * price;
    }, 0);
    this.totalEstimate.set(total);
  }
}
