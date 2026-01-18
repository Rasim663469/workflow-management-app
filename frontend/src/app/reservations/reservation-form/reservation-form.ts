import { Component, EventEmitter, Input, Output, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { ReservationCard, ReservationService } from '@services/reservation.service';
import { EditeurService } from '@services/editeur.service';
import { ZoneTarifaireDto, ZoneTarifaireService } from '@services/zone-tarifaire.service';

type LineForm = {
  zone_tarifaire_id: number | null;
  nombre_tables: number;
  surface_m2: number;
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
  @Input() reservationToEdit: ReservationCard | null = null;
  @Output() created = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

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
  readonly editingId = signal<string | null>(null);

  readonly form = new FormGroup({
    editeur_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    remise_tables_offertes: new FormControl<number>(0, { nonNullable: true }),
    remise_argent: new FormControl<number>(0, { nonNullable: true }),
    editeur_presente_jeux: new FormControl<boolean>(true, { nonNullable: true }),
    besoin_animateur: new FormControl<boolean>(false, { nonNullable: true }),
    prises_electriques: new FormControl<number>(0, { nonNullable: true }),
    souhait_grandes_tables: new FormControl<number>(0, { nonNullable: true }),
    notes: new FormControl<string>('', { nonNullable: true }),
  });

  readonly lignes = signal<LineForm[]>([
    { zone_tarifaire_id: null, nombre_tables: 1, surface_m2: 0 },
  ]);

  private readonly tableAreaM2 = 4;
  private readonly pricePerOutlet = 250;

  constructor() {
    effect(() => this.editeurService.loadAll());
  }

  ngOnChanges(): void {
    this.loadZones();
    if (this.reservationToEdit) {
      this.applyEditState(this.reservationToEdit);
    } else if (this.editingId()) {
      this.resetForm();
    }
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
    this.lignes.update(lines => [
      ...lines,
      { zone_tarifaire_id: null, nombre_tables: 1, surface_m2: 0 },
    ]);
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
      .filter(
        line =>
          line.zone_tarifaire_id !== null &&
          (line.nombre_tables > 0 || Number(line.surface_m2) > 0)
      )
      .map(line => ({
        zone_tarifaire_id: Number(line.zone_tarifaire_id),
        nombre_tables: Number(line.nombre_tables),
        surface_m2: Number(line.surface_m2) || 0,
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
      if (zone) {
        const tablesFromArea = Math.ceil((line.surface_m2 || 0) / this.tableAreaM2);
        const totalTables = (line.nombre_tables || 0) + tablesFromArea;
        if (totalTables > zone.nombre_tables_disponibles) {
          errors[line.zone_tarifaire_id] = `Max ${zone.nombre_tables_disponibles} table(s) disponibles`;
        }
      }
    }
    this.zoneErrors.set(errors);
    if (Object.keys(errors).length > 0) {
      this.submitError.set('Corrigez les quantités qui dépassent les tables disponibles.');
      return;
    }

    this.submitting.set(true);

    const remise_tables_offertes = Number(this.form.value.remise_tables_offertes ?? 0);
    const remise_argent = Number(this.form.value.remise_argent ?? 0);
    const editeur_presente_jeux = Boolean(this.form.value.editeur_presente_jeux);
    const besoin_animateur = Boolean(this.form.value.besoin_animateur);
    const prises_electriques = Number(this.form.value.prises_electriques ?? 0);
    const souhait_grandes_tables = Number(this.form.value.souhait_grandes_tables ?? 0);
    const notes = (this.form.value.notes ?? '').trim() || null;

    if (this.editingId()) {
      this.reservationService
        .update(this.editingId()!, {
          lignes: lignesPayload,
          remise_tables_offertes,
          remise_argent,
          editeur_presente_jeux,
          besoin_animateur,
          prises_electriques,
          souhait_grandes_tables,
          notes,
        })
        .subscribe({
          next: () => {
            this.submitting.set(false);
            this.submitSuccess.set('Réservation mise à jour.');
            this.updated.emit();
            this.resetForm();
          },
          error: err => {
            const message =
              err?.error?.error ??
              (err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
            this.submitError.set(message);
            this.submitting.set(false);
          },
        });
      return;
    }

    this.reservationService
      .create({
        editeur_id: Number(editeurId),
        festival_id: Number(this.festivalId),
        lignes: lignesPayload,
        remise_tables_offertes,
        remise_argent,
        editeur_presente_jeux,
        besoin_animateur,
        prises_electriques,
        souhait_grandes_tables,
        notes,
        statut_workflow: 'pas_de_contact',
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.submitSuccess.set('Réservation créée.');
          this.created.emit();
          this.resetForm();
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

  recomputeTotal(): void {
    const zonesMap = new Map(this.zones().map(z => [z.id, z]));
    const base = this.lignes().reduce((sum, line) => {
      const zone = zonesMap.get(line.zone_tarifaire_id ?? -1);
      const priceTable = zone?.prix_table ?? 0;
      const priceM2 = zone?.prix_m2 ?? 0;
      const qtyTables = Number(line.nombre_tables) || 0;
      const qtyM2 = Number(line.surface_m2) || 0;
      return sum + qtyTables * priceTable + qtyM2 * priceM2;
    }, 0);
    const prises = Number(this.form.value.prises_electriques ?? 0);
    const remiseTables = Number(this.form.value.remise_tables_offertes ?? 0);
    const remiseArgent = Number(this.form.value.remise_argent ?? 0);
    const avgTablePrice = base > 0 ? base / Math.max(1, this.totalTablesFromLines()) : 0;
    const total = Math.max(
      0,
      base + prises * this.pricePerOutlet - remiseTables * avgTablePrice - remiseArgent
    );
    this.totalEstimate.set(Math.max(0, total));
  }

  private totalTablesFromLines(): number {
    return this.lignes().reduce((sum, line) => {
      const tables = Number(line.nombre_tables) || 0;
      const m2 = Number(line.surface_m2) || 0;
      return sum + tables + Math.ceil(m2 / this.tableAreaM2);
    }, 0);
  }

  cancelEdit(): void {
    this.resetForm();
    this.cancelled.emit();
  }

  private applyEditState(reservation: ReservationCard): void {
    this.editingId.set(reservation.id);
    this.submitSuccess.set(null);
    this.submitError.set(null);

    this.form.patchValue({
      editeur_id: reservation.editeurId ?? null,
      remise_tables_offertes: Number(reservation.remiseTablesOffertes ?? 0),
      remise_argent: Number(reservation.remiseArgent ?? 0),
      editeur_presente_jeux: Boolean(reservation.editeurPresenteJeux),
      besoin_animateur: Boolean(reservation.besoinAnimateur),
      prises_electriques: Number(reservation.prisesElectriques ?? 0),
      souhait_grandes_tables: Number(reservation.souhaitGrandesTables ?? 0),
      notes: reservation.notes ?? '',
    });

    const lines = reservation.lignes?.length
      ? reservation.lignes.map(line => ({
          zone_tarifaire_id: line.zone_tarifaire_id ?? null,
          nombre_tables: line.nombre_tables ?? 1,
          surface_m2: Number(line.surface_m2 ?? 0),
        }))
      : [{ zone_tarifaire_id: null, nombre_tables: 1, surface_m2: 0 }];

    this.lignes.set(lines);
    this.recomputeTotal();
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.form.reset({
      editeur_id: null,
      remise_tables_offertes: 0,
      remise_argent: 0,
      editeur_presente_jeux: true,
      besoin_animateur: false,
      prises_electriques: 0,
      souhait_grandes_tables: 0,
      notes: '',
    });
    this.lignes.set([{ zone_tarifaire_id: null, nombre_tables: 1, surface_m2: 0 }]);
    this.recomputeTotal();
  }
}
