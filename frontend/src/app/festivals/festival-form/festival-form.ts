import { Component, inject, OnInit, signal } from '@angular/core';
import { FormGroup, FormControl, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { FestivalService } from '@services/festival.service';
import { TariffZoneDto } from '../festival/festival-dto';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { ActivatedRoute, Router } from '@angular/router';

type TariffZoneFormGroup = FormGroup<{
  name: FormControl<string>;
  totalTables: FormControl<number>;
  pricePerTable: FormControl<number>;
  pricePerM2: FormControl<number | null>;
}>;

@Component({
  selector: 'app-festival-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './festival-form.html',
  styleUrl: './festival-form.scss'
})
export class FestivalForm implements OnInit {
  private readonly festivalService = inject(FestivalService);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly festivals = this.festivalService.festivals;
  readonly editing = signal(false);
  private festivalId: string | null = null;
  readonly submitError = signal<string | null>(null);
  readonly submitSuccess = signal<string | null>(null);

  private createZoneGroup(initial?: Partial<TariffZoneDto>): TariffZoneFormGroup {
    return new FormGroup({
      name: new FormControl<string>(initial?.name ?? '', { nonNullable: true, validators: [Validators.required] }),
      totalTables: new FormControl<number>(initial?.totalTables ?? 1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
      pricePerTable: new FormControl<number>(initial?.pricePerTable ?? 0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
      pricePerM2: new FormControl<number | null>(initial?.pricePerM2 ?? null, { validators: [Validators.min(0)] }),
    });
  }

  readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    location: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    dateDebut: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    dateFin: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    stockTablesStandard: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0)] }),
    stockTablesGrandes: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0)] }),
    stockTablesMairie: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0)] }),
    stockChaises: new FormControl<number>(0, { nonNullable: true, validators: [Validators.min(0)] }),
    tariffZones: new FormArray<TariffZoneFormGroup>([this.createZoneGroup()]),
  });

  get tariffZones(): FormArray<TariffZoneFormGroup> {
    return this.form.controls.tariffZones;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editing.set(true);
      this.festivalId = id;
      this.loadFestival(id);
    }
  }

  addZone(): void { this.tariffZones.push(this.createZoneGroup()); }

  removeZone(index: number): void {
    if (this.tariffZones.length > 1) this.tariffZones.removeAt(index);
  }

  onSubmit() {
    this.submitError.set(null);
    this.submitSuccess.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitError.set(`Champs à corriger : ${this.invalidFields().join(', ')}`);
      return;
    }

    const rawValue = this.form.getRawValue();
    const normalizedZones = (rawValue.tariffZones ?? []).map((zone, index) => {
      const pricePerTable = Number(zone.pricePerTable) || 0;
      const pricePerM2 =
        zone.pricePerM2 === null || zone.pricePerM2 === undefined
          ? pricePerTable / 4
          : Number(zone.pricePerM2);

      return {
        name: zone.name.trim() || `Zone ${index + 1}`,
        totalTables: Number(zone.totalTables) || 0,
        pricePerTable,
        pricePerM2,
      };
    });

    const payload = {
      name: rawValue.name.trim(),
      location: rawValue.location.trim(),
      dateDebut: rawValue.dateDebut,
      dateFin: rawValue.dateFin,
      description: rawValue.description.trim(),
      totalTables: normalizedZones.reduce((sum, zone) => sum + zone.totalTables, 0),
      stockTablesStandard: Number(rawValue.stockTablesStandard ?? 0),
      stockTablesGrandes: Number(rawValue.stockTablesGrandes ?? 0),
      stockTablesMairie: Number(rawValue.stockTablesMairie ?? 0),
      stockChaises: Number(rawValue.stockChaises ?? 0),
      tariffZones: normalizedZones,
    };

    if (this.editing() && this.festivalId) {
      this.updateFestival({
        id: this.festivalId,
        name: payload.name,
        location: payload.location,
        dateDebut: payload.dateDebut,
        dateFin: payload.dateFin,
        description: payload.description,
        totalTables: payload.totalTables,
        stockTablesStandard: payload.stockTablesStandard,
        stockTablesGrandes: payload.stockTablesGrandes,
        stockTablesMairie: payload.stockTablesMairie,
        stockChaises: payload.stockChaises,
      });
    } else {
      // Persiste en base puis recharge la liste pour récupérer l'ID et les données réelles
      this.persistFestival(payload);
    }
  }

  private persistFestival(payload: {
    name: string;
    location: string;
    dateDebut: string;
    dateFin: string;
    description: string;
    totalTables: number;
    stockTablesStandard: number;
    stockTablesGrandes: number;
    stockTablesMairie: number;
    stockChaises: number;
    tariffZones: TariffZoneDto[];
  }): void {
    this.http
      .post(
        `${environment.apiUrl}/festivals`,
        {
          nom: payload.name,
          location: payload.location,
          nombre_total_tables: payload.totalTables,
          date_debut: payload.dateDebut,
          date_fin: payload.dateFin,
          description: payload.description,
          stock_tables_standard: payload.stockTablesStandard,
          stock_tables_grandes: payload.stockTablesGrandes,
          stock_tables_mairie: payload.stockTablesMairie,
          stock_chaises: payload.stockChaises,
          zones: payload.tariffZones.map(zone => ({
            nom: zone.name,
            nombre_tables: zone.totalTables,
            prix_table: zone.pricePerTable,
            prix_m2: zone.pricePerM2,
          })),
        },
        { withCredentials: true }
      )
      .subscribe({
        next: () => {
          this.festivalService.loadAll(); // Rafraîchir pour récupérer l'ID réel et les zones
          this.submitSuccess.set('Festival créé.');
          this.router.navigate(['/home']);
        },
        error: err => {
          console.error('Erreur lors de la création du festival', err);
          this.submitError.set('Erreur lors de la création du festival.');
        },
      });
  }

  private updateFestival(payload: {
    id: string;
    name: string;
    location: string;
    dateDebut: string;
    dateFin: string;
    description: string;
    totalTables: number;
    stockTablesStandard: number;
    stockTablesGrandes: number;
    stockTablesMairie: number;
    stockChaises: number;
  }): void {
    this.http
      .patch(
        `${environment.apiUrl}/festivals/${payload.id}`,
        {
          nom: payload.name,
          location: payload.location,
          nombre_total_tables: payload.totalTables,
          date_debut: payload.dateDebut,
          date_fin: payload.dateFin,
          description: payload.description,
          stock_tables_standard: payload.stockTablesStandard,
          stock_tables_grandes: payload.stockTablesGrandes,
          stock_tables_mairie: payload.stockTablesMairie,
          stock_chaises: payload.stockChaises,
        },
        { withCredentials: true }
      )
      .subscribe({
        next: () => {
          this.festivalService.loadAll();
          this.submitSuccess.set('Festival mis à jour.');
          this.router.navigate(['/home']);
        },
        error: err => {
          console.error('Erreur lors de la mise à jour du festival', err);
          this.submitError.set('Erreur lors de la mise à jour du festival.');
        },
      });
  }

  private loadFestival(id: string): void {
    this.festivalService.getFestival(id).subscribe({
      next: data => {
        if (!data) return;
        this.form.patchValue({
          name: data.name ?? '',
          location: data.location ?? '',
          dateDebut: data.dateDebut ?? '',
          dateFin: data.dateFin ?? '',
          description: data.description ?? '',
          stockTablesStandard: data.stockTablesStandard ?? 0,
          stockTablesGrandes: data.stockTablesGrandes ?? 0,
          stockTablesMairie: data.stockTablesMairie ?? 0,
          stockChaises: data.stockChaises ?? 0,
        });
        this.tariffZones.clear();
        const zones = (data.tariffZones ?? []) as TariffZoneDto[];
        if (zones.length === 0) {
          this.tariffZones.push(this.createZoneGroup());
        } else {
          zones.forEach(z => this.tariffZones.push(this.createZoneGroup(z)));
        }
      },
      error: err => console.error('Erreur lors du chargement du festival', err),
    });
  }

  private invalidFields(): string[] {
    const fields: string[] = [];
    const controls = this.form.controls;
    if (controls.name.invalid) fields.push('nom');
    if (controls.location.invalid) fields.push('lieu');
    if (controls.dateDebut.invalid) fields.push('date de début');
    if (controls.dateFin.invalid) fields.push('date de fin');
    if (controls.description.invalid) fields.push('description');
    if (controls.stockTablesStandard.invalid) fields.push('stock tables standard');
    if (controls.stockTablesGrandes.invalid) fields.push('stock tables grandes');
    if (controls.stockTablesMairie.invalid) fields.push('stock tables mairie');
    if (controls.stockChaises.invalid) fields.push('stock chaises');
    this.tariffZones.controls.forEach((zone, idx) => {
      const z = zone.controls;
      if (z.name.invalid) fields.push(`zone ${idx + 1} nom`);
      if (z.totalTables.invalid) fields.push(`zone ${idx + 1} tables`);
      if (z.pricePerTable.invalid) fields.push(`zone ${idx + 1} prix table`);
      if (z.pricePerM2.invalid) fields.push(`zone ${idx + 1} prix m²`);
    });
    return fields;
  }
}
