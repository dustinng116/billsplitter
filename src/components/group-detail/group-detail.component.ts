import { ChangeDetectorRef, Component, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { type Unsubscribe } from 'firebase/database';
import { AddExpenseDialogComponent } from '../add-expense-dialog/add-expense-dialog.component';
import { NewGroupDialogComponent } from '../new-group-dialog/new-group-dialog.component';
import { CommonDialogAction, CommonDialogService } from '../../services/common-dialog.service';
import { CurrencyService } from '../../services/currency.service';
import { AvatarColorService } from '../../services/avatar-color.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { JoyExpense, JoyGroup } from '../../types/joy.interface';
import { JoyService } from '../../services/joy.service';
import { TranslationService } from '../../services/translation.service';

interface GroupExpense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  date: string;
  source: JoyExpense;
}

const MOBILE_SWIPE_ACTION_WIDTH = 88;

@Component({
  selector: 'joys-group-detail',
  standalone: true,
  imports: [CommonModule, AddExpenseDialogComponent, NewGroupDialogComponent, TranslatePipe],
  template: `
    <div class="p-4 md:p-8 max-w-6xl mx-auto">
      <ng-container *ngIf="groupDetail as group">
        <header class="md:hidden pb-4">
          <div class="flex items-center justify-between mb-2">
            <button
              type="button"
              (click)="onBack()"
              class="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              [attr.aria-label]="'groupDetail.backToGroups' | translate"
              [title]="'groupDetail.backToGroups' | translate"
            >
              <span class="material-symbols-outlined text-slate-600 dark:text-slate-400">arrow_back</span>
            </button>

            <div class="flex items-center gap-1">
              <button
                type="button"
                (click)="openGroupDetails(group)" 
                class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-primary/30 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-primary/30 dark:hover:text-primary"
                [attr.aria-label]="'groupDetail.editGroup' | translate"
                [title]="'groupDetail.editGroup' | translate"
              >
                <span class="material-symbols-outlined text-[18px]">settings</span>
              </button>
            </div>
          </div>
          <h1 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{{ group.name }}</h1>
          <p class="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">calendar_today</span>
            {{ formatDate(group.createdAt) }} • {{ group.category || ('groupDetail.general' | translate) }}
          </p>
        </header>
      </ng-container>

      <div *ngIf="isLoading" class="mb-6 rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">
        {{ 'groupDetail.loading' | translate }}
      </div>

      <div *ngIf="!isLoading && !groupDetail" class="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
        {{ 'groupDetail.notFound' | translate }}
      </div>

      <ng-container *ngIf="groupDetail as group">

      <!-- Group Hero Section -->
      <div class="hidden md:block mb-8">
        <div class="relative h-64 w-full rounded-2xl overflow-hidden shadow-sm group">
          <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent z-10"></div>
          <img
            [src]="hasImage(group.photo) ? group.photo : 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80'"
            [alt]="group.name"
            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div class="absolute bottom-0 left-0 p-8 z-20 w-full flex justify-between items-end">
            <div>
              <h2 class="text-white text-4xl font-black tracking-tight mb-2">{{ group.name }}</h2>
              <div class="flex items-center gap-2 text-white/90">
                <span class="material-symbols-outlined text-sm">calendar_today</span>
                <span class="text-sm font-medium">{{ formatDate(group.createdAt) }} • {{ group.category || ('groupDetail.general' | translate) }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="onBack()"
                class="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/30 px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
              >
                <span class="material-symbols-outlined text-sm">arrow_back</span>
                {{ 'groupDetail.backToGroups' | translate }}
              </button>
              <button
                type="button"
                (click)="openGroupDetails(group)"
                class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/40 bg-white/20 text-white backdrop-blur-md transition-all hover:bg-white/30"
                [attr.aria-label]="'groupDetail.editGroup' | translate"
                [title]="'groupDetail.editGroup' | translate"
              >
                <span class="material-symbols-outlined text-[18px]">settings</span>
              </button>
              <button
                type="button"
                (click)="openAddExpenseDialog()"
                class="flex min-w-[160px] items-center justify-center rounded-xl h-10 px-5 bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all gap-2"
              >
                <span class="material-symbols-outlined text-[18px]">add_circle</span>
                <span>{{ 'groupDetail.addExpense' | translate }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Left Column: Expenses & Settlements -->
        <div class="lg:col-span-2 flex flex-col gap-6">
          <section>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg md:text-xl font-bold text-slate-900 dark:text-white">{{ 'groupDetail.recentExpenses' | translate }}</h3>
            </div>
            <div *ngIf="groupExpenses.length; else noExpenses" class="flex flex-col gap-3">
              <ng-container *ngFor="let expense of groupExpenses">
                <div 
                  class="hidden md:flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/30 transition-all cursor-pointer"
                  (click)="onExpenseClick(expense)"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" [ngClass]="getAvatarColorClasses(expense.paidBy || expense.description)">
                      {{ firstLetter(expense.paidBy || expense.description) }}
                    </div>
                    <div>
                      <p class="font-bold">{{ expense.description }}</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                        {{ expense.date }} • {{ 'groupDetail.paidBy' | translate }} {{ expense.paidBy }}
                      </p>
                    </div>
                  </div>
                  <div class="ml-4 flex items-center gap-4">
                    <div class="text-right">
                      <p class="text-md font-bold">{{ formatAmount(expense.amount) }}</p>
                    </div>
                    <button
                      type="button"
                      (click)="requestDeleteExpense(expense, $event)"
                      class="inline-flex h-10 w-10 items-center justify-center rounded-full text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20"
                      [disabled]="deletingExpenseId === expense.id"
                      [attr.aria-label]="'groupDetail.deleteExpense' | translate"
                      [title]="'groupDetail.deleteExpense' | translate"
                    >
                      <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>

                <div class="md:hidden relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <button
                    type="button"
                    (click)="requestDeleteExpense(expense, $event)"
                    class="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-rose-500 text-white transition-all duration-200 hover:bg-rose-600"
                    [style.opacity]="getSwipeDeleteOpacity(expense.id)"
                    [style.transform]="getSwipeDeleteTransform(expense.id)"
                    [class.pointer-events-none]="!isSwipeDeleteActionEnabled(expense.id)"
                    [disabled]="deletingExpenseId === expense.id"
                    [attr.aria-label]="'groupDetail.deleteExpense' | translate"
                    [title]="'groupDetail.deleteExpense' | translate"
                  >
                    <span class="material-symbols-outlined text-[20px]">delete</span>
                  </button>

                  <div
                    class="relative z-10 flex items-center justify-between p-4 transition-transform duration-200 ease-out"
                    [style.transform]="getSwipeTransform(expense.id)"
                    (click)="onMobileExpenseClick(expense)"
                    (touchstart)="onExpenseTouchStart(expense.id, $event)"
                    (touchmove)="onExpenseTouchMove(expense.id, $event)"
                    (touchend)="onExpenseTouchEnd(expense.id)"
                    (touchcancel)="onExpenseTouchCancel()"
                  >
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" [ngClass]="getAvatarColorClasses(expense.paidBy || expense.description)">
                        {{ firstLetter(expense.paidBy || expense.description) }}
                      </div>
                      <div class="min-w-0">
                        <p class="truncate font-bold">{{ expense.description }}</p>
                        <p class="truncate text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                          {{ expense.date }} • {{ 'groupDetail.paidBy' | translate }} {{ expense.paidBy }}
                        </p>
                      </div>
                    </div>
                    <div class="ml-3 shrink-0 text-right">
                      <p class="text-md font-bold">{{ formatAmount(expense.amount) }}</p>
                    </div>
                  </div>
                </div>
              </ng-container>
            </div>
            <ng-template #noExpenses>
              <div class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                {{ 'groupDetail.noExpenses' | translate }}
              </div>
            </ng-template>
          </section>
        </div>

        <!-- Right Column: Members & Insights -->
        <div class="flex flex-col gap-6">
          <section class="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 class="text-lg font-bold mb-4">{{ 'groupDetail.members' | translate }} ({{ group.members.length }})</h3>
            <div class="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-4">
              <div 
                *ngFor="let member of group.members" 
                class="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/60 md:rounded-none md:border-0 md:bg-transparent md:p-0"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <ng-container *ngIf="hasImage(member.avatar); else memberInitial">
                    <img
                      [src]="member.avatar!"
                      [alt]="member.name"
                      class="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover"
                    />
                  </ng-container>
                  <ng-template #memberInitial>
                    <div class="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs font-black" [ngClass]="getAvatarColorClasses(member.name)">
                      {{ firstLetter(member.name) }}
                    </div>
                  </ng-template>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-bold">{{ member.name }}</p>
                    <p *ngIf="member.phone" class="md:hidden truncate text-xs text-slate-500 dark:text-slate-400">{{ member.phone }}</p>
                    <!-- <p class="hidden md:block truncate text-xs text-slate-500 dark:text-slate-400">{{ member.email }}</p> -->
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-5">
            <div>
              <h3 class="mb-2 text-base font-bold text-slate-900 dark:text-slate-100 md:text-lg">{{ 'groupDetail.groupDetails' | translate }}</h3>

              <div class="md:hidden overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <span class="whitespace-nowrap">{{ 'groupDetail.category' | translate }}:</span>
                <span class="ml-1 font-bold text-slate-900 dark:text-slate-100">{{ group.category || ('groupDetail.general' | translate) }}</span>
                <span class="mx-1">•</span>
                <span class="uppercase">{{ 'groupDetail.created' | translate }}</span>
                <span class="ml-1">{{ formatDate(group.createdAt) }}</span>
              </div>

              <div class="hidden md:block">
                <p class="mb-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300 md:text-sm">
                  {{ 'groupDetail.category' | translate }}: <span class="font-bold text-slate-900 dark:text-slate-100">{{ group.category || ('groupDetail.general' | translate) }}</span>
                </p>
                <div class="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <span class="material-symbols-outlined text-[18px]">calendar_today</span>
                  <span class="text-[11px] font-semibold uppercase tracking-wider md:text-xs">{{ 'groupDetail.created' | translate }} {{ formatDate(group.createdAt) }}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      </ng-container>
    </div>

    <!-- Add Expense Dialog -->
    <joys-add-expense-dialog #addExpenseDialog [joyId]="joyId" [groupId]="groupId" (expenseAdded)="onExpenseAdded($event)"></joys-add-expense-dialog>
    <joys-new-group-dialog #groupDetailsDialog></joys-new-group-dialog>

    <ng-template #deleteExpenseDialog>
      <div class="space-y-2">
        <p class="text-sm font-medium text-slate-900 dark:text-slate-100">
          {{ 'groupDetail.deleteExpensePrompt' | translate:{ expense: pendingDeleteExpense?.description || ('groupDetail.unknown' | translate) } }}
        </p>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          {{ formatAmount(pendingDeleteExpense?.amount || 0) }}
        </p>
      </div>
    </ng-template>
  `
})
export class GroupDetailComponent implements OnChanges, OnDestroy {
  @Input() joyId: string = '';
  @Input() groupId: string = '';
  @Output() backClicked = new EventEmitter<void>();
  @ViewChild('addExpenseDialog') addExpenseDialog!: AddExpenseDialogComponent;
  @ViewChild('groupDetailsDialog') groupDetailsDialog!: NewGroupDialogComponent;
  @ViewChild('deleteExpenseDialog', { static: true }) deleteExpenseDialog!: TemplateRef<unknown>;

  isLoading = false;
  groupDetail: JoyGroup | null = null;
  groupExpenses: GroupExpense[] = [];
  deletingExpenseId = '';
  pendingDeleteExpense: GroupExpense | null = null;
  private openedSwipeExpenseId = '';
  private draggingExpenseId = '';
  private touchStartX = 0;
  private currentSwipeOffset = 0;
  private unsubscribeGroup: Unsubscribe | null = null;
  private unsubscribeExpenses: Unsubscribe | null = null;

  constructor(
    private readonly commonDialogService: CommonDialogService,
    private readonly currencyService: CurrencyService,
    private readonly avatarColorService: AvatarColorService,
    private readonly joyService: JoyService,
    private readonly translationService: TranslationService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['joyId'] || changes['groupId']) {
      this.subscribeToGroupDetail();
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeGroup?.();
    this.unsubscribeGroup = null;
    this.unsubscribeExpenses?.();
    this.unsubscribeExpenses = null;
  }

  onBack() {
    this.backClicked.emit();
  }

  onExpenseClick(expense: GroupExpense) {
    this.addExpenseDialog.openDetails(expense.source);
  }

  onMobileExpenseClick(expense: GroupExpense): void {
    if (this.draggingExpenseId) {
      return;
    }

    if (this.openedSwipeExpenseId === expense.id) {
      this.closeSwipeActions();
      return;
    }

    this.onExpenseClick(expense);
  }

  openAddExpenseDialog() {
    this.addExpenseDialog.open();
  }

  openGroupDetails(group: JoyGroup) {
    this.groupDetailsDialog.openForEdit(this.joyId, group);
  }

  onExpenseAdded(expense: any) {
    console.log('New expense added:', expense);
  }

  requestDeleteExpense(expense: GroupExpense, event: Event): void {
    event.stopPropagation();

    if (this.deletingExpenseId === expense.id) {
      return;
    }

    this.pendingDeleteExpense = expense;
    this.commonDialogService.open({
      title: this.translationService.t('groupDetail.deleteExpenseDialogTitle'),
      icon: 'delete',
      content: this.deleteExpenseDialog,
      bodyClass: 'p-6',
      actions: this.getDeleteExpenseActions(),
      onClose: () => {
        this.pendingDeleteExpense = null;
      }
    });
  }

  async deleteExpense(expense: GroupExpense): Promise<void> {

    if (!this.joyId || !this.groupId || this.deletingExpenseId === expense.id) {
      return;
    }

    this.deletingExpenseId = expense.id;

    try {
      await this.joyService.deleteExpenseFromJoyGroup(this.joyId, this.groupId, expense.id, expense.amount);
      if (this.openedSwipeExpenseId === expense.id) {
        this.closeSwipeActions();
      }
      this.commonDialogService.close();
    } catch (error) {
      console.error('Failed to delete group expense.', error);
    } finally {
      this.deletingExpenseId = '';
      this.cdr.detectChanges();
    }
  }

  hasImage(url?: string): boolean {
    return !!url?.trim();
  }

  firstLetter(value: string): string {
    return value?.trim()?.charAt(0)?.toUpperCase() || '?';
  }

  formatDate(value: string): string {
    if (!value) return this.translationService.t('groupDetail.unknown');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return this.translationService.t('groupDetail.unknown');
    return date.toLocaleDateString();
  }

  formatAmount(value: number): string {
    return this.currencyService.formatAmount(value);
  }

  getAvatarColorClasses(seed: string): string {
    return this.avatarColorService.getInitialAvatarClasses(seed);
  }

  getSwipeTransform(expenseId: string): string {
    if (this.draggingExpenseId === expenseId) {
      return `translateX(${this.currentSwipeOffset}px)`;
    }

    if (this.openedSwipeExpenseId === expenseId) {
      return `translateX(-${MOBILE_SWIPE_ACTION_WIDTH}px)`;
    }

    return 'translateX(0px)';
  }

  isSwipeDeleteVisible(expenseId: string): boolean {
    return this.getSwipeRevealProgress(expenseId) > 0;
  }

  getSwipeDeleteOpacity(expenseId: string): string {
    return this.getSwipeRevealProgress(expenseId).toFixed(2);
  }

  getSwipeDeleteTransform(expenseId: string): string {
    const progress = this.getSwipeRevealProgress(expenseId);
    const offset = (1 - progress) * 24;
    return `translateX(${offset}px)`;
  }

  isSwipeDeleteActionEnabled(expenseId: string): boolean {
    return this.openedSwipeExpenseId === expenseId;
  }

  onExpenseTouchStart(expenseId: string, event: TouchEvent): void {
    if (this.openedSwipeExpenseId && this.openedSwipeExpenseId !== expenseId) {
      this.closeSwipeActions();
    }
    this.draggingExpenseId = expenseId;
    this.touchStartX = event.touches[0]?.clientX ?? 0;
    this.currentSwipeOffset = this.openedSwipeExpenseId === expenseId ? -MOBILE_SWIPE_ACTION_WIDTH : 0;
  }

  onExpenseTouchMove(expenseId: string, event: TouchEvent): void {
    if (this.draggingExpenseId !== expenseId) {
      return;
    }

    const currentX = event.touches[0]?.clientX ?? this.touchStartX;
    const deltaX = currentX - this.touchStartX;
    const baseOffset = this.openedSwipeExpenseId === expenseId ? -MOBILE_SWIPE_ACTION_WIDTH : 0;
    this.currentSwipeOffset = Math.max(-MOBILE_SWIPE_ACTION_WIDTH, Math.min(0, baseOffset + deltaX));
  }

  onExpenseTouchEnd(expenseId: string): void {
    if (this.draggingExpenseId !== expenseId) {
      return;
    }

    if (this.currentSwipeOffset <= -(MOBILE_SWIPE_ACTION_WIDTH / 2)) {
      this.openedSwipeExpenseId = expenseId;
    } else {
      this.openedSwipeExpenseId = '';
    }

    this.draggingExpenseId = '';
    this.currentSwipeOffset = 0;
  }

  onExpenseTouchCancel(): void {
    this.draggingExpenseId = '';
    this.currentSwipeOffset = 0;
  }

  private closeSwipeActions(): void {
    this.openedSwipeExpenseId = '';
    this.draggingExpenseId = '';
    this.currentSwipeOffset = 0;
  }

  private getSwipeRevealProgress(expenseId: string): number {
    if (this.openedSwipeExpenseId === expenseId) {
      return 1;
    }

    if (this.draggingExpenseId !== expenseId || this.currentSwipeOffset >= 0) {
      return 0;
    }

    return Math.min(1, Math.abs(this.currentSwipeOffset) / MOBILE_SWIPE_ACTION_WIDTH);
  }

  private getDeleteExpenseActions(): CommonDialogAction[] {
    return [
      {
        label: this.translationService.t('friends.cancel'),
        kind: 'secondary',
        disabled: () => !!this.deletingExpenseId,
        handler: () => this.commonDialogService.close()
      },
      {
        label: () => this.translationService.t(this.deletingExpenseId ? 'groupDetail.deletingExpense' : 'groupDetail.deleteExpense'),
        icon: () => (this.deletingExpenseId ? 'progress_activity' : 'delete'),
        kind: 'danger',
        grow: true,
        disabled: () => !!this.deletingExpenseId || !this.pendingDeleteExpense,
        handler: () => {
          if (this.pendingDeleteExpense) {
            void this.deleteExpense(this.pendingDeleteExpense);
          }
        }
      }
    ];
  }

  private subscribeToGroupDetail(): void {
    this.unsubscribeGroup?.();
    this.unsubscribeExpenses?.();

    if (!this.joyId || !this.groupId) {
      this.groupDetail = null;
      this.groupExpenses = [];
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.groupDetail = null;
    this.groupExpenses = [];

    this.unsubscribeGroup = this.joyService.listenToJoyGroup(
      this.joyId,
      this.groupId,
      (group) => {
        this.ngZone.run(() => {
          this.groupDetail = group;
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      (error) => {
        this.ngZone.run(() => {
          console.error('Failed to load group detail.', error);
          this.groupDetail = null;
          this.groupExpenses = [];
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      }
    );

    this.unsubscribeExpenses = this.joyService.listenToJoyGroupExpenses(
      this.joyId,
      this.groupId,
      (expenses) => {
        this.ngZone.run(() => {
          this.groupExpenses = expenses.map((expense: JoyExpense) => ({
            id: expense.id,
            description: expense.title,
            amount: expense.amount,
            paidBy: expense.paidBy,
            date: expense.date,
            source: expense
          }));
          this.cdr.detectChanges();
        });
      },
      (error) => {
        this.ngZone.run(() => {
          console.error('Failed to load group expenses.', error);
          this.groupExpenses = [];
          this.cdr.detectChanges();
        });
      }
    );
  }
}