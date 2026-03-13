import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  styleUrl: './overlay-loading.component.scss',
  selector: 'joys-overlay-loading',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './overlay-loading.component.html',
})
export class OverlayLoadingComponent {
  @Input() show = false;
  @Input() message?: string;
}
