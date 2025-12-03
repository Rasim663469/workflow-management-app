export interface TariffZoneDto {
  name: string;
  totalTables: number;
  pricePerTable: number;
  pricePerM2: number;
}

export interface FestivalDto {
  id: string;
  name: string;
  location: string;
  dateDebut: string;
  dateFin: string;
  description: string;
  tariffZones: TariffZoneDto[];
}

export type CreateFestivalDto = Omit<FestivalDto, 'id'>;
