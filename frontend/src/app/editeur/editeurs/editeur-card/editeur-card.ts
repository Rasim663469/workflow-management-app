import { Component, input, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EditeurDto } from '../editeur/editeurDTO';
import { ContactDto, CreateContactDto } from '../../../contact/contactDTO';
import { ContactFormComponent } from '../../../contact/contact-form/contact-form.component';
import { ContactComponent } from '../../../contact/contact.component';
import { EditeurService } from '@services/editeur.service';
import { AuthService } from '@shared/auth/auth.service';

@Component({
  selector: 'app-editeur-card',
  standalone: true,
  imports: [RouterLink, ContactFormComponent, ContactComponent],
  templateUrl: './editeur-card.html',
  styleUrl: './editeur-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditeurCard {
  editeur = input.required<EditeurDto>();
  editeurService = inject(EditeurService);
  authService = inject(AuthService);

  showForm = signal(false);
  showContacts = signal(false);
  associatedContacts = computed(() => {
    const all = this.editeurService.contacts();
    const currentId = this.editeur().id;
    return all.filter((c: ContactDto) => String(c.editeurId).trim() === String(currentId).trim());
  });

  onCreateContact(event: MouseEvent) {
    event.stopPropagation();
    this.showForm.update(v => !v);
    this.showContacts.set(false);
  }

  onShowContact(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault(); // Ensure no default action like scrolling or form submit

    this.showContacts.update(v => !v);
    this.showForm.set(false);

    if (this.showContacts() && this.associatedContacts().length === 0) {
      this.editeurService.loadContactsForEditeur(this.editeur().id);
    }
  }

  handleContactAdd(newContact: CreateContactDto) {
    this.editeurService.addContact({
      ...newContact,
      editeurId: this.editeur().id
    });
    this.showForm.set(false);
  }

  handleDeleteContact(contactId: string) {
    this.editeurService.deleteContact(contactId);
  }
}