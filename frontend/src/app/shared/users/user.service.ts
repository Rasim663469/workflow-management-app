import { inject, Injectable, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, finalize, catchError, of } from 'rxjs';
import { environment } from '@env/environment';
import { UserDto } from '@shared/types';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  private readonly _users  = signal<UserDto[]>([]);
  private readonly _loading = signal(false);
  private readonly _error   = signal<string | null>(null);

  readonly users   = this._users.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error   = this._error.asReadonly();

  loadAll(): void {
    this._loading.set(true);
    this._error.set(null);

    this.http.get<UserDto[]>(`${environment.apiUrl}/users`, { withCredentials: true })
      .pipe(
        catchError(err => {
          this._error.set(err.message);
          return of([] as UserDto[]); 
        })
      )
      .subscribe(data => {
        this._users.set(data ?? []);
        this._loading.set(false);
      });

  }
}
