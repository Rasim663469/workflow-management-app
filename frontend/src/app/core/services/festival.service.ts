import { Injectable, signal } from '@angular/core';
import { FestivalCard } from '../../festivals/festival/festival';
import { CreateFestivalDto, FestivalDto, TariffZoneDto } from '../../festivals/festival/festival-dto';

@Injectable({ providedIn: 'root' })
export class FestivalService {
  private readonly _festivalCards = signal<FestivalCard[]>([]);

  readonly festivals = this._festivalCards.asReadonly();

  addFestival(draft: CreateFestivalDto): FestivalCard {
    const normalizedDraft = this.normalizeDraft(draft);

    const dto: FestivalDto = {
      ...normalizedDraft,
      id: this.createId(normalizedDraft.name),
    };

    const card = this.mapToCard(dto);
    this._festivalCards.update(cards => [...cards, card]);
    return card;
  }

  hydrateFromDtos(dtos: FestivalDto[]): void {
    this._festivalCards.set(dtos.map(dto => this.mapToCard(dto)));
  }

  clear(): void {
    this._festivalCards.set([]);
  }

  private normalizeDraft(draft: CreateFestivalDto): CreateFestivalDto {
    const tariffZones = (draft.tariffZones ?? []).map(zone => this.normalizeZone(zone));

    return {
      name: draft.name.trim(),
      location: draft.location.trim(),
      date: this.normalizeDate(draft.date),
      tariffZones,
    };
  }

  private normalizeZone(zone: TariffZoneDto): TariffZoneDto {
    const pricePerTable = Number(zone.pricePerTable) || 0;
    const totalTables = Math.max(0, Math.trunc(Number(zone.totalTables)));
    const fallbackPricePerM2 = pricePerTable > 0 ? pricePerTable / 4.5 : 0;
    const pricePerM2Input =
      zone.pricePerM2 === null || zone.pricePerM2 === undefined ? NaN : Number(zone.pricePerM2);

    return {
      name: zone.name.trim(),
      totalTables,
      pricePerTable,
      pricePerM2: Number.isNaN(pricePerM2Input) ? fallbackPricePerM2 : pricePerM2Input,
    };
  }

  private normalizeDate(value: string): string {
    if (!value) {
      return new Date().toISOString();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  private mapToCard(dto: FestivalDto): FestivalCard {
    return {
      ...dto,
      displayDate: this.formatDisplayDate(dto.date),
    };
  }

  private formatDisplayDate(value: string): string {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private createId(source: string): string {
    const slug = source
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return `festival-${slug || 'nouveau'}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
