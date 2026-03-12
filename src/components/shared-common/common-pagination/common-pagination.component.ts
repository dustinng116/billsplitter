import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'joys-common-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
      <p class="text-xs font-medium text-slate-500 dark:text-slate-400 text-center sm:text-left">
        Showing {{ startItem }} to {{ endItem }} of {{ totalItems }} {{ itemLabel }}
      </p>

      <div class="flex w-full sm:w-auto gap-2">
        <button
          type="button"
          class="flex-1 sm:flex-none rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400"
          [disabled]="page <= 1"
          (click)="goToPrevious()"
        >
          Previous
        </button>
        <button
          type="button"
          class="flex-1 sm:flex-none rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          [disabled]="page >= totalPages"
          (click)="goToNext()"
        >
          Next
        </button>
      </div>
    </div>
  `
})
export class CommonPaginationComponent {
  @Input() page = 1;
  @Input() pageSize = 10;
  @Input() totalItems = 0;
  @Input() itemLabel = 'results';

  @Output() pageChange = new EventEmitter<number>();

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get startItem(): number {
    if (!this.totalItems) {
      return 0;
    }

    return (this.page - 1) * this.pageSize + 1;
  }

  get endItem(): number {
    if (!this.totalItems) {
      return 0;
    }

    return Math.min(this.page * this.pageSize, this.totalItems);
  }

  goToPrevious() {
    if (this.page <= 1) {
      return;
    }

    this.pageChange.emit(this.page - 1);
  }

  goToNext() {
    if (this.page >= this.totalPages) {
      return;
    }

    this.pageChange.emit(this.page + 1);
  }
}
