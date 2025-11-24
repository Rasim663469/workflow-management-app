import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditeursList } from './editeurs-list';

describe('EditeursList', () => {
  let component: EditeursList;
  let fixture: ComponentFixture<EditeursList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditeursList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditeursList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
