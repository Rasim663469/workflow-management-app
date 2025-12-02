import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditeurJeux } from './editeur-jeux';

describe('EditeurJeux', () => {
  let component: EditeurJeux;
  let fixture: ComponentFixture<EditeurJeux>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditeurJeux]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditeurJeux);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
