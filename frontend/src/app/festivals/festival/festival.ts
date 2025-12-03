import { FestivalDto } from './festival-dto';

export interface Festival extends FestivalDto {
  displayDate: string;
  displayDateDebut: string;
  displayDateFin: string;
}

export type FestivalCard = Festival;
