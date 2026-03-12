import { ChangeDetectorRef, Component, EventEmitter, NgZone, OnDestroy, OnInit, Output, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { type Unsubscribe } from 'firebase/database';
import {
  CommonCellDefDirective,
  CommonColumnDefDirective,
  CommonHeaderCellDefDirective,
  CommonMobileRowDefDirective,
  CommonNoDataDefDirective,
  CommonTableComponent
} from '../shared-common/common-table/common-table.component';
import { CommonPaginationComponent } from '../shared-common/common-pagination/common-pagination.component';
import { CommonDialogAction, CommonDialogService } from '../../services/common-dialog.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { JoyService } from '../../services/joy.service';
import { ActivityService } from '../../services/activity.service';
import { TranslationService } from '../../services/translation.service';
import { Joy, JoyCategory } from '../../types/joy.interface';

interface JoyForm {
  name: string;
  category: JoyCategory;
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'joys-joys-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CommonTableComponent,
    CommonColumnDefDirective,
    CommonHeaderCellDefDirective,
    CommonCellDefDirective,
    CommonMobileRowDefDirective,
    CommonNoDataDefDirective,
    CommonPaginationComponent,
    TranslatePipe
  ],
  template: `
    <div class="p-6 lg:p-8 w-full">
      <div class="flex flex-col gap-8 w-full">

        <!-- Header -->
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div class="flex flex-col gap-2">
            <h1 class="text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">{{ 'joys.title' | translate }}</h1>
            <p class="max-w-lg text-base leading-relaxed text-slate-500 dark:text-slate-400">
              {{ 'joys.subtitle' | translate }}
            </p>
          </div>
          <button
            type="button"
            (click)="openCreateJoyDialog()"
            [disabled]="isLoading"
            class="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-60"
          >
            <span class="material-symbols-outlined">auto_awesome</span>
            <span>{{ 'joys.create' | translate }}</span>
          </button>
        </div>

        <!-- Error -->
        <div *ngIf="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {{ errorMessage }}
        </div>

        <!-- Loading -->
        <div *ngIf="isLoading" class="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">
          <span class="material-symbols-outlined animate-spin text-base">progress_activity</span>
          {{ 'joys.loading' | translate }}
        </div>

        <!-- Table -->
        <joys-common-table
          [data]="pagedJoys"
          [displayedColumns]="displayedColumns"
          [rowClass]="'transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50'"
          [emptyText]="t('joys.empty')"
        >
          <ng-container appColumnDef="joyName" headerClass="min-w-[220px]">
            <ng-template appHeaderCellDef>{{ 'joys.joyName' | translate }}</ng-template>
            <ng-template appCellDef let-joy>
              <div class="flex items-center gap-3">
                <div [class]="joy.iconBg + ' h-10 w-10 rounded-lg flex shrink-0 items-center justify-center ' + joy.iconColor">
                  <span class="material-symbols-outlined text-lg">{{ joy.icon }}</span>
                </div>
                <span class="font-semibold text-slate-900 dark:text-slate-100">{{ joy.joyName }}</span>
              </div>
            </ng-template>
          </ng-container>

          <ng-container appColumnDef="category">
            <ng-template appHeaderCellDef>{{ 'joys.category' | translate }}</ng-template>
            <ng-template appCellDef let-joy>
              <span [class]="getCategoryClasses(joy.category)">{{ joy.category }}</span>
            </ng-template>
          </ng-container>

          <ng-container appColumnDef="date" cellClass="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <ng-template appHeaderCellDef>{{ 'joys.date' | translate }}</ng-template>
            <ng-template appCellDef let-joy>{{ joy.date }}</ng-template>
          </ng-container>

          <ng-container appColumnDef="action" headerClass="text-right w-36" cellClass="text-right">
            <ng-template appHeaderCellDef></ng-template>
            <ng-template appCellDef let-joy>
              <button
                type="button"
                (click)="joyRowClicked.emit(joy)"
                class="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-white"
              >
                <span class="material-symbols-outlined text-sm">dashboard</span>
                {{ 'joys.dashboard' | translate }}
              </button>
            </ng-template>
          </ng-container>

          <ng-template appMobileRowDef let-joy>
            <div
              class="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md cursor-pointer dark:border-slate-800 dark:bg-slate-900"
              (click)="joyRowClicked.emit(joy)"
            >
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <div [class]="joy.iconBg + ' h-10 w-10 rounded-lg flex shrink-0 items-center justify-center ' + joy.iconColor">
                    <span class="material-symbols-outlined">{{ joy.icon }}</span>
                  </div>
                  <div>
                    <div class="font-semibold text-slate-900 dark:text-slate-100">{{ joy.joyName }}</div>
                    <div class="mt-1 flex items-center gap-2 flex-wrap">
                      <span [class]="getCategoryClasses(joy.category)">{{ joy.category }}</span>
                      <span class="text-xs text-slate-400 dark:text-slate-500">{{ joy.date }}</span>
                    </div>
                  </div>
                </div>
                <span class="material-symbols-outlined shrink-0 text-slate-300 dark:text-slate-600">arrow_forward_ios</span>
              </div>
            </div>
          </ng-template>

          <ng-template appNoDataDef>
            <div class="flex flex-col items-center gap-3 py-4">
              <span class="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">auto_awesome</span>
              <p class="font-medium text-slate-500 dark:text-slate-400">{{ 'joys.emptyDesc' | translate }}</p>
              <button
                type="button"
                (click)="openCreateJoyDialog()"
                class="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
              >
                <span class="material-symbols-outlined text-base">add</span>
                {{ 'joys.create' | translate }}
              </button>
            </div>
          </ng-template>

          <div pagination>
            <joys-common-pagination
              [page]="currentPage"
              [pageSize]="pageSize"
              [totalItems]="joys.length"
              itemLabel="joys"
              (pageChange)="onPageChange($event)"
            ></joys-common-pagination>
          </div>
        </joys-common-table>
      </div>
    </div>

    <!-- Create Joy Dialog Template -->
    <ng-template #createJoyDialog>
      <div class="space-y-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">Joy Name</label>
          <input
            [(ngModel)]="joyForm.name"
            [disabled]="isSubmitting"
            type="text"
            placeholder="e.g., Beach Trip"
            class="w-full rounded-xl border-transparent bg-slate-50 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">Category</label>
          <select
            [(ngModel)]="joyForm.category"
            [disabled]="isSubmitting"
            class="w-full rounded-xl border-transparent bg-slate-50 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:text-slate-100"
          >
            <option *ngFor="let cat of categories" [value]="cat">{{ cat }}</option>
          </select>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">Start date</label>
            <input
              [(ngModel)]="joyForm.startDate"
              [disabled]="isSubmitting"
              type="date"
              class="tw-date-picker w-full rounded-xl border-transparent bg-slate-50 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">End date</label>
            <input
              [(ngModel)]="joyForm.endDate"
              [disabled]="isSubmitting"
              [min]="joyForm.startDate"
              type="date"
              class="tw-date-picker w-full rounded-xl border-transparent bg-slate-50 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
        <p *ngIf="dialogErrorMessage" class="text-sm text-red-600 dark:text-red-300">{{ dialogErrorMessage }}</p>
      </div>
    </ng-template>
  `
})
export class JoysTableComponent implements OnInit, OnDestroy {
  @Output() joyRowClicked = new EventEmitter<Joy>();
  @ViewChild('createJoyDialog', { static: true }) createJoyDialog!: TemplateRef<unknown>;

  joys: Joy[] = [];
  readonly displayedColumns = ['joyName', 'category', 'date', 'action'] as const;
  readonly categories: JoyCategory[] = [
    'Food', 'Dinner', 'Transport', 'Trip', 'Entertainment',
    'Utilities', 'Accommodation', 'Rent', 'Others', 'General'
  ];
  readonly pageSize = 6;
  currentPage = 1;
  isLoading = false;
  errorMessage = '';
  isSubmitting = false;
  dialogErrorMessage = '';
  joyForm: JoyForm = this.createEmptyForm();
  private unsubscribeJoys: Unsubscribe | null = null;

  constructor(
    private readonly joyService: JoyService,
    private readonly commonDialogService: CommonDialogService,
    private readonly activityService: ActivityService,
    private readonly translationService: TranslationService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadJoys();
  }

  ngOnDestroy(): void {
    this.unsubscribeJoys?.();
    this.unsubscribeJoys = null;
  }

  openCreateJoyDialog(): void {
    this.joyForm = this.createEmptyForm();
    this.dialogErrorMessage = '';
    this.commonDialogService.open({
      title: this.t('joys.createDialogTitle'),
      icon: 'auto_awesome',
      content: this.createJoyDialog,
      bodyClass: 'p-6',
      actions: this.getCreateJoyActions(),
      onClose: () => {
        this.dialogErrorMessage = '';
        this.isSubmitting = false;
        this.joyForm = this.createEmptyForm();
      }
    });
  }

  async createJoy(): Promise<void> {
    if (!this.isFormValid()) return;
    this.isSubmitting = true;
    this.dialogErrorMessage = '';
    try {
      const newJoy = await this.joyService.addJoy({
        joyName: this.joyForm.name.trim(),
        category: this.joyForm.category,
        date: this.formatJoyDateRange(),
        totalAmount: 0,
        yourShare: 0,
        status: 'Pending',
        icon: '',
        iconBg: '',
        iconColor: ''
      });
      await this.activityService.logActivity({
        type: 'create-joy',
        title: 'Created joy',
        description: `Created joy "${newJoy.joyName}"`,
        joyId: newJoy.id,
        metadata: { joyName: newJoy.joyName, category: newJoy.category }
      });
      this.commonDialogService.close();
    } catch (error) {
      console.error('Unable to create joy.', error);
      this.dialogErrorMessage = 'Unable to create joy. Please try again.';
    } finally {
      this.isSubmitting = false;
    }
  }

  get pagedJoys(): Joy[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.joys.slice(start, start + this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
  }

  getCategoryClasses(category: string): string {
    const styles = this.joyService.getCategoryStyles(category as JoyCategory);
    return `inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${styles.bgColor} ${styles.textColor} ${styles.darkBgColor} ${styles.darkTextColor}`;
  }

  private loadJoys(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.unsubscribeJoys?.();

    const loadingTimeout = setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        this.errorMessage = 'Connection timed out. Please check your network and Firebase rules, then refresh.';
        this.cdr.detectChanges();
      }
    }, 3000);

    this.unsubscribeJoys = this.joyService.listenToJoys(
      (joys) => {
        this.ngZone.run(() => {
          clearTimeout(loadingTimeout);
          this.joys = joys;
          this.ensureValidPage();
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      (error) => {
        this.ngZone.run(() => {
          clearTimeout(loadingTimeout);
          console.error('Unable to load joys.', error);
          this.errorMessage = 'Unable to load joys right now. Please refresh and try again.';
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      }
    );
  }

  private getCreateJoyActions(): CommonDialogAction[] {
    return [
      {
        label: this.t('joys.cancel'),
        kind: 'secondary',
        disabled: () => this.isSubmitting,
        handler: () => this.commonDialogService.close()
      },
      {
        label: () => (this.isSubmitting ? this.t('joys.creating') : this.t('joys.createAction')),
        icon: () => (this.isSubmitting ? 'progress_activity' : 'auto_awesome'),
        kind: 'primary',
        grow: true,
        disabled: () => this.isSubmitting || !this.isFormValid(),
        handler: () => { void this.createJoy(); }
      }
    ];
  }

  private isFormValid(): boolean {
    return !!(
      this.joyForm.name.trim() &&
      this.joyForm.category &&
      this.joyForm.startDate &&
      this.joyForm.endDate &&
      this.joyForm.startDate <= this.joyForm.endDate
    );
  }

  t(key: string): string {
    return this.translationService.t(key);
  }

  private createEmptyForm(): JoyForm {
    const today = new Date().toISOString().split('T')[0];
    return { name: '', category: 'Others', startDate: today, endDate: today };
  }

  private formatJoyDateRange(): string {
    if (this.joyForm.startDate === this.joyForm.endDate) {
      return this.joyForm.startDate;
    }

    return `${this.joyForm.startDate} → ${this.joyForm.endDate}`;
  }

  private ensureValidPage(): void {
    const totalPages = Math.max(1, Math.ceil(this.joys.length / this.pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;
  }
}
