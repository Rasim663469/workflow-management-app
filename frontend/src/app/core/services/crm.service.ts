import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';
import { environment } from '@env/environment';

export type CrmStatus =
  | 'pas_de_contact'
  | 'contact_pris'
  | 'discussion_en_cours'
  | 'sera_absent'
  | 'considere_absent'
  | 'present';

export type CrmRow = {
  editeur_id: number;
  editeur_nom: string;
  type_reservant?: string | null;
  est_reservant?: boolean | null;
  statut?: CrmStatus | null;
  derniere_relance?: string | null;
  total_contacts?: number | null;
  last_contact?: string | null;
};

@Injectable({ providedIn: 'root' })
export class CrmService {
  private readonly http = inject(HttpClient);

  private readonly _rows = signal<CrmRow[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly rows = this._rows.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  loadByFestival(festivalId: number | string): void {
    if (!festivalId) {
      this._rows.set([]);
      return;
    }

    this._loading.set(true);
    this._error.set(null);

    this.http
      .get<CrmRow[]>(`${environment.apiUrl}/crm`, {
        params: { festival_id: festivalId },
        withCredentials: true,
      })
      .pipe(
        catchError(err => {
          const message =
            err?.error?.error ??
            (err instanceof Error ? err.message : 'Erreur lors du chargement CRM');
          this._error.set(message);
          return of([] as CrmRow[]);
        }),
        finalize(() => this._loading.set(false))
      )
      .subscribe(rows => {
        this._rows.set(rows ?? []);
      });
  }

  updateStatus(editeurId: number, festivalId: number | string, statut: CrmStatus) {
    return this.http.post(
      `${environment.apiUrl}/crm`,
      {
        editeur_id: editeurId,
        festival_id: Number(festivalId),
        statut,
      },
      { withCredentials: true }
    );
  }
}
