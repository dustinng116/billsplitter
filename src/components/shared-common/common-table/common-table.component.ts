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
  selector: 'joys-common-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div *ngIf="isLoading" class="flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <span class="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
        <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">{{ loadingText }}</p>
      </div>

      <ng-container *ngIf="!isLoading">
      <div class="overflow-x-auto hidden lg:block">
        <ng-container [ngTemplateOutlet]="dataTable"></ng-container>
      </div>


      <div class="block lg:hidden">
        <ng-container *ngIf="mobileRowDef?.template; else mobileTableFallback">
          <div [ngClass]="{'p-4 space-y-3': data.length > 10, 'p-0 space-y-3': data.length <= 10}">
            <ng-container *ngFor="let row of data; index as i; trackBy: trackByData">
              <ng-container
                [ngTemplateOutlet]="mobileRowDef!.template"
                [ngTemplateOutletContext]="{ $implicit: row, index: i }"
              ></ng-container>
            </ng-container>

            <div *ngIf="!data.length" class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              <ng-container *ngIf="noDataDef?.template; else defaultNoDataMobile" [ngTemplateOutlet]="noDataDef!.template"></ng-container>
              <ng-template #defaultNoDataMobile>{{ emptyText }}</ng-template>
            </div>
          </div>
        </ng-container>

        <ng-template #mobileTableFallback>
          <div [ngClass]="{'overflow-x-auto p-4': data.length > 10, 'overflow-x-auto p-0': data.length <= 10}">
            <ng-container [ngTemplateOutlet]="dataTable"></ng-container>
          </div>
        </ng-template>
      </div>

      <!-- Pagination/footer: desktop always, mobile only if >10 items -->
      <div *ngIf="showFooter && (isDesktop() || data.length > 10)" class="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
        <div class="flex justify-end">
          <ng-content select="[pagination]"></ng-content>
        </div>
      </div>
      </ng-container>
    </div>

    <ng-template #dataTable>
      <table [class]="tableClass">
        <thead>
          <tr [class]="headerRowClass">
            <th
              *ngFor="let col of resolvedColumns; trackBy: trackByColumn"
              [class]="headerCellClass + (col.headerClass ? ' ' + col.headerClass : '')"
            >
              <ng-container *ngIf="col.headerCellDef?.template" [ngTemplateOutlet]="col.headerCellDef!.template"></ng-container>
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          <tr
            *ngFor="let row of data; index as i; trackBy: trackByData"
            [class]="rowClass"
            (click)="onRowSelected(row)"
          >
            <td
              *ngFor="let col of resolvedColumns; trackBy: trackByColumn"
              [class]="cellBaseClass + (col.cellClass ? ' ' + col.cellClass : '')"
            >
              <ng-container
                *ngIf="col.cellDef?.template"
                [ngTemplateOutlet]="col.cellDef!.template"
                [ngTemplateOutletContext]="{ $implicit: row, index: i }"
              ></ng-container>
            </td>
          </tr>

          <tr *ngIf="!data.length">
            <td [attr.colspan]="resolvedColumns.length || 1" class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              <ng-container *ngIf="noDataDef?.template; else defaultNoData" [ngTemplateOutlet]="noDataDef!.template"></ng-container>
              <ng-template #defaultNoData>{{ emptyText }}</ng-template>
            </td>
          </tr>
        </tbody>
      </table>
    </ng-template>
  `
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
