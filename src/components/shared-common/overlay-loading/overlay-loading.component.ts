import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'joys-overlay-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="show" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 pointer-events-auto transition-opacity duration-300">
      <div class="flex flex-col items-center">
        <span class="material-symbols-outlined animate-spin text-5xl text-primary">progress_activity</span>
        <span class="mt-2 text-white text-sm font-medium">{{ message || 'Loading...' }}</span>
      </div>
    </div>
  `,
})
export class OverlayLoadingComponent {
  @Input() show = false;
  @Input() message?: string;
}
