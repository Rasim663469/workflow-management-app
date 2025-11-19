import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FestivalCard } from './festival-card';

describe('FestivalCard', () => {
  let component: FestivalCard;
  let fixture: ComponentFixture<FestivalCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FestivalCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FestivalCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
