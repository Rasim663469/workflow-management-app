import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { ContactDto } from './contactDTO';

@Component({
    selector: 'app-contact',
    standalone: true,
    imports: [],
    templateUrl: './contact.component.html',
    styleUrl: './contact.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactComponent {
    contact = input.required<ContactDto>();
    canDelete = input<boolean>(false);
    remove = output<string>();

    onDelete() {
        this.remove.emit(this.contact().id);
    }
}
