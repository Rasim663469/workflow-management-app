import { Component, inject, OnInit } from '@angular/core';
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

  currentId: string | null = null;

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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    const normalizedZones = (rawValue.tariffZones ?? []).map((zone, index) => ({
      name: zone.name.trim() || `Zone ${index + 1}`,
      totalTables: Number(zone.totalTables) || 0,
      pricePerTable: Number(zone.pricePerTable) || 0,
      pricePerM2: zone.pricePerM2 ?? (Number(zone.pricePerTable) / 4.5)
    }));

    const payload = {
      name: rawValue.name.trim(),
      location: rawValue.location.trim(),
      dateDebut: rawValue.dateDebut,
      dateFin: rawValue.dateFin,
      description: rawValue.description,
      totalTables: normalizedZones.reduce((sum, zone) => sum + zone.totalTables, 0),
    };

    this.saveFestival(payload);
  }

  private saveFestival(payload: any): void {
    const backendPayload = {
      nom: payload.name,
      location: payload.location,
      nombre_total_tables: payload.totalTables,
      date_debut: payload.dateDebut,
      date_fin: payload.dateFin,
      description: payload.description,
    };

    const request$ = this.currentId
      ? this.http.patch(`${environment.apiUrl}/festivals/${this.currentId}`, backendPayload, { withCredentials: true })
      : this.http.post(`${environment.apiUrl}/festivals`, backendPayload, { withCredentials: true });

    request$.subscribe({
      next: () => {
        this.router.navigate(['/festivals']);
      },
      error: err => console.error('Erreur', err),
    });
  }
}