import { ChangeDetectorRef, Component, EventEmitter, NgZone, OnDestroy, OnInit, Output, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { type Unsubscribe } from 'firebase/database';
import { Subscription } from 'rxjs';
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
import { AvatarColorService } from '../../services/avatar-color.service';
import { JoyService } from '../../services/joy.service';
import { ActivityService } from '../../services/activity.service';
import { TranslationService } from '../../services/translation.service';
import { UserSessionService } from '../../services/user-session.service';
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

        <!-- Table -->
        <joys-common-table
          [data]="pagedJoys"
          [isLoading]="isLoading"
          [loadingText]="t('joys.loading')"
          [rowClick]="handleRowClick"
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
              <span [class]="getCategoryClasses(joy.category)">{{ getCategoryLabel(joy.category) }}</span>
            </ng-template>
          </ng-container>

          <ng-container appColumnDef="date" cellClass="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <ng-template appHeaderCellDef>{{ 'joys.date' | translate }}</ng-template>
            <ng-template appCellDef let-joy>{{ joy.date }}</ng-template>
          </ng-container>

          <ng-container appColumnDef="createdBy" headerClass="min-w-[180px]">
            <ng-template appHeaderCellDef>{{ 'joys.createdBy' | translate }}</ng-template>
            <ng-template appCellDef let-joy>
              <div class="flex items-center gap-3">
                <div class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full" [ngClass]="joy.createdBy?.avatar ? '' : getCreatorAvatarClasses(joy)">
                  <img *ngIf="joy.createdBy?.avatar; else creatorInitial" [src]="joy.createdBy?.avatar" [alt]="getCreatorName(joy)" class="h-full w-full object-cover" />
                  <ng-template #creatorInitial>
                    <span class="text-[11px] font-bold">{{ getCreatorInitials(joy) }}</span>
                  </ng-template>
                </div>
                <span class="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{{ getCreatorName(joy) }}</span>
              </div>
            </ng-template>
          </ng-container>

          <ng-container appColumnDef="action" headerClass="text-right w-36" cellClass="text-right">
            <ng-template appHeaderCellDef></ng-template>
            <ng-template appCellDef let-joy>
              <button
                type="button"
                (click)="$event.stopPropagation(); joyRowClicked.emit(joy)"
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
                      <span [class]="getCategoryClasses(joy.category)">{{ getCategoryLabel(joy.category) }}</span>
                      <span class="text-xs text-slate-400 dark:text-slate-500">{{ joy.date }}</span>
                    </div>
                    <div class="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <div class="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full" [ngClass]="joy.createdBy?.avatar ? '' : getCreatorAvatarClasses(joy)">
                        <img *ngIf="joy.createdBy?.avatar; else mobileCreatorInitial" [src]="joy.createdBy?.avatar" [alt]="getCreatorName(joy)" class="h-full w-full object-cover" />
                        <ng-template #mobileCreatorInitial>
                          <span class="text-[10px] font-bold">{{ getCreatorInitials(joy) }}</span>
                        </ng-template>
                      </div>
                      <span>{{ 'joys.createdBy' | translate }}: {{ getCreatorName(joy) }}</span>
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
        <div class="flex flex-wrap gap-2.5">
            <button
              *ngFor="let cat of categories"
              type="button"
              (click)="joyForm.category = cat"
              [disabled]="isSubmitting"
              [class]="getCreateJoyCategoryClasses(cat)"
            >
              <span class="material-symbols-outlined text-[18px]">{{ getCategoryIcon(cat) }}</span>
              <span>{{ getCategoryLabel(cat) }}</span>
            </button>
          </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'common.startDate' | translate }}</label>
            <input
              [(ngModel)]="joyForm.startDate"
              [disabled]="isSubmitting"
              type="date"
              class="tw-date-picker w-full rounded-xl border-transparent bg-slate-50 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'common.endDate' | translate }}</label>
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
  readonly displayedColumns = ['joyName', 'category', 'date', 'createdBy', 'action'] as const;
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
  private userSubscription: Subscription | null = null;
  private lastSessionKey = '__uninitialized__';
  private loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private activeLoadVersion = 0;
  private readonly minimumLoadingDuration = 500;
  readonly handleRowClick = (joy: Joy): void => {
    this.joyRowClicked.emit(joy);
  };

  getCategoryLabel(category: string): string {
    return this.translationService.tCategory(category);
  }

  getCategoryIcon(category: string): string {
    const normalized = category.trim().toLowerCase();
    const categoryIconMap: Record<string, string> = {
      food: 'lunch_dining',
      dinner: 'restaurant',
      transport: 'commute',
      trip: 'flight',
      entertainment: 'movie',
      utilities: 'bolt',
      accommodation: 'hotel',
      rent: 'home_work',
      others: 'more_horiz',
      general: 'category'
    };

    return categoryIconMap[normalized] ?? 'category';
  }

  getCreateJoyCategoryClasses(category: JoyCategory): string {
    const base = 'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all disabled:opacity-60';

    if (this.joyForm.category === category) {
      return `${base} border-primary bg-primary/5 text-primary`;
    }

    return `${base} border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300`;
  }

  constructor(
    private readonly joyService: JoyService,
    private readonly commonDialogService: CommonDialogService,
    private readonly activityService: ActivityService,
    private readonly avatarColorService: AvatarColorService,
    private readonly translationService: TranslationService,
    private readonly userSessionService: UserSessionService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.userSubscription = this.userSessionService.user$.subscribe((user) => {
      const nextSessionKey = user?.uid ?? 'guest';
      if (this.lastSessionKey === nextSessionKey) {
        return;
      }

      this.lastSessionKey = nextSessionKey;
      this.loadJoys();
    });
  }

  ngOnDestroy(): void {
    this.clearLoadingTimeout();
    this.unsubscribeJoys?.();
    this.unsubscribeJoys = null;
    this.userSubscription?.unsubscribe();
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

  getCreatorName(joy: Joy): string {
    return joy.createdBy?.name || joy.createdBy?.email || 'Guest';
  }

  getCreatorInitials(joy: Joy): string {
    return this.getCreatorName(joy)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'GU';
  }

  getCreatorAvatarClasses(joy: Joy): string {
    const colorSeed = joy.createdBy?.uid || joy.createdBy?.email || this.getCreatorName(joy) || joy.id;
    return this.avatarColorService.getInitialAvatarClasses(colorSeed);
  }

  private loadJoys(): void {
    const loadVersion = ++this.activeLoadVersion;
    const loadStartedAt = Date.now();
    this.isLoading = true;
    this.errorMessage = '';
    this.clearLoadingTimeout();
    this.unsubscribeJoys?.();

    this.loadingTimeoutId = setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        this.errorMessage = 'Connection timed out. Please check your network and Firebase rules, then refresh.';
        this.cdr.detectChanges();
      }
    }, 3000);

    this.unsubscribeJoys = this.joyService.listenToJoys(
      (joys) => {
        this.ngZone.run(() => {
          this.completeLoad(loadVersion, loadStartedAt, () => {
            this.joys = joys;
            this.ensureValidPage();
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        });
      },
      (error) => {
        this.ngZone.run(() => {
          this.completeLoad(loadVersion, loadStartedAt, () => {
            console.error('Unable to load joys.', error);
            this.errorMessage = 'Unable to load joys right now. Please refresh and try again.';
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        });
      }
    );
  }

  private clearLoadingTimeout(): void {
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
      this.loadingTimeoutId = null;
    }
  }

  private completeLoad(loadVersion: number, loadStartedAt: number, apply: () => void): void {
    if (loadVersion !== this.activeLoadVersion) {
      return;
    }

    this.clearLoadingTimeout();
    const remainingDelay = Math.max(0, this.minimumLoadingDuration - (Date.now() - loadStartedAt));
    setTimeout(() => {
      if (loadVersion !== this.activeLoadVersion) {
        return;
      }

      apply();
    }, remainingDelay);
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
