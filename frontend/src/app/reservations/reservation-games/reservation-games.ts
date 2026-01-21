import { Component, effect, inject, Input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ReservationCard } from '@services/reservation.service';
import { JeuService } from '@services/jeu.service';
import { JeuFestivalService, JeuFestivalDto } from '@services/jeu-festival.service';
import { ZonePlanDto, ZonePlanService } from '@services/zone-plan.service';
import { FestivalDto } from '../../festivals/festival/festival-dto';
import { FestivalService, FestivalStockUsageDto } from '@services/festival.service';
import { AuthService } from '@shared/auth/auth.service';

type DraftMap = Record<number, Partial<JeuFestivalDto>>;

type ReservationTypeBudget = {
  standard: number;
  grandes: number;
  mairie: number;
  total: number;
};

@Component({
  selector: 'app-reservation-games',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './reservation-games.html',
  styleUrl: './reservation-games.scss',
})
export class ReservationGamesComponent {
  private readonly jeuService = inject(JeuService);
  private readonly jeuFestivalService = inject(JeuFestivalService);
  private readonly zonePlanService = inject(ZonePlanService);
  private readonly festivalService = inject(FestivalService);
  readonly auth = inject(AuthService);

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
  readonly stockUsage = signal<FestivalStockUsageDto | null>(null);
  readonly reservationBudget = signal<ReservationTypeBudget | null>(null);

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

  remainingForZonePlan(zonePlanId: number): number | null {
    if (!this.reservation) return null;
    const zonePlan = this.zonesPlan().find(z => z.id === zonePlanId);
    if (!zonePlan) return null;
    const zoneId = zonePlan.zone_tarifaire_id;
    const reserved = (this.reservation.lignes ?? []).reduce((sum, line) => {
      if (line.zone_tarifaire_id !== zoneId) return sum;
      const tables = Number(line.nombre_tables ?? 0);
      const m2 = Number(line.surface_m2 ?? 0);
      return sum + tables + Math.ceil(m2 / 4);
    }, 0);
    const used = this.games().reduce((sum, game) => {
      if (!game.zone_plan_id) return sum;
      const gameZone = this.zonesPlan().find(z => z.id === game.zone_plan_id);
      if (!gameZone || gameZone.zone_tarifaire_id !== zoneId) return sum;
      return sum + Number(game.tables_utilisees ?? 0);
    }, 0);
    return reserved - used;
  }

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

  perGameTables(totalTables: number | null | undefined, quantity: number | null | undefined): number {
    const total = Number(totalTables ?? 0);
    const qty = Number(quantity ?? 0);
    if (!qty) return 0;
    return total / qty;
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

    this.computeReservationBudget(games, zones);

    if (!this.festivalId) {
      this.stockAlert.set(null);
      this.stockUsage.set(null);
      return;
    }
    this.festivalService.getStockUsage(this.festivalId).subscribe({
      next: data => {
        this.stockUsage.set(data);
        const alerts: string[] = [];
        if (data.remaining.standard < 0) alerts.push('standard');
        if (data.remaining.grandes < 0) alerts.push('grandes');
        if (data.remaining.mairie < 0) alerts.push('mairie');
        if (data.remaining.chaises < 0) alerts.push('chaises');
        this.stockAlert.set(alerts.length ? `Stock dépassé (${alerts.join(', ')})` : null);
      },
      error: () => {
        this.stockUsage.set(null);
        this.stockAlert.set(null);
      },
    });
  }

  private computeReservationBudget(games: JeuFestivalDto[], zones: ZonePlanDto[]): void {
    if (!this.reservation) {
      this.reservationBudget.set(null);
      return;
    }

    const reservedTotal = (this.reservation.lignes ?? []).reduce((sum, line) => {
      const tables = Number(line.nombre_tables ?? 0);
      const m2 = Number(line.surface_m2 ?? 0);
      return sum + tables + Math.ceil(m2 / 4);
    }, 0);

    const desiredGrandes = Number(this.reservation.souhaitGrandesTables ?? 0);
    const desiredMairie = Number(this.reservation.souhaitTablesMairie ?? 0);
    const desiredStandardRaw = Number(this.reservation.souhaitTablesStandard ?? 0);

    const usedByType = { standard: 0, grandes: 0, mairie: 0 };
    for (const game of games) {
      if (!game.zone_plan_id) continue;
      const type = (game.type_table ?? 'standard') as 'standard' | 'grande' | 'mairie';
      const key = type === 'grande' ? 'grandes' : type;
      usedByType[key] += Number(game.tables_utilisees ?? 0);
    }

    this.reservationBudget.set({
      standard: reservedTotal - usedByType.standard - usedByType.grandes - usedByType.mairie,
      grandes: desiredGrandes - usedByType.grandes,
      mairie: desiredMairie - usedByType.mairie,
      total: reservedTotal,
    });
  }

  updateDraft(id: number, patch: Partial<JeuFestivalDto>): void {
    if (!this.auth.canManagePlacement()) {
      return;
    }
    this.drafts.update(drafts => ({
      ...drafts,
      [id]: { ...(drafts[id] ?? {}), ...patch },
    }));
  }

  saveDraft(id: number): void {
    if (!this.auth.canManagePlacement()) {
      return;
    }
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
    if (!this.auth.canManagePlacement()) {
      return;
    }
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
    if (!this.auth.canManagePlacement()) {
      this.error.set('Vous ne pouvez pas modifier le placement des jeux.');
      return;
    }
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
