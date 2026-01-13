import { Component, inject, signal } from '@angular/core';
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
    tariffZones: new FormArray<TariffZoneFormGroup>([this.createZoneGroup()]),
  });

  get tariffZones(): FormArray<TariffZoneFormGroup> {
    return this.form.controls.tariffZones;
  }

  // charge les données si il y a un id dans l'url
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.currentId = id;
      this.festivalService.getFestival(id).subscribe((data: any) => {
        this.form.patchValue(data);

        if (data.tariffZones?.length) {
          this.tariffZones.clear();
          data.tariffZones.forEach((z: any) => this.tariffZones.push(this.createZoneGroup(z)));
        }
      });
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
    const normalizedZones = (rawValue.tariffZones ?? []).map((zone, index) => ({
      name: zone.name.trim() || `Zone ${index + 1}`,
      totalTables: Number(zone.totalTables) || 0,
      pricePerTable: Number(zone.pricePerTable) || 0,
      pricePerM2: zone.pricePerM2 ?? (Number(zone.pricePerTable) / 4.5)
    }));

    const normalizedZones = (tariffZones ?? []).map((zone, index) => {
      const pricePerTable = Number(zone.pricePerTable) || 0;
      const pricePerM2 =
        zone.pricePerM2 === null || zone.pricePerM2 === undefined
          ? pricePerTable / 4.5
          : Number(zone.pricePerM2);

      return {
        name: zone.name.trim() || `Zone ${index + 1}`,
        totalTables: Number(zone.totalTables) || 0,
        pricePerTable,
        pricePerM2,
      };
    });

    if (this.editing() && this.festivalId) {
      this.updateFestival({
        id: this.festivalId,
        name: name.trim(),
        location: location.trim(),
        date,
        totalTables: normalizedZones.reduce((sum, zone) => sum + zone.totalTables, 0),
      });
    } else {
      // Persiste en base puis recharge la liste pour récupérer l'ID et les données réelles
      this.persistFestival({
        name: name.trim(),
        location: location.trim(),
        date,
        totalTables: normalizedZones.reduce((sum, zone) => sum + zone.totalTables, 0),
        tariffZones: normalizedZones,
      });
    }

    this.saveFestival(payload);
  }

  private persistFestival(payload: {
    name: string;
    location: string;
    date: string;
    totalTables: number;
    tariffZones: TariffZoneDto[];
  }): void {
    this.http
      .post(
        `${environment.apiUrl}/festivals`,
        {
          nom: payload.name,
          location: payload.location,
          nombre_total_tables: payload.totalTables,
          date_debut: payload.date,
          date_fin: payload.date,
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
        next: () => this.festivalService.loadAll(), // Rafraîchir pour récupérer l'ID réel et les zones
        error: err => console.error('Erreur lors de la création du festival', err),
      });
  }

  private updateFestival(payload: {
    id: string;
    name: string;
    location: string;
    date: string;
    totalTables: number;
  }): void {
    this.http
      .patch(
        `${environment.apiUrl}/festivals/${payload.id}`,
        {
          nom: payload.name,
          location: payload.location,
          nombre_total_tables: payload.totalTables,
          date_debut: payload.date,
          date_fin: payload.date,
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

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editing.set(true);
      this.festivalId = id;
      this.loadFestival(id);
    }
  }

  private loadFestival(id: string): void {
    this.http
      .get<any>(`${environment.apiUrl}/festivals/${id}`, { withCredentials: true })
      .subscribe({
        next: data => {
          if (!data) return;
          const dateValue = data.date
            ? new Date(data.date).toISOString().slice(0, 10)
            : '';
          this.form.patchValue({
            name: data.name ?? '',
            location: data.location ?? '',
            date: dateValue,
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
    if (controls.date.invalid) fields.push('date');
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
