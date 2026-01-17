import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditeurCard } from './editeur-card';

describe('EditeurCard', () => {
  let component: EditeurCard;
  let fixture: ComponentFixture<EditeurCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditeurCard]
    })
      .compileComponents();

    fixture = TestBed.createComponent(EditeurCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });


});
