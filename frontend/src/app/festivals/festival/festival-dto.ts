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
  stockTablesStandard?: number;
  stockTablesGrandes?: number;
  stockTablesMairie?: number;
  stockChaises?: number;
  tariffZones: TariffZoneDto[];
}

export type CreateFestivalDto = Omit<FestivalDto, 'id'>;
