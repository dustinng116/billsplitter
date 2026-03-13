import {
  Component,
  ContentChild,
  ContentChildren,
  Directive,
  Input,
  QueryList,
  TemplateRef
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Directive({
  selector: 'ng-template[appHeaderCellDef]',
  standalone: true
})
export class CommonHeaderCellDefDirective {
  constructor(public readonly template: TemplateRef<unknown>) {}
}

@Directive({
  selector: 'ng-template[appCellDef]',
  standalone: true
})
export class CommonCellDefDirective<T = unknown> {
  constructor(public readonly template: TemplateRef<{ $implicit: T; index: number }>) {}
}

@Directive({
  selector: 'ng-container[appColumnDef]',
  standalone: true
})
export class CommonColumnDefDirective<T = unknown> {
  @Input('appColumnDef') name!: string;
  @Input() headerClass = '';
  @Input() cellClass = '';

  @ContentChild(CommonHeaderCellDefDirective) headerCellDef?: CommonHeaderCellDefDirective;
  @ContentChild(CommonCellDefDirective) cellDef?: CommonCellDefDirective<T>;
}

@Directive({
  selector: 'ng-template[appMobileRowDef]',
  standalone: true
})
export class CommonMobileRowDefDirective<T = unknown> {
  constructor(public readonly template: TemplateRef<{ $implicit: T; index: number }>) {}
}

@Directive({
  selector: 'ng-template[appNoDataDef]',
  standalone: true
})
export class CommonNoDataDefDirective {
  constructor(public readonly template: TemplateRef<unknown>) {}
}

@Component({
  styleUrl: './common-table.component.scss',
  selector: 'joys-common-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './common-table.component.html'
})
export class CommonTableComponent<T = unknown> {
  @Input() data: readonly T[] = [];
  @Input() displayedColumns: readonly string[] | null = null;
  @Input() isLoading = false;
  @Input() loadingText = 'Loading...';
  @Input() rowClick?: (row: T) => void;

  @Input() tableClass = 'w-full text-left border-collapse';
  @Input() headerRowClass =
    'bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800';
  @Input() headerCellClass =
    'px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400';
  @Input() cellBaseClass = 'px-6 py-4';
  @Input() rowClass =
    'table-row-hover hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group cursor-pointer';
  @Input() emptyText = 'No data';

  @Input() showFooter = true;

  // Helper to detect desktop (for template logic)
  isDesktop(): boolean {
    return window.innerWidth >= 1024;
  }

  @Input() trackByData: (index: number, row: T) => unknown = (index: number) => index;

  @ContentChildren(CommonColumnDefDirective) private readonly columnDefs?: QueryList<CommonColumnDefDirective<T>>;
  @ContentChild(CommonMobileRowDefDirective) readonly mobileRowDef?: CommonMobileRowDefDirective<T>;
  @ContentChild(CommonNoDataDefDirective) readonly noDataDef?: CommonNoDataDefDirective;

  trackByColumn = (_: number, col: CommonColumnDefDirective<T>) => col.name;

  onRowSelected(row: T): void {
    this.rowClick?.(row);
  }

  get resolvedColumns(): CommonColumnDefDirective<T>[] {
    const all = (this.columnDefs?.toArray() ?? []).filter((c) => !!c.name);

    if (!this.displayedColumns?.length) {
      return all;
    }

    const byName = new Map(all.map((c) => [c.name, c] as const));
    return this.displayedColumns
      .map((name) => byName.get(name))
      .filter((c): c is CommonColumnDefDirective<T> => c != null);
  }
}
