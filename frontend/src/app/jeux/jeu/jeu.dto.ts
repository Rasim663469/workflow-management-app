export interface JeuDto {
  id: string;
  editeurId: number;
  name: string;
  authors: string | null;
  ageMin: number | null;
  ageMax: number | null;
  type: string | null;
  mecanismes?: string[];
  editeurName?: string | null;
}
