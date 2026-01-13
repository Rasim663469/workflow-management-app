import { Routes } from '@angular/router';
import { authGuard } from '@shared/auth/auth.guard';
import { LoginComponent } from '@shared/auth/login/login.component';
import { AdminComponent } from './admin/admin/admin.component';
import { adminGuard } from './admin/admin.guard';
import { HomeComponent } from './home/home.component';
import { FestivalForm } from './festivals/festival-form/festival-form';
import { EditeurComponent } from './editeur/editeur';
import { EditeurJeuxComponent } from './editeur/editeur-detail/editeur-jeux/editeur-jeux';
import { EditeurDetailComponent } from './editeur/editeur-detail/editeur-detail';
import { ReservationsPageComponent } from './reservations/reservations-page/reservations-page';


export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent },
  { path: 'editeurs/:id',component: EditeurDetailComponent,
    children: [
      { path: 'jeux', component: EditeurJeuxComponent }
    ]
  },
  { path: 'editeurs', component: EditeurComponent },
  { path: 'festivals/new', component: FestivalForm, canActivate: [adminGuard] },
  { path: 'festivals/:id/edit', component: FestivalForm, canActivate: [adminGuard] },
  { path: 'reservations', component: ReservationsPageComponent, canActivate: [adminGuard] },
  { path: 'admin', component: AdminComponent, canActivate: [adminGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: '**', redirectTo: 'home' },
];
