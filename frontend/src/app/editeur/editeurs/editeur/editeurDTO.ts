export type EditeurRole = 'editeur';

export interface EditeurDto {
  id: string;
  name: string;
  login: string;
  description: string;
}

export type CreateEditeurDto = Omit<EditeurDto, 'id'>;