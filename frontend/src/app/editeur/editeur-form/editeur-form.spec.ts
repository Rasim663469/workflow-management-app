import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditeurFormComponent } from './editeur-form';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('EditeurFormComponent', () => {
    let component: EditeurFormComponent;
    let fixture: ComponentFixture<EditeurFormComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [EditeurFormComponent, HttpClientTestingModule, RouterTestingModule]
        })
            .compileComponents();

        fixture = TestBed.createComponent(EditeurFormComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
