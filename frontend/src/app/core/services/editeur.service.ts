import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, of, Observable, tap, map } from 'rxjs';
import { environment } from '@env/environment';
import { EditeurDto } from '../../editeur/editeurs/editeur/editeurDTO';
import { ContactDto, CreateContactDto } from '../../contact/contactDTO';

@Injectable({ providedIn: 'root' })
export class EditeurService {
  private readonly http = inject(HttpClient);

  private readonly _editeurs = signal<EditeurDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _contacts = signal<ContactDto[]>([]);
  readonly editeurs = this._editeurs.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly contacts = this._contacts.asReadonly();

  private normalizeEditeur(dto: EditeurDto): EditeurDto {
    const login = dto.login?.trim() || 'editeur';

    return {
      id: String(dto.id ?? login ?? `editeur-${Math.random().toString(36).slice(2, 8)}`),
      login,
      name: dto.name?.trim() || login,
      description: dto.description?.trim() || 'Aucune description fournie.',
      type_reservant: dto.type_reservant ?? null,
      est_reservant: dto.est_reservant ?? null,
    };
  }

  loadAll(): void {
    this._loading.set(true);
    this._error.set(null);

    this.http.get<EditeurDto[]>(`${environment.apiUrl}/editeurs`, { withCredentials: true })
      .pipe(
        catchError(err => {
          const message = err instanceof Error ? err.message : 'Erreur lors du chargement des éditeurs';
          this._error.set(message);
          return of([] as EditeurDto[]);
        }),
        finalize(() => this._loading.set(false))
      )
      .subscribe(data => {
        const normalized = (data ?? []).map(dto => this.normalizeEditeur(dto));
        this._editeurs.set(normalized);
      });

  }

  //charge les contacts d'un éditeur spécifique
  loadContactsForEditeur(editeurId: string): void {
    // We do NOT clear contacts here to avoid flashing empty for other editors
    this.http.get<any[]>(`${environment.apiUrl}/contacts?editeur_id=${editeurId}`)
      .pipe(
        map(rows => rows.map(row => ({
          id: row.id,
          editeurId: String(row.editeur_id), // Ensure string for consistency
          name: `${row.prenom || ''} ${row.nom || ''}`.trim() || 'Sans nom',
          email: row.email,
          phone: row.telephone,
          role: row.role
        }))),
        catchError(() => {
          this._error.set('Erreur lors du chargement des contacts');
          return of([]);
        })
      )
      .subscribe((newContacts: ContactDto[]) => {
        this._contacts.update(currentContacts => {
          // Remove existing contacts for this editor to avoid duplicates
          const otherContacts = currentContacts.filter(c => String(c.editeurId) !== String(editeurId));
          // Append new contacts
          return [...otherContacts, ...newContacts];
        });
      });
  }

  create(editeur: {
    nom: string;
    login: string;
    description: string | null;
    type_reservant?: string | null;
    est_reservant?: boolean;
  }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/editeurs`, editeur, { withCredentials: true }).pipe(
      tap(() => this.loadAll()) // Reload list after creation
    );
  }


  //ajouter un contact a un editeur
  addContact(contact: CreateContactDto): void {

    // Simple name splitting logic
    const nameParts = (contact.name || '').trim().split(/\s+/);
    const prenom = nameParts.length > 1 ? nameParts[0] : (nameParts[0] || 'Unknown');
    const nom = nameParts.length > 1 ? nameParts.slice(1).join(' ') : (nameParts[0] || 'Unknown');

    const payload = {
      editeur_id: contact.editeurId,
      prenom: prenom,
      nom: nom,
      email: contact.email,
      telephone: contact.phone,
      role: contact.role
    };

    this.http.post<ContactDto>(`${environment.apiUrl}/contacts`, payload)
      .pipe(
        tap((createdContact: any) => {
          const newContactDto: ContactDto = {
            id: createdContact.contact.id,
            editeurId: createdContact.contact.editeur_id,
            name: `${createdContact.contact.prenom} ${createdContact.contact.nom}`,
            email: createdContact.contact.email,
            phone: createdContact.contact.telephone,
            role: createdContact.contact.role
          };

          this._contacts.update((list: ContactDto[]) => [...list, newContactDto]);
        }),
        catchError(err => {
          console.error('Error creating contact:', err);
          this._error.set("Erreur lors de l'ajout du contact");
          return of(null);
        })
      )
      .subscribe();
  }

  //Supprime un contact
  deleteContact(contactId: string): void {
    this.http.delete(`${environment.apiUrl}/contacts/${contactId}`)
      .pipe(
        tap(() => {
          this._contacts.update((list: ContactDto[]) => list.filter(c => c.id !== contactId));
        }),
        catchError(() => {
          this._error.set('Erreur lors de la suppression du contact');
          return of(null);
        })
      )
      .subscribe();
  }

  updateContact(contactId: string, payload: { name: string; email: string; phone?: string; role?: string }): void {
    const nameParts = (payload.name || '').trim().split(/\s+/);
    const prenom = nameParts.length > 1 ? nameParts[0] : (nameParts[0] || 'Unknown');
    const nom = nameParts.length > 1 ? nameParts.slice(1).join(' ') : (nameParts[0] || 'Unknown');

    const body = {
      prenom,
      nom,
      email: payload.email,
      telephone: payload.phone,
      role: payload.role,
    };

    this.http.put<any>(`${environment.apiUrl}/contacts/${contactId}`, body)
      .pipe(
        tap(response => {
          const updated = response?.contact ?? response;
          if (!updated) return;

          this._contacts.update((list: ContactDto[]) =>
            list.map(c => c.id === String(contactId)
              ? {
                ...c,
                name: `${updated.prenom ?? prenom} ${updated.nom ?? nom}`.trim(),
                email: updated.email ?? payload.email,
                phone: updated.telephone ?? payload.phone,
                role: updated.role ?? payload.role,
              }
              : c
            )
          );
        }),
        catchError(err => {
          console.error('Error updating contact:', err);
          this._error.set("Erreur lors de la mise a jour du contact");
          return of(null);
        })
      )
      .subscribe();
  }




}
