import { FestivalDto } from './festival-dto';

export interface Festival extends FestivalDto {
  displayDate: string;
}

export type FestivalCard = Festival;
