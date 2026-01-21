import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EditeurService } from '@services/editeur.service';
import { ContactFormComponent } from '../../contact/contact-form/contact-form.component';
import { EditeurJeuxComponent } from './editeur-jeux/editeur-jeux';

@Component({
  selector: 'app-editeur-detail',
  standalone: true,
  imports: [ContactFormComponent, EditeurJeuxComponent],
  templateUrl: './editeur-detail.html',
  styleUrl: './editeur-detail.scss'
})
export class EditeurDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly editeurService = inject(EditeurService);

  readonly editeurId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly activeTab = signal<'contacts' | 'jeux'>('contacts');
  readonly contactDrafts = signal<Record<string, { name: string; email: string; phone: string; role: string }>>({});

  readonly editeur = computed(() => {
    const id = this.editeurId;
    return this.editeurService.editeurs().find(item => String(item.id) === String(id)) ?? null;
  });

  readonly contacts = computed(() =>
    this.editeurService.contacts().filter(item => String(item.editeurId) === String(this.editeurId))
  );

  constructor() {
    const childPath = this.route.snapshot.firstChild?.url?.[0]?.path;
    if (childPath === 'jeux') {
      this.activeTab.set('jeux');
    }

    effect(() => {
      this.editeurService.loadAll();
      if (this.editeurId) {
        this.editeurService.loadContactsForEditeur(this.editeurId);
      }
    });
  }

  setTab(tab: 'contacts' | 'jeux'): void {
    this.activeTab.set(tab);
  }

  addContact(payload: { name: string; email: string; phone?: string; role?: string }): void {
    this.editeurService.addContact({ ...payload, editeurId: this.editeurId });
  }

  removeContact(contactId: string): void {
    this.editeurService.deleteContact(contactId);
  }

  contactDraft(contact: { id: string; name: string; email: string; phone?: string; role?: string }) {
    const drafts = this.contactDrafts();
    if (drafts[contact.id]) return drafts[contact.id];
    return {
      name: contact.name ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      role: contact.role ?? '',
    };
  }

  updateContactDraft(contactId: string, field: 'name' | 'email' | 'phone' | 'role', value: string): void {
    const current = this.contactDrafts();
    const existing = current[contactId] ?? { name: '', email: '', phone: '', role: '' };
    this.contactDrafts.set({
      ...current,
      [contactId]: { ...existing, [field]: value },
    });
  }

  saveContact(contactId: string): void {
    const draft = this.contactDrafts()[contactId];
    if (!draft?.name || !draft?.email) return;
    this.editeurService.updateContact(contactId, draft);
    const next = { ...this.contactDrafts() };
    delete next[contactId];
    this.contactDrafts.set(next);
  }

  cancelEditContact(contactId: string): void {
    const next = { ...this.contactDrafts() };
    delete next[contactId];
    this.contactDrafts.set(next);
  }
}
