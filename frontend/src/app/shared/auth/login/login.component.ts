import { Component, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  readonly title = 'Login Page';

  readonly auth = inject(AuthService);
  readonly fb = inject(FormBuilder);
  readonly router = inject(Router);
  

  readonly form = this.fb.group({  
    username: ['', {nonNullable: true, validators: [Validators.required]}],   
    password: ['', {nonNullable: true, validators: [Validators.required]}],     
  });  

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.router.navigate(['/home']);
      }
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { username, password } = this.form.value;
    this.auth.login(username!, password!);
  }

}


