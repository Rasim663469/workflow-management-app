import { Component, inject, output } from '@angular/core'; // Ajout de output
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms'; // Ajout de ReactiveFormsModule
import { CreateContactDto } from '../contactDTO';

@Component({
    selector: 'app-contact-form',
    standalone: true,
    imports: [ReactiveFormsModule],
    templateUrl: './contact-form.component.html',
    styleUrl: './contact-form.component.scss'
})
export class ContactFormComponent {

    readonly add = output<CreateContactDto>();
    private fb = inject(FormBuilder);

    contactForm = this.fb.group({
        name: ['', [Validators.required, Validators.minLength(2)]],
        email: ['', [Validators.required, Validators.email]],
        phone: [''],
        role: ['']
    });

    submitContact() {
        if (this.contactForm.valid) {
            this.add.emit(this.contactForm.getRawValue() as CreateContactDto);
            this.contactForm.reset();
        }
    }

}
