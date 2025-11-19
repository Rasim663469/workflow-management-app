import { TestBed } from '@angular/core/testing';
import { FestivalService } from './festival.service';

describe('FestivalService', () => {
  let service: FestivalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FestivalService);
    service.clear();
  });

  it('adds a festival card using the provided draft', () => {
    const card = service.addFestival({
      name: 'Montpellier Vibrations',
      location: 'Montpellier',
      date: '2024-05-01',
      tariffZones: [
        {
          name: 'Zone A',
          totalTables: 20,
          pricePerTable: 80,
          pricePerM2: 18,
        },
      ],
    });

    expect(service.festivals().length).toBe(1);
    expect(service.festivals()[0]).toEqual(card);
    expect(card.id).toMatch(/^festival-/);
    expect(card.displayDate).toBeTruthy();
  });

  it('hydrates the signal from a DTO list', () => {
    service.hydrateFromDtos([
      {
        id: 'festival-a',
        name: 'Jazz à Sète',
        location: 'Sète',
        date: '2024-07-12',
        tariffZones: [
          { name: 'Zone B', totalTables: 12, pricePerTable: 90, pricePerM2: 20 },
        ],
      },
    ]);

    expect(service.festivals().length).toBe(1);
    expect(service.festivals()[0].displayDate).toContain('2024');
  });
});
