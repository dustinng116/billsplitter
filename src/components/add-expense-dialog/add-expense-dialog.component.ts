import { ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, NgZone, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { type Unsubscribe } from 'firebase/database';
import { CommonDialogAction, CommonDialogService } from '../../services/common-dialog.service';
import { AppCurrency, CurrencyService } from '../../services/currency.service';
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
  initials?: string;
  selected: boolean;
  amount: number;
  percentage: number;
  customAmount: number;
}

interface ExpenseForm {
  title: string;
  amount: number;
  currency: AppCurrency;
  date: string;
  paidBy: string;
  splitType: 'equally' | 'percentage' | 'custom';
  members: GroupMember[];
}

@Component({
  styleUrl: './add-expense-dialog.component.scss',
  selector: 'joys-add-expense-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './add-expense-dialog.component.html'
})
export class AddExpenseDialogComponent implements OnInit, OnChanges, OnDestroy {
  @Input() joyId = '';
  @Input() groupId = '';
  @Input() depositSummaries: { currency: AppCurrency; total: number; remaining: number }[] = [];
  @Output() closeDialog = new EventEmitter<void>();
  @Output() expenseAdded = new EventEmitter<unknown>();
  @ViewChild('dialogContent', { static: true }) dialogContent!: TemplateRef<unknown>;
  @ViewChild('desktopDateInput') desktopDateInput?: ElementRef<HTMLInputElement>;

  expenseForm: ExpenseForm = {
    title: '',
    amount: 0,
    currency: 'VND',
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
  readonly supportedCurrencies: AppCurrency[];

  get selectedPaidByMember(): GroupMember | null {
    return this.expenseForm.members.find((member) => member.name === this.expenseForm.paidBy) ?? null;
  }

  get isDepositPaidBy(): boolean {
    return this.expenseForm.paidBy.startsWith('DEPOSIT:');
  }

  get depositLockedCurrency(): AppCurrency | null {
    if (!this.isDepositPaidBy) return null;
    return this.expenseForm.paidBy.split(':')[1] as AppCurrency;
  }

  get isCurrencyLocked(): boolean {
    return this.isDepositPaidBy && !this.isDetailsMode;
  }

  get depositPaidByOptions(): { value: string; label: string }[] {
    return this.depositSummaries
      .filter(d => d.total > 0)
      .map(d => ({
        value: `DEPOSIT:${d.currency}`,
        label: `Deposit (${this.currencyService.formatAmountInCurrency(d.remaining, d.currency)} left)`,
      }));
  }

  getPaidByDisplayLabelDeposit(): string {
    if (!this.isDepositPaidBy) return '';
    const currency = this.depositLockedCurrency;
    if (!currency) return 'Deposit';
    const summary = this.depositSummaries.find(d => d.currency === currency);
    return summary
      ? `Deposit (${this.currencyService.formatAmountInCurrency(summary.remaining, currency)} left)`
      : `Deposit in ${currency}`;
  }

  get suggestedMembers(): GroupMember[] {
    return this.expenseForm.members.slice(0, 5);
  }

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
  ) {
    this.supportedCurrencies = this.currencyService.supportedCurrencies;
    this.expenseForm.currency = this.currencyService.currentCurrency();
  }

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
    this.listenToGroupMembers();
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
      amount: expense.originalAmount ?? expense.amount,
      currency: (expense.currency as AppCurrency | undefined) ?? this.currencyService.currentCurrency(),
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
      currency: this.currencyService.currentCurrency(),
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
    // If a deposit option is selected, auto-lock the currency
    if (memberName.startsWith('DEPOSIT:')) {
      const currency = memberName.split(':')[1] as AppCurrency;
      if (currency && this.supportedCurrencies.includes(currency)) {
        this.expenseForm.currency = currency;
      }
    }
    this.isPaidByMenuOpen = false;
  }

  getPaidByDisplayLabel(): string {
    if (this.isDepositPaidBy) return this.getPaidByDisplayLabelDeposit();
    return this.expenseForm.paidBy || this.translationService.t('addExpense.selectPayer');
  }

  toggleSuggestedMember(member: GroupMember): void {
    if (this.isDetailsMode) {
      return;
    }

    member.selected = !member.selected;
    this.onMemberSelectionChange();
  }

  getSuggestedMemberChipClasses(member: GroupMember): string {
    const base = 'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all disabled:opacity-60';
    if (member.selected) {
      return `${base} border-primary bg-primary/10 text-primary`;
    }

    return `${base} border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300`;
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
    this.expenseForm.amount = Math.max(0, this.currencyService.parseEditableAmount(rawValue, this.expenseForm.currency));
    this.onAmountChange();
  }

  onExpenseCurrencyChange(currency: AppCurrency): void {
    if (this.isCurrencyLocked) return; // don't allow currency change when deposit is payer
    this.expenseForm.currency = currency;
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
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      if (selectionStart !== null && selectionEnd !== null) {
        const newValue = input.value.substring(0, selectionStart) + event.key + input.value.substring(selectionEnd);
        const decimalIndex = newValue.indexOf('.');
        if (decimalIndex !== -1 && newValue.substring(decimalIndex + 1).length > 2) {
          event.preventDefault();
          return;
        }
      }
      return;
    }

    if (isDecimalSeparator && !input.value.includes('.')) {
      return;
    }

    event.preventDefault();
  }

  onMoneyPaste(event: ClipboardEvent): void {
    const pastedText = event.clipboardData?.getData('text') ?? '';
    const parsedValue = this.currencyService.parseEditableAmount(pastedText, this.expenseForm.currency);
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
    const convertedAmount = this.currencyService.convertUsingRateHeuristic(this.expenseForm.amount, this.expenseForm.currency);
    const conversionRate = this.currencyService.getCurrencyRate(this.expenseForm.currency);
    const expensePayload = {
      title: this.expenseForm.title,
      amount: convertedAmount,
      currency: this.expenseForm.currency,
      originalAmount: this.expenseForm.amount,
      conversionRate,
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
            initials: this.getInitial(member.name),
            shareAmount: this.currencyService.convertUsingRateHeuristic(member.amount, this.expenseForm.currency),
            percentage: member.percentage,
            customAmount: this.expenseForm.splitType === 'custom'
              ? this.currencyService.convertUsingRateHeuristic(member.customAmount, this.expenseForm.currency)
              : member.customAmount
          } as {
            id: string;
            name: string;
            email: string;
            initials: string;
            avatar?: string;
            shareAmount: number;
            percentage: number;
            customAmount: number;
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
        description: `Added expense "${expensePayload.title}" (${this.expenseForm.amount} ${this.expenseForm.currency})`,
        joyId: this.joyId,
        groupId: this.groupId,
        metadata: {
          expenseTitle: expensePayload.title,
          amount: expensePayload.amount,
          originalAmount: this.expenseForm.amount,
          currency: this.expenseForm.currency,
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

  formatOriginalAmount(value: number): string {
    return this.currencyService.formatAmountInCurrency(value, this.expenseForm.currency);
  }

  formatConvertedAmount(value: number): string {
    return this.currencyService.formatAmount(this.currencyService.convertUsingRateHeuristic(value, this.expenseForm.currency));
  }

  formatConvertedMemberAmount(member: GroupMember): string {
    if (!this.shouldShowOriginalCurrency()) {
      return this.formatOriginalAmount(member.amount);
    }

    return this.formatConvertedAmount(member.amount);
  }

  formatOriginalMemberAmount(value: number): string {
    return this.formatOriginalAmount(value);
  }

  shouldShowOriginalCurrency(): boolean {
    return this.expenseForm.currency !== this.currencyService.currentCurrency();
  }

  getAmountInputValue(): string {
    return this.currencyService.formatEditableAmountByCurrency(this.expenseForm.amount, this.expenseForm.currency);
  }

  getCustomAmountInputValue(member: GroupMember): string {
    return this.currencyService.formatEditableAmountByCurrency(member.customAmount, this.expenseForm.currency);
  }

  getCurrencySymbol(): string {
    return this.currencyService.getCurrencySymbol(this.expenseForm.currency);
  }

  usesSuffixSymbol(): boolean {
    return this.currencyService.usesSuffixSymbol(this.expenseForm.currency);
  }

  getMoneyPlaceholder(): string {
    return this.currencyService.getCurrencyPlaceholder(this.expenseForm.currency);
  }

  onMemberSplitInput(member: GroupMember, event: Event): void {
    const rawValue = (event.target as HTMLInputElement).value;
    if (this.expenseForm.splitType === 'percentage') {
      const value = Number(rawValue || 0);
      member.percentage = Math.max(0, value);
    } else if (this.expenseForm.splitType === 'custom') {
      const value = this.currencyService.parseEditableAmount(rawValue, this.expenseForm.currency);
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
            initials: member.initials,
            selected: true,
            amount: 0,
            percentage: 0,
            customAmount: 0
          }));

          this.initializeDefaultSplitValues();
          if (!this.expenseForm.members.some((member) => member.name === this.expenseForm.paidBy)) {
            this.expenseForm.paidBy = this.expenseForm.members[0]?.name ?? '';
          }
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