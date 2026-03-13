import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  styleUrl: './common-pagination.component.scss',
  selector: 'joys-common-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './common-pagination.component.html'
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

  get summaryText(): string {
    if (!this.totalItems) {
      return `Showing 0 of 0 ${this.itemLabel}`;
    }

    if (this.startItem === this.endItem) {
      return `Showing ${this.startItem} of ${this.totalItems} ${this.itemLabel}`;
    }

    return `Showing ${this.startItem}-${this.endItem} of ${this.totalItems} ${this.itemLabel}`;
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
