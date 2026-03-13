import { ChangeDetectorRef, Component, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { type Unsubscribe } from 'firebase/database';
import { Subscription } from 'rxjs';
import { AddExpenseDialogComponent } from '../add-expense-dialog/add-expense-dialog.component';
import { NewGroupDialogComponent } from '../new-group-dialog/new-group-dialog.component';
import { CommonDialogAction, CommonDialogService } from '../../services/common-dialog.service';
import { AppCurrency, CurrencyService } from '../../services/currency.service';
import { AvatarColorService } from '../../services/avatar-color.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { JoyExpense, JoyGroup } from '../../types/joy.interface';
import { JoyService } from '../../services/joy.service';
import { TranslationService } from '../../services/translation.service';
import { UserSessionService } from '../../services/user-session.service';
import { ImageUploadService } from '../../services/image-upload.service';

interface GroupExpense {
  id: string;
  description: string;
  amount: number;
  originalAmount?: number;
  currency?: string;
  paidBy: string;
  date: string;
  source: JoyExpense;
}

const MOBILE_SWIPE_ACTION_WIDTH = 88;

@Component({
  styleUrl: './group-detail.component.scss',
  selector: 'joys-group-detail',
  standalone: true,
  imports: [CommonModule, AddExpenseDialogComponent, NewGroupDialogComponent, TranslatePipe],
  templateUrl: './group-detail.component.html'
})
export class GroupDetailComponent implements OnChanges, OnDestroy {
  @Output() dataLoaded = new EventEmitter<void>();
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
  private readonly userSubscription: Subscription;
  private lastSessionKey = '__uninitialized__';
  private loadVersion = 0;
  private readonly minimumLoadingDuration = 500;

  constructor(
    private readonly commonDialogService: CommonDialogService,
    private readonly currencyService: CurrencyService,
    private readonly avatarColorService: AvatarColorService,
    private readonly joyService: JoyService,
    private readonly translationService: TranslationService,
    private readonly userSessionService: UserSessionService,
    private readonly imageUploadService: ImageUploadService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.userSubscription = this.userSessionService.user$.subscribe((user) => {
      const nextSessionKey = user?.uid ?? 'guest';
      if (this.lastSessionKey === nextSessionKey) {
        return;
      }

      this.lastSessionKey = nextSessionKey;
      if (this.joyId && this.groupId) {
        this.subscribeToGroupDetail();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['joyId'] || changes['groupId']) {
      this.subscribeToGroupDetail();
    }
  }

  getCategoryLabel(category?: string | null): string {
    if (!category) {
      return this.translationService.t('groupDetail.general');
    }

    return this.translationService.tCategory(category);
  }

  ngOnDestroy(): void {
    this.unsubscribeGroup?.();
    this.unsubscribeGroup = null;
    this.unsubscribeExpenses?.();
    this.unsubscribeExpenses = null;
    this.userSubscription.unsubscribe();
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

  isUploadingPhoto = false;

  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !this.joyId || !this.groupId || !this.groupDetail) {
      return;
    }

    const file = input.files[0];
    try {
      this.isUploadingPhoto = true;
      this.cdr.detectChanges(); // spinner shows immediately
      
      const compressedFile = await this.imageUploadService.compressImage(file, 1600, 1600, 0.85);
      const imageUrl = await this.imageUploadService.uploadImage(compressedFile);
      
      // Keep existing data, just update photo field
      const updatedGroup = { ...this.groupDetail, photo: imageUrl };
      
      // The service expects Omit<JoyGroup, 'id'>, so we strip id
      const { id, ...groupDataWithoutId } = updatedGroup;
      
      await this.joyService.updateJoyGroup(this.joyId, this.groupId, groupDataWithoutId);
      
      // Update local joy reference immediately for snappy UI
      this.groupDetail.photo = imageUrl;
    } catch (error) {
      console.error('Upload failed', error);
      alert(this.translationService.t('common.uploadError'));
    } finally {
      this.isUploadingPhoto = false;
      input.value = ''; // Reset input
      this.cdr.detectChanges();
    }
  }

  openAddExpenseDialog() {
    this.addExpenseDialog.open();
  }

  openGroupDetails(group: JoyGroup) {
    this.groupDetailsDialog.openForEdit(this.joyId, group);
  }

  onGroupUpdated(group: JoyGroup) {
    if (this.groupId === group.id) {
      this.groupDetail = { ...group };
      this.cdr.detectChanges();
    }
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

  shouldShowExpenseOriginalAmount(expense: GroupExpense): boolean {
    const sourceCurrency = this.getExpenseCurrency(expense);
    return !!sourceCurrency && sourceCurrency !== this.currencyService.currentCurrency();
  }

  getExpensePrimaryAmount(expense: GroupExpense): string {
    const sourceCurrency = this.getExpenseCurrency(expense);
    const originalAmount = this.getExpenseOriginalNumericAmount(expense);
    if (sourceCurrency && sourceCurrency !== this.currencyService.currentCurrency()) {
      return this.currencyService.formatAmount(this.currencyService.convertUsingRateHeuristic(originalAmount, sourceCurrency as AppCurrency));
    }

    return this.formatAmount(expense.amount);
  }

  getExpenseOriginalAmount(expense: GroupExpense): string {
    const sourceCurrency = this.getExpenseCurrency(expense);
    const originalAmount = this.getExpenseOriginalNumericAmount(expense);
    if (!sourceCurrency) {
      return this.formatAmount(expense.amount);
    }

    return this.currencyService.formatAmountInCurrency(originalAmount, sourceCurrency as AppCurrency);
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
    const currentLoadVersion = ++this.loadVersion;
    const loadStartedAt = Date.now();
    let groupResolved = false;
    let expensesResolved = false;

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

    const tryFinishLoading = () => {
      if (!groupResolved || !expensesResolved || currentLoadVersion !== this.loadVersion) {
        return;
      }

      const remainingDelay = Math.max(0, this.minimumLoadingDuration - (Date.now() - loadStartedAt));
      setTimeout(() => {
        if (currentLoadVersion !== this.loadVersion) {
          return;
        }

        this.isLoading = false;
        this.cdr.detectChanges();
        this.dataLoaded.emit();
      }, remainingDelay);
    };

    this.unsubscribeGroup = this.joyService.listenToJoyGroup(
      this.joyId,
      this.groupId,
      (group) => {
        this.ngZone.run(() => {
          if (currentLoadVersion !== this.loadVersion) {
            return;
          }

          this.groupDetail = group;
          groupResolved = true;
          tryFinishLoading();
        });
      },
      (error) => {
        this.ngZone.run(() => {
          if (currentLoadVersion !== this.loadVersion) {
            return;
          }

          console.error('Failed to load group detail.', error);
          this.groupDetail = null;
          this.groupExpenses = [];
          groupResolved = true;
          expensesResolved = true;
          tryFinishLoading();
        });
      }
    );

    this.unsubscribeExpenses = this.joyService.listenToJoyGroupExpenses(
      this.joyId,
      this.groupId,
      (expenses) => {
        this.ngZone.run(() => {
          if (currentLoadVersion !== this.loadVersion) {
            return;
          }

          this.groupExpenses = expenses.map((expense: JoyExpense) => ({
            id: expense.id,
            description: expense.title,
            amount: expense.amount,
            originalAmount: expense.originalAmount,
            currency: expense.currency,
            paidBy: expense.paidBy,
            date: expense.date,
            source: expense
          }));
          expensesResolved = true;
          tryFinishLoading();
        });
      },
      (error) => {
        this.ngZone.run(() => {
          if (currentLoadVersion !== this.loadVersion) {
            return;
          }

          console.error('Failed to load group expenses.', error);
          this.groupExpenses = [];
          expensesResolved = true;
          tryFinishLoading();
        });
      }
    );
  }

  private getExpenseCurrency(expense: GroupExpense): string | null {
    return expense.currency?.trim() || expense.source.currency?.trim() || null;
  }

  private getExpenseOriginalNumericAmount(expense: GroupExpense): number {
    return typeof expense.originalAmount === 'number'
      ? expense.originalAmount
      : (typeof expense.source.originalAmount === 'number' ? expense.source.originalAmount : expense.amount);
  }
}