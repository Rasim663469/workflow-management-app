import { Component, effect, inject, Input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CrmService, CrmStatus } from '@services/crm.service';

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

  readonly statuses: { value: CrmStatus; label: string }[] = [
    { value: 'pas_de_contact', label: 'Pas de contact' },
    { value: 'contact_pris', label: 'Contact pris' },
    { value: 'discussion_en_cours', label: 'Discussion en cours' },
    { value: 'sera_absent', label: 'Sera absent' },
    { value: 'considere_absent', label: 'Considéré absent' },
    { value: 'present', label: 'Présent' },
  ];

  constructor() {
    effect(() => {
      if (this.festivalId) {
        this.crmService.loadByFestival(this.festivalId);
      }
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
}
