import { Component, inject } from '@angular/core';
import { FormGroup, FormControl, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { FestivalService } from '@services/festival.service';
import { TariffZoneDto } from '../festival/festival-dto';

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
export class FestivalForm {
  private readonly festivalService = inject(FestivalService);
  readonly festivals = this.festivalService.festivals;

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
    date: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    tariffZones: new FormArray<TariffZoneFormGroup>([this.createZoneGroup()]),
  });

  get tariffZones(): FormArray<TariffZoneFormGroup> {
    return this.form.controls.tariffZones;
  }

  addZone(): void {
    this.tariffZones.push(this.createZoneGroup());
  }

  removeZone(index: number): void {
    if (this.tariffZones.length <= 1) {
      return;
    }

    this.tariffZones.removeAt(index);
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, location, date, tariffZones } = this.form.getRawValue();

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

    this.festivalService.addFestival({
      name: name.trim(),
      location: location.trim(),
      date,
      tariffZones: normalizedZones,
    });

    this.form.reset({
      name: '',
      location: '',
      date: '',
    });
    this.tariffZones.clear();
    this.tariffZones.push(this.createZoneGroup());
  }
}
