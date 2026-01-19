import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Festival } from '../festival/festival';
import { FestivalService } from '@services/festival.service';
import { CommonModule } from '@angular/common';

interface FestivalGame {
    id: string;
    name: string;
    auteurs?: string;
    ageMin?: number;
    ageMax?: number;
    typeJeu?: string;
    editeurName: string;
    editeurId: string;
    quantite: number;
    tablesUtilisees: number;
}

@Component({
    selector: 'app-festival-detail',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './festival-detail.component.html',
    styleUrl: './festival-detail.component.scss'
})
export class FestivalDetailComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly festivalService = inject(FestivalService);

    festival = signal<Festival | null>(null);
    games = signal<FestivalGame[]>([]);
    loading = signal(true);
    error = signal<string | null>(null);

    ngOnInit(): void {
        const id = this.route.snapshot.params['id'];
        if (id) {
            this.loadFestival(id);
            this.loadGames(id);
        }
    }

    private loadFestival(id: string): void {
        this.festivalService.getOne(id).subscribe({
            next: (dto) => {
                // Transform FestivalDto to Festival by adding display date fields
                const festival: Festival = {
                    ...dto,
                    displayDate: this.formatDate(dto.dateDebut ?? ''),
                    displayDateDebut: this.formatDate(dto.dateDebut ?? ''),
                    displayDateFin: this.formatDate(dto.dateFin ?? ''),
                };
                this.festival.set(festival);
                this.loading.set(false);
            },
            error: (err) => {
                this.error.set('Erreur lors du chargement du festival');
                this.loading.set(false);
            }
        });
    }

    private formatDate(value: string): string {
        if (!value) return '';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return value;
        return parsed.toLocaleDateString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    }

    private loadGames(id: string): void {
        this.festivalService.getGamesForFestival(id).subscribe({
            next: (data) => {
                this.games.set(data);
            },
            error: (err) => {
                console.error('Error loading games:', err);
            }
        });
    }

    groupGamesByEditor() {
        const grouped = new Map<string, FestivalGame[]>();
        this.games().forEach(game => {
            const editeurName = game.editeurName;
            if (!grouped.has(editeurName)) {
                grouped.set(editeurName, []);
            }
            grouped.get(editeurName)!.push(game);
        });
        return Array.from(grouped.entries());
    }
}
