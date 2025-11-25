import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditeurDetail } from './editeur-detail';

describe('EditeurDetail', () => {
  let component: EditeurDetail;
  let fixture: ComponentFixture<EditeurDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditeurDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditeurDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
