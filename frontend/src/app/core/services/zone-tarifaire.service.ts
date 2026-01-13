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
}
