import { inject, Injectable, signal } from '@angular/core';
import { FestivalCard } from '../../festivals/festival/festival';
import { CreateFestivalDto, FestivalDto, TariffZoneDto } from '../../festivals/festival/festival-dto';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '@env/environment';
import { Observable, map, tap } from 'rxjs';



@Injectable({ providedIn: 'root' })
export class FestivalService {
  private readonly http = inject(HttpClient);
  private readonly _festivalCards = signal<FestivalCard[]>([]);

  readonly festivals = this._festivalCards.asReadonly();

  private readonly _festivals = signal<FestivalDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly remoteFestivals = this._festivals.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

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

  deleteFestival(id: string): void {
    this.http.delete(`${environment.apiUrl}/festivals/${id}`, { withCredentials: true }).subscribe(() => {
      this._festivalCards.update(cards => cards.filter(card => card.id !== id));
      this._festivals.update(dtos => dtos.filter(dto => dto.id !== id));
    });
  }

  getFestival(id: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/festivals/${id}`, { withCredentials: true }).pipe(
      map((data: any) => ({
        name: data.nom,
        location: data.location,
        dateDebut: data.date_debut ? data.date_debut.split('T')[0] : '',
        dateFin: data.date_fin ? data.date_fin.split('T')[0] : '',
        description: data.description,
        tariffZones: []
      }))
    );
  }

  private normalizeDraft(draft: CreateFestivalDto): CreateFestivalDto {
    const tariffZones = (draft.tariffZones ?? []).map(zone => this.normalizeZone(zone));

    return {
      name: draft.name.trim(),
      location: draft.location.trim(),
      dateDebut: this.normalizeDate(draft.dateDebut),
      dateFin: this.normalizeDate(draft.dateFin),
      description: draft.description.trim(),
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

    const tariffZones = dto.tariffZones ?? [];
    return {
      ...dto,
      tariffZones,
      displayDate: this.formatDisplayDate(dto.dateDebut),
      displayDateDebut: this.formatDisplayDate(dto.dateDebut),
      displayDateFin: this.formatDisplayDate(dto.dateFin),
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

  loadAll(): void {
    this._loading.set(true);
    this._error.set(null);

    this.http
      .get<FestivalDto[]>(`${environment.apiUrl}/festivals`, { withCredentials: true })
      .pipe(
        catchError((err: unknown) => {
          const message =
            err instanceof Error ? err.message : 'Erreur lors du chargement des festivals';
          this._error.set(message);
          return of([] as FestivalDto[]);
        })
      )
      .subscribe(data => {
        const festivals = data ?? [];
        this._festivals.set(festivals);
        this.hydrateFromDtos(festivals);
        this._loading.set(false);
      });
  }



}
