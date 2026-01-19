export interface TariffZoneDto {
  name: string;
  totalTables: number;
  availableTables?: number;
  pricePerTable: number;
  pricePerM2: number;
}

export interface FestivalDto {
  id: string;
  name: string;
  totalTables?: number;
  location?: string;
  dateDebut?: string;
  dateFin?: string;
  description?: string;
  tariffZones: TariffZoneDto[];
  editeurs?: { id: string; name: string }[];
}

export type CreateFestivalDto = Omit<FestivalDto, 'id'>;
