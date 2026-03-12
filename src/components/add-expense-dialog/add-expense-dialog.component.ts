import { ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, NgZone, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { type Unsubscribe } from 'firebase/database';
import { CommonDialogAction, CommonDialogService } from '../../services/common-dialog.service';
import { CurrencyService } from '../../services/currency.service';
import { AvatarColorService } from '../../services/avatar-color.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { JoyService } from '../../services/joy.service';
import { ActivityService } from '../../services/activity.service';
import { TranslationService } from '../../services/translation.service';
import { JoyExpense, JoyGroupMember } from '../../types/joy.interface';

interface GroupMember {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
  selected: boolean;
  amount: number;
  percentage: number;
  customAmount: number;
}

interface ExpenseForm {
  title: string;
  amount: number;
  date: string;
  paidBy: string;
  splitType: 'equally' | 'percentage' | 'custom';
  members: GroupMember[];
}

@Component({
  selector: 'joys-add-expense-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <ng-template #dialogContent>
      <div class="space-y-8">
        <section class="space-y-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'addExpense.expenseTitle' | translate }}</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">shopping_bag</span>
              <input [(ngModel)]="expenseForm.title" [disabled]="isDetailsMode" class="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all outline-none disabled:opacity-70" [placeholder]="'addExpense.placeholderTitle' | translate" type="text" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-2">
              <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'addExpense.amount' | translate }}</label>
              <div class="relative">
                <span *ngIf="!usesSuffixSymbol()" class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">{{ getCurrencySymbol() }}</span>
                <input
                  [disabled]="isDetailsMode"
                  [value]="getAmountInputValue()"
                  (keydown)="onMoneyKeyDown($event)"
                  (paste)="onMoneyPaste($event)"
                  (input)="onAmountInput($event)"
                  class="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all outline-none disabled:opacity-70"
                  [ngClass]="usesSuffixSymbol() ? 'pl-4 pr-10 py-3' : 'pl-8 pr-4 py-3'"
                  [placeholder]="getMoneyPlaceholder()"
                  type="text"
                  inputmode="numeric"
                />
                <span *ngIf="usesSuffixSymbol()" class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">{{ getCurrencySymbol() }}</span>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'addExpense.date' | translate }}</label>
              <div *ngIf="isMobileViewport; else desktopDatePicker" class="relative">
                <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">calendar_today</span>
                <input [(ngModel)]="expenseForm.date" [disabled]="isDetailsMode" class="tw-date-picker w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all outline-none disabled:opacity-70" type="date" />
              </div>
              <ng-template #desktopDatePicker>
                <div class="relative">
                  <input
                    #desktopDateInput
                    [(ngModel)]="expenseForm.date"
                    type="date"
                    [disabled]="isDetailsMode"
                    class="tw-date-picker pointer-events-none absolute h-0 w-0 opacity-0"
                    tabindex="-1"
                  />
                  <button
                    type="button"
                    (click)="openDesktopDatePicker($event)"
                    [disabled]="isDetailsMode"
                    class="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition-all hover:border-primary/30 hover:shadow-md disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <span class="inline-flex items-center gap-2">
                      <span class="material-symbols-outlined text-lg text-slate-400">calendar_today</span>
                      <span>{{ getDateDisplayLabel() }}</span>
                    </span>
                    <span class="material-symbols-outlined text-slate-400">expand_more</span>
                  </button>
                </div>
              </ng-template>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'addExpense.paidBy' | translate }}</label>
            <div *ngIf="isMobileViewport; else desktopPaidByPicker" class="relative">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">person</span>
              <select [(ngModel)]="expenseForm.paidBy" [disabled]="isDetailsMode || isLoadingMembers || !expenseForm.members.length" class="w-full pl-12 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl appearance-none outline-none disabled:opacity-70">
                <option *ngFor="let member of expenseForm.members" [value]="member.name">{{ member.name }}</option>
              </select>
              <span class="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
            </div>
            <ng-template #desktopPaidByPicker>
              <div class="relative" (click)="onPaidByMenuClick($event)">
                <button
                  type="button"
                  (click)="togglePaidByMenu($event)"
                  [disabled]="isDetailsMode || isLoadingMembers || !expenseForm.members.length"
                  class="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition-all hover:border-primary/30 hover:shadow-md disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <span class="inline-flex items-center gap-2">
                    <span class="material-symbols-outlined text-lg text-slate-400">person</span>
                    <span class="truncate">{{ getPaidByDisplayLabel() }}</span>
                  </span>
                  <span class="material-symbols-outlined text-slate-400 transition-transform" [class.rotate-180]="isPaidByMenuOpen">expand_more</span>
                </button>

                <div
                  *ngIf="isPaidByMenuOpen"
                  class="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800"
                >
                  <button
                    *ngFor="let member of expenseForm.members"
                    type="button"
                    (click)="selectPaidBy(member.name)"
                    class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10 dark:hover:bg-primary/20"
                  >
                    <span class="truncate">{{ member.name }}</span>
                    <span *ngIf="expenseForm.paidBy === member.name" class="material-symbols-outlined text-base text-primary">check</span>
                  </button>
                </div>
              </div>
            </ng-template>
          </div>
        </section>

        <section class="space-y-6">
          <div class="border-t border-slate-100 dark:border-slate-800 pt-6">
            <h3 class="text-lg font-bold mb-4">{{ 'addExpense.howToSplit' | translate }}</h3>
            <div class="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button [disabled]="isDetailsMode" (click)="setSplitType('equally')" [class]="getSplitButtonClasses('equally')">{{ 'addExpense.equally' | translate }}</button>
              <button [disabled]="isDetailsMode" (click)="setSplitType('percentage')" [class]="getSplitButtonClasses('percentage')">{{ 'addExpense.percentage' | translate }}</button>
              <button [disabled]="isDetailsMode" (click)="setSplitType('custom')" [class]="getSplitButtonClasses('custom')">{{ 'addExpense.custom' | translate }}</button>
            </div>
          </div>

          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'addExpense.splitBetween' | translate }}</p>
              <button [disabled]="isDetailsMode" (click)="selectAllMembers()" class="text-xs text-primary font-bold hover:underline disabled:opacity-50">{{ 'addExpense.selectAll' | translate }}</button>
            </div>

            <div *ngIf="isLoadingMembers" class="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-500 dark:text-slate-400">{{ 'addExpense.loadingMembers' | translate }}</div>
            <div *ngIf="!isLoadingMembers && !expenseForm.members.length" class="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-3 text-sm text-slate-500 dark:text-slate-400">{{ 'addExpense.noMembers' | translate }}</div>

            <div class="space-y-3">
              <label *ngFor="let member of expenseForm.members" class="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
                <div class="flex items-center gap-3">
                  <ng-container *ngIf="member.avatar; else memberInitial">
                    <div class="w-10 h-10 rounded-full overflow-hidden">
                      <img [src]="member.avatar" [alt]="member.name + ' avatar'" class="w-full h-full object-cover" />
                    </div>
                  </ng-container>
                  <ng-template #memberInitial>
                    <div class="w-10 h-10 rounded-full text-xs font-black flex items-center justify-center" [ngClass]="getAvatarColorClasses(member.name)">{{ getInitial(member.name) }}</div>
                  </ng-template>

                  <div>
                    <p class="font-semibold text-sm">{{ member.name }}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">{{ formatAmount(member.amount) }}</p>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <ng-container *ngIf="expenseForm.splitType !== 'equally'">
                    <div class="relative w-28">
                      <input
                        [disabled]="isDetailsMode || !member.selected"
                        [value]="expenseForm.splitType === 'percentage' ? member.percentage : getCustomAmountInputValue(member)"
                        (keydown)="expenseForm.splitType === 'custom' ? onMoneyKeyDown($event) : null"
                        (paste)="expenseForm.splitType === 'custom' ? onMoneyPaste($event) : null"
                        (input)="onMemberSplitInput(member, $event)"
                        [type]="expenseForm.splitType === 'percentage' ? 'number' : 'text'"
                        min="0"
                        step="0.01"
                        [attr.inputmode]="expenseForm.splitType === 'percentage' ? 'decimal' : 'numeric'"
                        class="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                        [ngClass]="expenseForm.splitType === 'percentage' || !usesSuffixSymbol() ? 'pr-8' : 'pr-7'"
                        [placeholder]="expenseForm.splitType === 'percentage' ? '0' : getMoneyPlaceholder()"
                      />
                      <span class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                        {{ expenseForm.splitType === 'percentage' ? '%' : getCurrencySymbol() }}
                      </span>
                    </div>
                  </ng-container>

                  <input [(ngModel)]="member.selected" [disabled]="isDetailsMode" (change)="onMemberSelectionChange()" class="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary bg-white dark:bg-slate-700 disabled:opacity-60" type="checkbox" />
                </div>
              </label>
            </div>

            <div *ngIf="expenseForm.splitType === 'custom' && customAmountDiff !== 0" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
              {{ getCustomSplitMessage() }}
            </div>
          </div>
        </section>
      </div>
    </ng-template>
  `
})
export class AddExpenseDialogComponent implements OnInit, OnChanges, OnDestroy {
  @Input() joyId = '';
  @Input() groupId = '';
  @Output() closeDialog = new EventEmitter<void>();
  @Output() expenseAdded = new EventEmitter<unknown>();
  @ViewChild('dialogContent', { static: true }) dialogContent!: TemplateRef<unknown>;
  @ViewChild('desktopDateInput') desktopDateInput?: ElementRef<HTMLInputElement>;

  expenseForm: ExpenseForm = {
    title: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    paidBy: '',
    splitType: 'equally',
    members: []
  };

  isSubmitting = false;
  isLoadingMembers = false;
  isMobileViewport = false;
  isPaidByMenuOpen = false;
  dialogMode: 'create' | 'details' = 'create';
  private unsubscribeGroup: Unsubscribe | null = null;

  get isDetailsMode(): boolean {
    return this.dialogMode === 'details';
  }

  constructor(
    private readonly commonDialogService: CommonDialogService,
    private readonly currencyService: CurrencyService,
    private readonly avatarColorService: AvatarColorService,
    private readonly joyService: JoyService,
    private readonly activityService: ActivityService,
    private readonly translationService: TranslationService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.checkViewport();
    this.listenToGroupMembers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['joyId'] || changes['groupId']) {
      this.listenToGroupMembers();
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeGroup?.();
    this.unsubscribeGroup = null;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.checkViewport();
    if (this.isMobileViewport) {
      this.isPaidByMenuOpen = false;
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isPaidByMenuOpen = false;
  }

  open(): void {
    this.dialogMode = 'create';
    this.isPaidByMenuOpen = false;
    this.resetForm();
    this.commonDialogService.open({
      title: this.translationService.t('addExpense.dialogTitle'),
      icon: 'receipt_long',
      content: this.dialogContent,
      bodyClass: 'p-6',
      panelClass: 'min-h-[600px]',
      actions: this.getDialogActions(),
      onClose: () => this.handleDialogClosed()
    });
  }

  openDetails(expense: JoyExpense): void {
    this.dialogMode = 'details';
    this.isPaidByMenuOpen = false;
    this.expenseForm = {
      title: expense.title,
      amount: expense.amount,
      date: expense.date,
      paidBy: expense.paidBy,
      splitType: expense.splitType,
      members: expense.members.map((member) => ({
        id: member.id,
        name: member.name,
        avatar: member.avatar,
        email: member.email,
        selected: true,
        amount: member.shareAmount ?? 0,
        percentage: member.percentage ?? 0,
        customAmount: member.customAmount ?? member.shareAmount ?? 0
      }))
    };
    this.calculateSplit();
    this.commonDialogService.open({
      title: this.translationService.t('addExpense.detailsTitle'),
      icon: 'receipt_long',
      content: this.dialogContent,
      bodyClass: 'p-6',
      panelClass: 'min-h-[600px]',
      actions: this.getDialogActions(),
      onClose: () => this.handleDialogClosed()
    });
  }

  close(): void {
    this.commonDialogService.close();
  }

  resetForm(): void {
    this.isPaidByMenuOpen = false;
    this.expenseForm = {
      title: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      paidBy: this.expenseForm.members[0]?.name ?? '',
      splitType: 'equally',
      members: this.expenseForm.members.map((member) => ({ ...member, selected: true, amount: 0 }))
    };
    this.calculateSplit();
  }

  setSplitType(type: 'equally' | 'percentage' | 'custom'): void {
    this.expenseForm.splitType = type;
    if (type === 'percentage') {
      const selectedCount = this.expenseForm.members.filter((member) => member.selected).length;
      const evenPercent = selectedCount > 0 ? Number((100 / selectedCount).toFixed(2)) : 0;
      this.expenseForm.members.forEach((member) => {
        member.percentage = member.selected ? evenPercent : 0;
      });
    }
    if (type === 'custom') {
      this.expenseForm.members.forEach((member) => {
        member.customAmount = member.selected ? member.amount : 0;
      });
    }
    this.calculateSplit();
  }

  getSplitButtonClasses(type: string): string {
    const baseClasses = 'py-2.5 px-3 rounded-lg text-sm font-semibold transition-all';
    if (this.expenseForm.splitType === type) {
      return `${baseClasses} bg-white dark:bg-slate-700 shadow-sm text-primary`;
    }
    return `${baseClasses} hover:bg-white/50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-400`;
  }

  selectAllMembers(): void {
    const allSelected = this.expenseForm.members.every((member) => member.selected);
    this.expenseForm.members.forEach((member) => {
      member.selected = !allSelected;
    });
    this.calculateSplit();
  }

  onMemberSelectionChange(): void {
    this.normalizeMemberInputs();
    this.calculateSplit();
  }

  onAmountChange(): void {
    this.calculateSplit();
  }

  openDesktopDatePicker(event: Event): void {
    event.stopPropagation();
    if (this.isDetailsMode || this.isMobileViewport) {
      return;
    }

    const input = this.desktopDateInput?.nativeElement;
    if (!input) {
      return;
    }

    if (typeof (input as HTMLInputElement & { showPicker?: () => void }).showPicker === 'function') {
      (input as HTMLInputElement & { showPicker: () => void }).showPicker();
      return;
    }

    input.click();
  }

  togglePaidByMenu(event: Event): void {
    event.stopPropagation();
    if (this.isMobileViewport || this.isDetailsMode || this.isLoadingMembers || !this.expenseForm.members.length) {
      return;
    }

    this.isPaidByMenuOpen = !this.isPaidByMenuOpen;
  }

  onPaidByMenuClick(event: Event): void {
    event.stopPropagation();
  }

  selectPaidBy(memberName: string): void {
    this.expenseForm.paidBy = memberName;
    this.isPaidByMenuOpen = false;
  }

  getPaidByDisplayLabel(): string {
    return this.expenseForm.paidBy || this.translationService.t('addExpense.selectPayer');
  }

  getDateDisplayLabel(): string {
    if (!this.expenseForm.date) {
      return this.translationService.t('addExpense.selectDate');
    }

    const date = new Date(this.expenseForm.date);
    if (Number.isNaN(date.getTime())) {
      return this.translationService.t('addExpense.selectDate');
    }

    return date.toLocaleDateString();
  }

  onAmountInput(event: Event): void {
    const rawValue = (event.target as HTMLInputElement).value;
    this.expenseForm.amount = Math.max(0, this.currencyService.parseEditableAmount(rawValue));
    this.onAmountChange();
  }

  onMoneyKeyDown(event: KeyboardEvent): void {
    const allowedKeys = new Set([
      'Backspace',
      'Delete',
      'Tab',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End'
    ]);

    if (allowedKeys.has(event.key) || event.ctrlKey || event.metaKey) {
      return;
    }

    const isDigit = /^\d$/.test(event.key);
    const isDecimalSeparator = event.key === '.' && !this.usesSuffixSymbol();
    const input = event.target as HTMLInputElement;

    if (isDigit) {
      return;
    }

    if (isDecimalSeparator && !input.value.includes('.')) {
      return;
    }

    event.preventDefault();
  }

  onMoneyPaste(event: ClipboardEvent): void {
    const pastedText = event.clipboardData?.getData('text') ?? '';
    const parsedValue = this.currencyService.parseEditableAmount(pastedText);
    if (parsedValue <= 0 && pastedText.trim() !== '0') {
      event.preventDefault();
    }
  }

  calculateSplit(): void {
    const selectedMembers = this.expenseForm.members.filter((member) => member.selected);
    const amount = this.expenseForm.amount || 0;

    if (selectedMembers.length === 0 || amount === 0) {
      this.expenseForm.members.forEach((member) => (member.amount = 0));
      return;
    }

    if (this.expenseForm.splitType === 'equally') {
      const splitAmount = amount / selectedMembers.length;
      this.expenseForm.members.forEach((member) => {
        member.amount = member.selected ? splitAmount : 0;
      });
      return;
    }

    if (this.expenseForm.splitType === 'percentage') {
      this.expenseForm.members.forEach((member) => {
        if (!member.selected) {
          member.amount = 0;
          return;
        }
        const percent = Number.isFinite(member.percentage) ? member.percentage : 0;
        member.amount = (amount * percent) / 100;
      });
      return;
    }

    // custom
    this.expenseForm.members.forEach((member) => {
      if (!member.selected) {
        member.amount = 0;
        return;
      }
      member.amount = Number.isFinite(member.customAmount) ? member.customAmount : 0;
    });
  }

  isFormValid(): boolean {
    return !!(
      this.expenseForm.title.trim() &&
      this.expenseForm.amount > 0 &&
      this.expenseForm.date &&
      this.expenseForm.paidBy &&
      this.joyId &&
      this.groupId &&
      this.expenseForm.members.some((member) => member.selected)
    );
  }

  async onSaveExpense(): Promise<void> {
    if (!this.isFormValid()) return;

    this.isSubmitting = true;
    const expensePayload = {
      title: this.expenseForm.title,
      amount: this.expenseForm.amount,
      date: this.expenseForm.date,
      paidBy: this.expenseForm.paidBy,
      splitType: this.expenseForm.splitType,
      members: this.expenseForm.members
        .filter((member) => member.selected)
        .map((member) => {
          const payloadMember = {
            id: member.id,
            name: member.name,
            email: member.email ?? '',
            initials: this.getInitial(member.name)
          } as {
            id: string;
            name: string;
            email: string;
            initials: string;
            avatar?: string;
          };

          if (member.avatar) {
            payloadMember.avatar = member.avatar;
          }

          return payloadMember;
        }),
      groupId: this.groupId
    };

    try {
      const expense = await this.joyService.addExpenseToJoyGroup(this.joyId, this.groupId, expensePayload);
      await this.activityService.logActivity({
        type: 'add-expense',
        title: 'Added expense',
        description: `Added expense "${expensePayload.title}" (${this.formatAmount(expensePayload.amount)})`,
        joyId: this.joyId,
        groupId: this.groupId,
        metadata: {
          expenseTitle: expensePayload.title,
          amount: expensePayload.amount,
          splitType: expensePayload.splitType
        }
      });
      this.expenseAdded.emit(expense);
      this.close();
    } catch (error) {
      console.error('Failed to save expense.', error);
    } finally {
      this.isSubmitting = false;
    }
  }

  getInitial(name: string): string {
    return name?.trim()?.charAt(0)?.toUpperCase() || '?';
  }

  getAvatarColorClasses(seed: string): string {
    return this.avatarColorService.getInitialAvatarClasses(seed);
  }

  get customAmountDiff(): number {
    if (this.expenseForm.splitType !== 'custom') return 0;
    const selectedSum = this.expenseForm.members
      .filter((member) => member.selected)
      .reduce((sum, member) => sum + (Number.isFinite(member.customAmount) ? member.customAmount : 0), 0);
    return Number((this.expenseForm.amount - selectedSum).toFixed(2));
  }

  abs(value: number): number {
    return Math.abs(value);
  }

  getCustomSplitMessage(): string {
    const amount = this.formatAmount(this.abs(this.customAmountDiff));
    if (this.customAmountDiff > 0) {
      return this.translationService.t('addExpense.customNotEnough', { amount });
    }
    return this.translationService.t('addExpense.customOverTotal', { amount });
  }

  formatAmount(value: number): string {
    return this.currencyService.formatAmount(value);
  }

  getAmountInputValue(): string {
    return this.currencyService.formatEditableAmount(this.expenseForm.amount);
  }

  getCustomAmountInputValue(member: GroupMember): string {
    return this.currencyService.formatEditableAmount(member.customAmount);
  }

  getCurrencySymbol(): string {
    return this.currencyService.getCurrencySymbol();
  }

  usesSuffixSymbol(): boolean {
    return this.currencyService.usesSuffixSymbol();
  }

  getMoneyPlaceholder(): string {
    return this.currencyService.currentCurrency() === 'VND' ? '0' : '0.00';
  }

  onMemberSplitInput(member: GroupMember, event: Event): void {
    const rawValue = (event.target as HTMLInputElement).value;
    if (this.expenseForm.splitType === 'percentage') {
      const value = Number(rawValue || 0);
      member.percentage = Math.max(0, value);
    } else if (this.expenseForm.splitType === 'custom') {
      const value = this.currencyService.parseEditableAmount(rawValue);
      member.customAmount = Math.max(0, value);
    }
    this.calculateSplit();
  }

  private handleDialogClosed(): void {
    this.dialogMode = 'create';
    this.closeDialog.emit();
  }

  private getDialogActions(): CommonDialogAction[] {
    const actions: CommonDialogAction[] = [
      {
        label: this.translationService.t('addExpense.cancel'),
        kind: 'secondary',
        disabled: () => this.isSubmitting,
        handler: () => this.close()
      }
    ];

    if (!this.isDetailsMode) {
      actions.push({
        label: () => (this.isSubmitting ? this.translationService.t('addExpense.saving') : this.translationService.t('addExpense.saveExpense')),
        icon: () => (this.isSubmitting ? 'progress_activity' : 'save'),
        kind: 'primary',
        grow: true,
        disabled: () => this.isSubmitting || !this.isFormValid(),
        handler: () => {
          void this.onSaveExpense();
        }
      });
    }

    return actions;
  }

  private listenToGroupMembers(): void {
    this.unsubscribeGroup?.();

    if (!this.joyId || !this.groupId) {
      this.expenseForm.members = [];
      this.expenseForm.paidBy = '';
      this.cdr.detectChanges();
      return;
    }

    this.isLoadingMembers = true;
    this.unsubscribeGroup = this.joyService.listenToJoyGroup(
      this.joyId,
      this.groupId,
      (group) => {
        this.ngZone.run(() => {
          if (this.isDetailsMode) {
            this.isLoadingMembers = false;
            this.cdr.detectChanges();
            return;
          }
          this.expenseForm.members = (group?.members ?? []).map((member: JoyGroupMember) => ({
            id: member.id,
            name: member.name,
            avatar: member.avatar,
            email: member.email,
            selected: true,
            amount: 0,
            percentage: 0,
            customAmount: 0
          }));

          this.initializeDefaultSplitValues();
          this.expenseForm.paidBy = this.expenseForm.members[0]?.name ?? '';
          this.isPaidByMenuOpen = false;
          this.isLoadingMembers = false;
          this.calculateSplit();
          this.cdr.detectChanges();
        });
      },
      (error) => {
        this.ngZone.run(() => {
          console.error('Failed to load group members for expense.', error);
          this.expenseForm.members = [];
          this.expenseForm.paidBy = '';
          this.isLoadingMembers = false;
          this.cdr.detectChanges();
        });
      }
    );
  }

  private normalizeMemberInputs(): void {
    this.expenseForm.members.forEach((member) => {
      if (!member.selected) {
        member.amount = 0;
      }
    });
  }

  private initializeDefaultSplitValues(): void {
    const selectedCount = this.expenseForm.members.filter((member) => member.selected).length;
    const evenPercent = selectedCount > 0 ? Number((100 / selectedCount).toFixed(2)) : 0;
    this.expenseForm.members.forEach((member) => {
      member.percentage = member.selected ? evenPercent : 0;
      member.customAmount = 0;
    });
  }

  private checkViewport(): void {
    const win = (globalThis as any).window;
    this.isMobileViewport = !!win && win.innerWidth < 1024;
  }

}