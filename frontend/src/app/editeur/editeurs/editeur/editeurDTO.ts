export type EditeurRole = 'editeur';

export interface EditeurDto {
  id: string;
  name: string;
  login: string;
  description: string;
  type_reservant?: string | null;
  est_reservant?: boolean | null;
}

export type CreateEditeurDto = Omit<EditeurDto, 'id'>;
