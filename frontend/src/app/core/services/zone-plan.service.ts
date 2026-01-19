import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export type ZonePlanDto = {
  id: number;
  festival_id: number;
  zone_tarifaire_id: number;
  nom: string;
  nombre_tables: number;
};

@Injectable({ providedIn: 'root' })
export class ZonePlanService {
  private readonly http = inject(HttpClient);

  listByFestival(festivalId: number | string): Observable<ZonePlanDto[]> {
    return this.http.get<ZonePlanDto[]>(`${environment.apiUrl}/zone-plans`, {
      params: { festival_id: festivalId },
      withCredentials: true,
    });
  }

  create(payload: Omit<ZonePlanDto, 'id'>): Observable<any> {
    return this.http.post(`${environment.apiUrl}/zone-plans`, payload, { withCredentials: true });
  }

  update(id: number | string, payload: Partial<ZonePlanDto>): Observable<any> {
    return this.http.patch(`${environment.apiUrl}/zone-plans/${id}`, payload, {
      withCredentials: true,
    });
  }

  delete(id: number | string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/zone-plans/${id}`, { withCredentials: true });
  }
}
