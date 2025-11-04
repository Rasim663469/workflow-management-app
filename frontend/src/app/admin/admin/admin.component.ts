import { Component, effect, inject } from '@angular/core';
import { UserService } from '@shared/users/user.service';

@Component({
  selector: 'app-admin',
  imports: [],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent {
  private readonly userService = inject(UserService);
  readonly users = this.userService.users;

  constructor() {
    effect(() => this.userService.loadAll());
  }
}

