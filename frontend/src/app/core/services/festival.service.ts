import { computed, inject, Injectable, signal } from '@angular/core';
import { FestivalCard } from '../../festivals/festival/festival';
import { CreateFestivalDto, FestivalDto, TariffZoneDto } from '../../festivals/festival/festival-dto';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { environment } from '@env/environment';

export interface FestivalStockUsageDto {
  festivalId: number | string;
  totals: {
    standard: number;
    grandes: number;
    mairie: number;
    chaises: number;
  };
  used: {
    standard: number;
    grandes: number;
    mairie: number;
    chaises: number;
  };
  remaining: {
    standard: number;
    grandes: number;
    mairie: number;
    chaises: number;
  };
}



@Injectable({ providedIn: 'root' })
export class FestivalService {
  private readonly http = inject(HttpClient);
  private readonly _festivalCards = signal<FestivalCard[]>([]);
  private readonly _currentFestivalId = signal<string | null>(null);

  readonly festivals = this._festivalCards.asReadonly();
  readonly currentFestivalId = this._currentFestivalId.asReadonly();
  readonly currentFestival = computed(() =>
    this._festivalCards().find(f => f.id === this._currentFestivalId()) ?? null
  );

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

    // Sélectionner par défaut le premier festival si aucun courant
    if (!this._currentFestivalId() && dtos.length > 0) {
      this._currentFestivalId.set(dtos[0].id);
    }
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

  getFestival(id: string): Observable<Partial<FestivalDto>> {
    return this.http.get<any>(`${environment.apiUrl}/festivals/${id}`, { withCredentials: true }).pipe(
      map((data: any) => ({
        name: data.name ?? data.nom ?? '',
        location: data.location ?? '',
        dateDebut: this.extractDateInput(data.dateDebut ?? data.date_debut ?? data.date ?? ''),
        dateFin: this.extractDateInput(data.dateFin ?? data.date_fin ?? data.date ?? ''),
        description: data.description ?? '',
        stockTablesStandard: Number(data.stockTablesStandard ?? data.stock_tables_standard ?? 0),
        stockTablesGrandes: Number(data.stockTablesGrandes ?? data.stock_tables_grandes ?? 0),
        stockTablesMairie: Number(data.stockTablesMairie ?? data.stock_tables_mairie ?? 0),
        stockChaises: Number(data.stockChaises ?? data.stock_chaises ?? 0),
        tariffZones: data.tariffZones ?? [],
      }))
    );
  }

  getStockUsage(id: string | number): Observable<FestivalStockUsageDto> {
    return this.http.get<FestivalStockUsageDto>(`${environment.apiUrl}/festivals/${id}/stock`, {
      withCredentials: true,
    });
  }

  private normalizeDraft(draft: CreateFestivalDto): CreateFestivalDto {
    const tariffZones = (draft.tariffZones ?? []).map(zone => this.normalizeZone(zone));

    return {
      name: draft.name.trim(),
      location: (draft.location ?? '').trim(),
      dateDebut: this.normalizeDate(draft.dateDebut ?? ''),
      dateFin: this.normalizeDate(draft.dateFin ?? ''),
      description: (draft.description ?? '').trim(),
      stockTablesStandard: Number(draft.stockTablesStandard ?? 0),
      stockTablesGrandes: Number(draft.stockTablesGrandes ?? 0),
      stockTablesMairie: Number(draft.stockTablesMairie ?? 0),
      stockChaises: Number(draft.stockChaises ?? 0),
      tariffZones,
    };
  }

  private normalizeZone(zone: TariffZoneDto): TariffZoneDto {
    const pricePerTable = Number(zone.pricePerTable) || 0;
    const totalTables = Math.max(0, Math.trunc(Number(zone.totalTables)));
    const fallbackPricePerM2 = pricePerTable > 0 ? pricePerTable / 4 : 0;
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
    // tolère tariffZones ou tariffzones selon l'API
    const tariffZones = (dto.tariffZones ?? (dto as any).tariffzones ?? []) as TariffZoneDto[];
    const totalTables =
      dto.totalTables ??
      tariffZones.reduce((sum, zone) => sum + (Number(zone.totalTables) || 0), 0);
    const dateDebut = dto.dateDebut ?? '';
    const dateFin = dto.dateFin ?? dto.dateDebut ?? '';
    return {
      ...dto,
      tariffZones,
      totalTables,
      displayDate: this.formatDisplayDate(dateDebut),
      displayDateDebut: this.formatDisplayDate(dateDebut),
      displayDateFin: this.formatDisplayDate(dateFin),
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

  private extractDateInput(value: string): string {
    if (!value) return '';
    return value.includes('T') ? value.split('T')[0] : value;
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

  setCurrentFestival(id: string | number | null): void {
    if (!id) {
      this._currentFestivalId.set(null);
      return;
    }
    this._currentFestivalId.set(String(id));
  }

  getOne(id: string): Observable<FestivalDto> {
    return this.http.get<FestivalDto>(`${environment.apiUrl}/festivals/${id}`, { withCredentials: true });
  }

  getGamesForFestival(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/festivals/${id}/games`, { withCredentials: true });
  }


}
