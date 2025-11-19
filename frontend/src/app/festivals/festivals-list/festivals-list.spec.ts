import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FestivalsList } from './festivals-list';

describe('FestivalsList', () => {
  let component: FestivalsList;
  let fixture: ComponentFixture<FestivalsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FestivalsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FestivalsList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
