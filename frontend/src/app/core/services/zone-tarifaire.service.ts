import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export type ZoneTarifaireDto = {
  id: number;
  festival_id: number;
  nom: string;
  nombre_tables_disponibles: number;
  prix_table: number;
  prix_m2?: number;
  nombre_tables_total?: number;
};

@Injectable({ providedIn: 'root' })
export class ZoneTarifaireService {
  private readonly http = inject(HttpClient);

  listByFestival(festivalId: number | string): Observable<ZoneTarifaireDto[]> {
    return this.http.get<ZoneTarifaireDto[]>(
      `${environment.apiUrl}/zones-tarifaires`,
      {
        params: { festival_id: festivalId },
        withCredentials: true,
      }
    );
  }

  create(payload: {
    festival_id: number;
    nom: string;
    nombre_tables_total: number;
    prix_table: number;
    prix_m2?: number;
  }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/zones-tarifaires`, payload, {
      withCredentials: true,
    });
  }

  update(id: number | string, payload: {
    nom?: string;
    nombre_tables_total?: number;
    prix_table?: number;
    prix_m2?: number;
  }): Observable<any> {
    return this.http.put(`${environment.apiUrl}/zones-tarifaires/${id}`, payload, {
      withCredentials: true,
    });
  }

  delete(id: number | string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/zones-tarifaires/${id}`, {
      withCredentials: true,
    });
  }
}
