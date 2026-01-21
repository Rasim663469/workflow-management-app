import { Routes } from '@angular/router';
import { authGuard } from '@shared/auth/auth.guard';
import { LoginComponent } from '@shared/auth/login/login.component';
import { AdminComponent } from './admin/admin/admin.component';
import { adminGuard } from './admin/admin.guard';
import { roleGuard } from '@shared/auth/role.guard';
import { HomeComponent } from './home/home.component';
import { FestivalForm } from './festivals/festival-form/festival-form';
import { EditeurComponent } from './editeur/editeur';
import { EditeurJeuxComponent } from './editeur/editeur-detail/editeur-jeux/editeur-jeux';
import { EditeurDetailComponent } from './editeur/editeur-detail/editeur-detail';
import { ReservationsPageComponent } from './reservations/reservations-page/reservations-page';
import { JeuxCatalogueComponent } from './jeux/jeux-catalogue/jeux-catalogue';
import { FestivalDetailComponent } from './festivals/festival-detail/festival-detail.component';


export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent },
  { path: 'jeux', component: JeuxCatalogueComponent },
  {
    path: 'editeurs/:id', component: EditeurDetailComponent,
    children: [
      { path: 'jeux', component: EditeurJeuxComponent }
    ]
  },
  { path: 'editeurs', component: EditeurComponent },
  {
    path: 'festivals/new',
    component: FestivalForm,
    canActivate: [roleGuard(['super_admin', 'super_organisateur'])],
  },
  {
    path: 'festivals/:id/edit',
    component: FestivalForm,
    canActivate: [roleGuard(['super_admin', 'super_organisateur'])],
  },
  { path: 'festivals/:id', component: FestivalDetailComponent },
  {
    path: 'reservations',
    component: ReservationsPageComponent,
    canActivate: [roleGuard(['super_admin', 'super_organisateur', 'organisateur'])],
  },
  { path: 'admin', component: AdminComponent, canActivate: [adminGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: '**', redirectTo: 'home' },
];
