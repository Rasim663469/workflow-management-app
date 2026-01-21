import { Component, computed, effect, inject, Input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CrmContactDto, CrmService, CrmStatus } from '@services/crm.service';

@Component({
  selector: 'app-crm-list',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './crm-list.html',
  styleUrl: './crm-list.scss',
})
export class CrmListComponent {
  private readonly crmService = inject(CrmService);

  @Input({ required: true }) festivalId!: number | string;

  readonly rows = this.crmService.rows;
  readonly loading = this.crmService.loading;
  readonly error = this.crmService.error;
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly statusFilter = signal<'all' | CrmStatus>('all');
  readonly reservantOnly = signal(false);
  readonly typeFilter = signal<'all' | 'editeur' | 'prestataire' | 'boutique' | 'animation' | 'association'>('all');
  readonly sortBy = signal<'name' | 'last_contact' | 'contacts'>('name');
  readonly historyOpen = signal<Record<number, boolean>>({});
  readonly contactsByEditeur = signal<Record<number, CrmContactDto[]>>({});
  readonly contactsLoading = signal<Record<number, boolean>>({});
  readonly contactsError = signal<Record<number, string | null>>({});
  readonly notesDraft = signal<Record<number, string>>({});
  readonly contactDrafts = signal<Record<number, { type_contact: string; notes: string }>>({});

  readonly statuses: { value: CrmStatus; label: string }[] = [
    { value: 'pas_de_contact', label: 'Pas de contact' },
    { value: 'contact_pris', label: 'Contact pris' },
    { value: 'discussion_en_cours', label: 'Discussion en cours' },
    { value: 'sera_absent', label: 'Sera absent' },
    { value: 'considere_absent', label: 'Considéré absent' },
    { value: 'present', label: 'Présent' },
  ];
  readonly reservantTypes = [
    { value: 'editeur', label: 'Éditeur' },
    { value: 'prestataire', label: 'Prestataire' },
    { value: 'boutique', label: 'Boutique' },
    { value: 'animation', label: 'Animation' },
    { value: 'association', label: 'Association' },
  ];

  readonly contactTypes = [
    { value: 'email', label: 'Email' },
    { value: 'telephone', label: 'Téléphone' },
    { value: 'physique', label: 'Physique' },
    { value: 'autre', label: 'Autre' },
  ];
  private readonly statusLabelMap = new Map(
    this.statuses.map(status => [status.value, status.label])
  );

  readonly statusCounts = computed(() => {
    const base = {
      pas_de_contact: 0,
      contact_pris: 0,
      discussion_en_cours: 0,
      sera_absent: 0,
      considere_absent: 0,
      present: 0,
    } as Record<CrmStatus, number>;
    for (const row of this.rows()) {
      const key = (row.statut ?? 'pas_de_contact') as CrmStatus;
      base[key] = (base[key] ?? 0) + 1;
    }
    return base;
  });

  readonly filteredRows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();
    const reservantOnly = this.reservantOnly();
    const typeFilter = this.typeFilter();
    const sortBy = this.sortBy();
    let list = [...this.rows()];

    if (status !== 'all') {
      list = list.filter(row => (row.statut ?? 'pas_de_contact') === status);
    }

    if (reservantOnly) {
      list = list.filter(row => row.est_reservant !== false);
    }

    if (typeFilter !== 'all') {
      list = list.filter(row => (row.type_reservant ?? 'editeur') === typeFilter);
    }

    if (query) {
      list = list.filter(row => {
        const name = (row.editeur_nom ?? '').toLowerCase();
        const type = (row.type_reservant ?? '').toLowerCase();
        return name.includes(query) || type.includes(query);
      });
    }

    if (sortBy === 'last_contact') {
      list.sort((a, b) => {
        const aTime = a.last_contact ? new Date(a.last_contact).getTime() : 0;
        const bTime = b.last_contact ? new Date(b.last_contact).getTime() : 0;
        return bTime - aTime;
      });
    } else if (sortBy === 'contacts') {
      list.sort((a, b) => Number(b.total_contacts ?? 0) - Number(a.total_contacts ?? 0));
    } else {
      list.sort((a, b) => (a.editeur_nom ?? '').localeCompare(b.editeur_nom ?? '', 'fr'));
    }

    return list;
  });

  constructor() {
    effect(() => {
      if (this.festivalId) {
        this.crmService.loadByFestival(this.festivalId);
      }
    });
    effect(() => {
      const rows = this.rows();
      this.notesDraft.update(map => {
        const next = { ...map };
        for (const row of rows) {
          if (next[row.editeur_id] === undefined) {
            next[row.editeur_id] = row.notes ?? '';
          }
        }
        return next;
      });
      this.contactDrafts.update(map => {
        const next = { ...map };
        for (const row of rows) {
          if (!next[row.editeur_id]) {
            next[row.editeur_id] = { type_contact: 'email', notes: '' };
          }
        }
        return next;
      });
    });
  }

  ngOnChanges(): void {
    if (this.festivalId) {
      this.crmService.loadByFestival(this.festivalId);
    }
  }

  updateStatus(editeurId: number, status: CrmStatus): void {
    this.saveError.set(null);
    this.saving.set(true);
    this.crmService.updateStatus(editeurId, this.festivalId, status).subscribe({
      next: () => {
        this.crmService.loadByFestival(this.festivalId);
        this.saving.set(false);
      },
      error: err => {
        const message =
          err?.error?.error ?? (err instanceof Error ? err.message : 'Erreur CRM');
        this.saveError.set(message);
        this.saving.set(false);
      },
    });
  }

  setSearch(value: string): void {
    this.searchQuery.set(value);
  }

  setStatusFilter(value: 'all' | CrmStatus): void {
    this.statusFilter.set(value);
  }

  setTypeFilter(value: 'all' | 'editeur' | 'prestataire' | 'boutique' | 'animation' | 'association'): void {
    this.typeFilter.set(value);
  }

  toggleReservantOnly(value: boolean): void {
    this.reservantOnly.set(value);
  }

  setSort(value: 'name' | 'last_contact' | 'contacts'): void {
    this.sortBy.set(value);
  }

  markContactToday(editeurId: number): void {
    this.saveError.set(null);
    this.saving.set(true);
    const draft = this.contactDrafts()[editeurId] ?? { type_contact: 'email', notes: '' };
    this.crmService.addContact(editeurId, this.festivalId, draft.notes, draft.type_contact).subscribe({
      next: () => {
        this.crmService.updateStatus(editeurId, this.festivalId, 'contact_pris').subscribe({
          next: () => {
            this.crmService.loadByFestival(this.festivalId);
            this.refreshHistory(editeurId);
            this.saving.set(false);
          },
          error: err => {
            const message =
              err?.error?.error ?? (err instanceof Error ? err.message : 'Erreur CRM');
            this.saveError.set(message);
            this.saving.set(false);
          },
        });
      },
      error: err => {
        const message =
          err?.error?.error ?? (err instanceof Error ? err.message : 'Erreur CRM');
        this.saveError.set(message);
        this.saving.set(false);
      },
    });
  }

  updateNotes(editeurId: number, currentStatus: CrmStatus | null | undefined): void {
    const notes = (this.notesDraft()[editeurId] ?? '').trim() || null;
    const statut = (currentStatus ?? 'pas_de_contact') as CrmStatus;
    this.saveError.set(null);
    this.saving.set(true);
    this.crmService.updateStatus(editeurId, this.festivalId, statut, notes).subscribe({
      next: () => {
        this.crmService.loadByFestival(this.festivalId);
        this.saving.set(false);
      },
      error: err => {
        const message =
          err?.error?.error ?? (err instanceof Error ? err.message : 'Erreur CRM');
        this.saveError.set(message);
        this.saving.set(false);
      },
    });
  }

  setNotesDraft(editeurId: number, value: string): void {
    this.notesDraft.update(map => ({ ...map, [editeurId]: value }));
  }

  setContactDraft(editeurId: number, patch: Partial<{ type_contact: string; notes: string }>): void {
    this.contactDrafts.update(map => ({
      ...map,
      [editeurId]: { ...(map[editeurId] ?? { type_contact: 'email', notes: '' }), ...patch },
    }));
  }

  statusLabel(value?: CrmStatus | null): string {
    const key = value ?? 'pas_de_contact';
    return this.statusLabelMap.get(key) ?? 'Pas de contact';
  }

  toggleHistory(editeurId: number): void {
    const current = this.historyOpen()[editeurId] ?? false;
    this.historyOpen.update(map => ({ ...map, [editeurId]: !current }));
    if (!current) {
      this.loadHistory(editeurId);
    }
  }

  private loadHistory(editeurId: number): void {
    this.contactsLoading.update(map => ({ ...map, [editeurId]: true }));
    this.contactsError.update(map => ({ ...map, [editeurId]: null }));
    this.crmService.loadContacts(editeurId, this.festivalId).subscribe({
      next: rows => {
        this.contactsByEditeur.update(map => ({ ...map, [editeurId]: rows ?? [] }));
        this.contactsLoading.update(map => ({ ...map, [editeurId]: false }));
      },
      error: err => {
        const message =
          err?.error?.error ?? (err instanceof Error ? err.message : 'Erreur historique');
        this.contactsError.update(map => ({ ...map, [editeurId]: message }));
        this.contactsLoading.update(map => ({ ...map, [editeurId]: false }));
      },
    });
  }

  private refreshHistory(editeurId: number): void {
    if (!this.historyOpen()[editeurId]) return;
    this.loadHistory(editeurId);
  }
}
