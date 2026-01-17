export interface ContactDto {
    id: string;
    editeurId: string;
    name: string;
    email: string;
    phone?: string;
    role?: string;
}

export type CreateContactDto = Omit<ContactDto, 'id'>;