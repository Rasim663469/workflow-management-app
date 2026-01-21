import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EditeurService } from '@services/editeur.service';
import { ContactFormComponent } from '../../contact/contact-form/contact-form.component';
import { EditeurJeuxComponent } from './editeur-jeux/editeur-jeux';
import { AuthService } from '@shared/auth/auth.service';

@Component({
  selector: 'app-editeur-detail',
  standalone: true,
  imports: [ContactFormComponent, EditeurJeuxComponent],
  templateUrl: './editeur-detail.html',
  styleUrl: './editeur-detail.scss'
})
export class EditeurDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly editeurService = inject(EditeurService);
  private readonly auth = inject(AuthService);

  readonly editeurId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly activeTab = signal<'contacts' | 'jeux'>('contacts');
  readonly contactDrafts = signal<Record<string, { name: string; email: string; phone: string; role: string }>>({});
  readonly editMode = signal(false);
  readonly editeurDraft = signal<{
    nom: string;
    description: string;
    type_reservant: string;
    est_reservant: boolean;
  }>({
    nom: '',
    description: '',
    type_reservant: 'editeur',
    est_reservant: true,
  });

  readonly typeOptions = [
    { value: 'editeur', label: 'Editeur' },
    { value: 'prestataire', label: 'Prestataire' },
    { value: 'boutique', label: 'Boutique' },
    { value: 'animation', label: 'Animation' },
    { value: 'association', label: 'Association' },
  ];

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

  canEditEditeur(): boolean {
    return this.auth.isSuperAdmin();
  }

  canManageContacts(): boolean {
    return this.auth.isSuperAdmin();
  }

  startEdit(): void {
    const current = this.editeur();
    if (!current) return;
    this.editeurDraft.set({
      nom: current.name ?? '',
      description: current.description ?? '',
      type_reservant: current.type_reservant ?? 'editeur',
      est_reservant: current.est_reservant ?? true,
    });
    this.editMode.set(true);
  }

  cancelEdit(): void {
    this.editMode.set(false);
  }

  saveEditeur(): void {
    if (!this.canEditEditeur()) return;
    const draft = this.editeurDraft();
    if (!draft.nom.trim()) return;
    this.editeurService.updateEditeur(this.editeurId, {
      nom: draft.nom.trim(),
      description: draft.description?.trim() || null,
      type_reservant: draft.type_reservant,
      est_reservant: draft.est_reservant,
    }).subscribe(() => {
      this.editMode.set(false);
    });
  }

  deleteEditeur(): void {
    if (!this.canEditEditeur()) return;
    if (!this.editeurId) return;
    const confirmed = window.confirm('Supprimer cet editeur ? Cette action est definitive.');
    if (!confirmed) return;
    this.editeurService.deleteEditeur(this.editeurId).subscribe(() => {
      this.router.navigate(['/editeurs']);
    });
  }

  updateEditeurDraftField(
    field: 'nom' | 'description' | 'type_reservant' | 'est_reservant',
    value: string | boolean
  ): void {
    const current = this.editeurDraft();
    this.editeurDraft.set({
      ...current,
      [field]: value as any,
    });
  }

  addContact(payload: { name: string; email: string; phone?: string; role?: string }): void {
    if (!this.canManageContacts()) return;
    this.editeurService.addContact({ ...payload, editeurId: this.editeurId });
  }

  removeContact(contactId: string): void {
    if (!this.canManageContacts()) return;
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
    if (!this.canManageContacts()) return;
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
