import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export type JeuFestivalDto = {
  id: number;
  jeu_id: number;
  reservation_id: number;
  zone_plan_id?: number | null;
  quantite: number;
  nombre_tables_allouees?: number | null;
  type_table: string;
  tables_utilisees: number;
  liste_demandee?: boolean | null;
  liste_obtenue?: boolean | null;
  jeux_recus?: boolean | null;
  nom_jeu?: string | null;
  type_jeu?: string | null;
  nom_zone?: string | null;
  festival_id?: number | null;
};

@Injectable({ providedIn: 'root' })
export class JeuFestivalService {
  private readonly http = inject(HttpClient);

  listByReservation(reservationId: number | string): Observable<JeuFestivalDto[]> {
    return this.http.get<JeuFestivalDto[]>(`${environment.apiUrl}/jeu_festival`, {
      params: { reservation_id: reservationId },
      withCredentials: true,
    });
  }

  listByFestival(festivalId: number | string): Observable<JeuFestivalDto[]> {
    return this.http.get<JeuFestivalDto[]>(`${environment.apiUrl}/jeu_festival`, {
      params: { festival_id: festivalId },
      withCredentials: true,
    });
  }

  create(payload: Omit<JeuFestivalDto, 'id' | 'nom_jeu' | 'type_jeu' | 'nom_zone' | 'festival_id'>) {
    return this.http.post(`${environment.apiUrl}/jeu_festival`, payload, {
      withCredentials: true,
    });
  }

  update(id: number | string, payload: Partial<JeuFestivalDto>) {
    return this.http.put(`${environment.apiUrl}/jeu_festival/${id}`, payload, {
      withCredentials: true,
    });
  }

  delete(id: number | string) {
    return this.http.delete(`${environment.apiUrl}/jeu_festival/${id}`, {
      withCredentials: true,
    });
  }
}
