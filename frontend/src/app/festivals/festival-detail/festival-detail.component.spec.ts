import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FestivalDetailComponent } from './festival-detail.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('FestivalDetailComponent', () => {
    let component: FestivalDetailComponent;
    let fixture: ComponentFixture<FestivalDetailComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [FestivalDetailComponent, HttpClientTestingModule, RouterTestingModule]
        })
            .compileComponents();

        fixture = TestBed.createComponent(FestivalDetailComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
