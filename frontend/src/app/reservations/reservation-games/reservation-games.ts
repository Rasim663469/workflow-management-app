import { Component, effect, inject, Input, signal } from '@angular/core';
import { ReservationCard } from '@services/reservation.service';
import { JeuService } from '@services/jeu.service';
import { JeuFestivalService, JeuFestivalDto } from '@services/jeu-festival.service';
import { ZonePlanDto, ZonePlanService } from '@services/zone-plan.service';
import { FestivalDto } from '../../festivals/festival/festival-dto';

type DraftMap = Record<number, Partial<JeuFestivalDto>>;

@Component({
  selector: 'app-reservation-games',
  standalone: true,
  templateUrl: './reservation-games.html',
  styleUrl: './reservation-games.scss',
})
export class ReservationGamesComponent {
  private readonly jeuService = inject(JeuService);
  private readonly jeuFestivalService = inject(JeuFestivalService);
  private readonly zonePlanService = inject(ZonePlanService);

  @Input() reservation: ReservationCard | null = null;
  @Input({ required: true }) festivalId!: number | string;
  @Input() festival: FestivalDto | null = null;

  readonly jeux = this.jeuService.jeux;
  readonly games = signal<JeuFestivalDto[]>([]);
  readonly zonesPlan = signal<ZonePlanDto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly drafts = signal<DraftMap>({});
  readonly stockAlert = signal<string | null>(null);
  readonly capacityAlert = signal<string | null>(null);
  readonly unplacedAlert = signal<string | null>(null);

  readonly newGame = signal({
    jeu_id: null as number | null,
    quantite: 1,
    tables_utilisees: 1,
    type_table: 'standard',
    zone_plan_id: null as number | null,
    liste_demandee: false,
    liste_obtenue: false,
    jeux_recus: false,
  });

  constructor() {
    effect(() => {
      if (this.reservation?.editeurId) {
        this.jeuService.loadByEditeur(this.reservation.editeurId);
      }
    });
    effect(() => {
      if (this.reservation?.id) {
        this.loadGames();
      }
    });
    effect(() => {
      if (this.festivalId) {
        this.zonePlanService.listByFestival(this.festivalId).subscribe({
          next: rows => {
            this.zonesPlan.set(rows ?? []);
            this.computeAlerts();
          },
          error: () => this.zonesPlan.set([]),
        });
      }
    });
  }

  setNewGame<K extends keyof ReturnType<typeof this.newGame>>(key: K, value: ReturnType<typeof this.newGame>[K]): void {
    this.newGame.update(current => ({
      ...current,
      [key]: value,
    }));
  }

  updateDraftField(id: number, key: keyof JeuFestivalDto, value: any): void {
    this.updateDraft(id, { [key]: value });
  }

  toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    return Number(value ?? 0);
  }

  ngOnChanges(): void {
    if (this.reservation?.editeurId) {
      this.jeuService.loadByEditeur(this.reservation.editeurId);
    }
    if (this.reservation?.id) {
      this.loadGames();
    }
    if (this.festivalId) {
      this.zonePlanService.listByFestival(this.festivalId).subscribe({
        next: rows => {
          this.zonesPlan.set(rows ?? []);
          this.computeAlerts();
        },
        error: () => this.zonesPlan.set([]),
      });
    }
  }

  handleSubmit(event: Event): void {
    event.preventDefault();
    this.create();
  }

  private loadGames(): void {
    if (!this.reservation?.id) {
      this.games.set([]);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.jeuFestivalService.listByReservation(this.reservation.id).subscribe({
      next: rows => {
        this.games.set(rows ?? []);
        this.loading.set(false);
        this.computeAlerts();
      },
      error: err => {
        const message =
          err?.error?.error ?? (err instanceof Error ? err.message : 'Erreur chargement jeux');
        this.error.set(message);
        this.loading.set(false);
      },
    });
  }

  private computeAlerts(): void {
    const games = this.games();
    const zones = this.zonesPlan();
    const unplaced = games.filter(game => !game.zone_plan_id).length;
    this.unplacedAlert.set(unplaced > 0 ? `${unplaced} jeu(x) non placé(s)` : null);

    const usageByPlan = new Map<number, number>();
    for (const game of games) {
      if (!game.zone_plan_id) continue;
      const current = usageByPlan.get(game.zone_plan_id) ?? 0;
      usageByPlan.set(game.zone_plan_id, current + Number(game.tables_utilisees ?? 0));
    }
    const overPlans = zones.filter(zone => (usageByPlan.get(zone.id) ?? 0) > zone.nombre_tables);
    this.capacityAlert.set(
      overPlans.length > 0
        ? `Capacité dépassée pour ${overPlans.map(z => z.nom).join(', ')}`
        : null
    );

    if (!this.festivalId) {
      this.stockAlert.set(null);
      return;
    }
    this.jeuFestivalService.listByFestival(this.festivalId).subscribe({
      next: rows => {
        const totals = { standard: 0, grande: 0, mairie: 0 };
        for (const row of rows ?? []) {
          if (!row.zone_plan_id) continue;
          const type = (row.type_table ?? 'standard') as 'standard' | 'grande' | 'mairie';
          totals[type] += Number(row.tables_utilisees ?? 0);
        }
        const stock = this.festival;
        if (!stock) {
          this.stockAlert.set(null);
          return;
        }
        const alerts: string[] = [];
        if (totals.standard > (stock.stockTablesStandard ?? 0)) alerts.push('standard');
        if (totals.grande > (stock.stockTablesGrandes ?? 0)) alerts.push('grandes');
        if (totals.mairie > (stock.stockTablesMairie ?? 0)) alerts.push('mairie');
        this.stockAlert.set(alerts.length ? `Stock dépassé (${alerts.join(', ')})` : null);
      },
      error: () => this.stockAlert.set(null),
    });
  }

  updateDraft(id: number, patch: Partial<JeuFestivalDto>): void {
    this.drafts.update(drafts => ({
      ...drafts,
      [id]: { ...(drafts[id] ?? {}), ...patch },
    }));
  }

  saveDraft(id: number): void {
    const draft = this.drafts()[id];
    if (!draft) return;
    this.jeuFestivalService.update(id, draft).subscribe({
      next: () => {
        this.drafts.update(map => {
          const next = { ...map };
          delete next[id];
          return next;
        });
        this.loadGames();
      },
      error: err => {
        const message =
          err?.error?.error ?? (err instanceof Error ? err.message : 'Erreur mise à jour');
        this.error.set(message);
      },
    });
  }

  delete(id: number): void {
    this.jeuFestivalService.delete(id).subscribe({
      next: () => this.loadGames(),
      error: err => {
        const message =
          err?.error?.error ?? (err instanceof Error ? err.message : 'Erreur suppression');
        this.error.set(message);
      },
    });
  }

  create(): void {
    if (!this.reservation?.id) return;
    const draft = this.newGame();
    if (!draft.jeu_id) {
      this.error.set('Sélectionnez un jeu.');
      return;
    }
    this.error.set(null);
    this.jeuFestivalService
      .create({
        jeu_id: draft.jeu_id,
        reservation_id: Number(this.reservation.id),
        zone_plan_id: draft.zone_plan_id,
        quantite: Number(draft.quantite ?? 1),
        nombre_tables_allouees: Number(draft.tables_utilisees ?? 1),
        type_table: draft.type_table ?? 'standard',
        tables_utilisees: Number(draft.tables_utilisees ?? 1),
        liste_demandee: Boolean(draft.liste_demandee),
        liste_obtenue: Boolean(draft.liste_obtenue),
        jeux_recus: Boolean(draft.jeux_recus),
      })
      .subscribe({
        next: () => {
          this.newGame.set({
            jeu_id: null,
            quantite: 1,
            tables_utilisees: 1,
            type_table: 'standard',
            zone_plan_id: null,
            liste_demandee: false,
            liste_obtenue: false,
            jeux_recus: false,
          });
          this.loadGames();
        },
        error: err => {
          const message =
            err?.error?.error ?? (err instanceof Error ? err.message : 'Erreur ajout jeu');
          this.error.set(message);
        },
      });
  }
}
