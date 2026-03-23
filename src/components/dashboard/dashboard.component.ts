import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { type Unsubscribe } from "firebase/database";
import { Subscription } from "rxjs";
import { AddExpenseDialogComponent } from "../add-expense-dialog/add-expense-dialog.component";
import { CurrencyService, AppCurrency } from "../../services/currency.service";
import { AvatarColorService } from "../../services/avatar-color.service";
import { TranslatePipe } from "../../pipes/translate.pipe";
import { JoyService } from "../../services/joy.service";
import {
  CommonDialogAction,
  CommonDialogService,
} from "../../services/common-dialog.service";
import { TranslationService } from "../../services/translation.service";
import {
  Joy,
  JoyCategory,
  JoyChecklistItem,
  JoyDepositEntry,
  JoyFamilyGroup,
  JoyGroup,
  JoyGroupMember,
  JoyExpense,
} from "../../types/joy.interface";
import { UserSessionService } from "../../services/user-session.service";
import { ImageUploadService } from "../../services/image-upload.service";

interface SplitBillSummary {
  key: string;
  name: string;
  email: string;
  amount: number;
  isPaid: boolean;
}

interface SpenderSummary {
  key: string;
  name: string;
  totalSpent: number;
  totalEarned: number;
  isDeposit?: boolean;
  depositCurrency?: string;
  depositTotal?: number;
  depositRemaining?: number;
}

interface DepositDialogRow {
  memberId: string;
  memberName: string;
  memberEmail: string;
  currency: AppCurrency;
  amount: number | null;
}

interface SpenderDialogData {
  spenderKey: string;
  name: string;
  isDeposit: boolean;
  depositCurrency?: string;
  depositTotal?: number;
  depositRecords?: { memberName: string; amount: number; currency: string; date: string }[];
  expenses: {
    title: string;
    originalAmount: number;
    convertedAmount: number;
    currency: string;
    isPaid: boolean;
  }[];
}

interface JoyConfigForm {
  name: string;
  category: JoyCategory;
  startDate: string;
  endDate: string;
  coverImage?: string;
}

interface MatrixCell {
  amount: number;      // system currency
  origAmount: number;  // original expense currency
  currency: string;
  isPaid: boolean;
  isForeign: boolean;
  isPayer: boolean;
}

interface MatrixRow {
  expenseId: string;
  groupId: string;
  groupName: string;
  title: string;
  payerKey: string;
  payerName: string;
  totalAmount: number;
  origAmount: number;
  currency: string;
  cells: Map<string, MatrixCell>;
  allPaid: boolean;
}

interface SettlementEntry {
  fromKey: string;
  fromName: string;
  toKey: string;
  toName: string;
  amount: number;
}

interface SettlementMatrix {
  members: { key: string; name: string }[];
  rows: MatrixRow[];
  settlements: SettlementEntry[];
  memberStats: Map<string, { name: string; totalPaid: number; totalOwed: number; totalAlreadyPaid: number }>;
  netBalances: Map<string, number>;
  /** Raw per-pair debts before pairwise netting. Key = "debtorKey||creditorKey" */
  debtPairs: Map<string, number>;
}

const MOBILE_SWIPE_ACTION_WIDTH = 88;

@Component({
  styleUrl: './dashboard.component.scss',
  selector: "joys-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    AddExpenseDialogComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() joyId = "";
  @Input() searchQuery = '';
  @Output() groupClicked = new EventEmitter<string>();
  @Output() newGroupClicked = new EventEmitter<string>();
  @Output() editGroupClicked = new EventEmitter<JoyGroup>();
  @Output() backToJoysClicked = new EventEmitter<void>();
  @ViewChild("quickAddExpenseDialog")
  quickAddExpenseDialog!: AddExpenseDialogComponent;
  @ViewChild("joyConfigDialog", { static: true })
  joyConfigDialog!: TemplateRef<unknown>;
  @ViewChild("deleteGroupDialog", { static: true })
  deleteGroupDialog!: TemplateRef<unknown>;
  @ViewChild('memberDetailsDialog', { static: true })
  memberDetailsDialog!: TemplateRef<unknown>;
  @ViewChild('depositDialogContent', { static: true })
  depositDialogContent!: TemplateRef<unknown>;
  @ViewChild('mobileCoverRef') mobileCoverRef?: ElementRef<HTMLElement>;
  @ViewChild('spenderDialogContent', { static: true })
  spenderDialogContent!: TemplateRef<unknown>;
  @ViewChild('matrixDialogContent', { static: true })
  matrixDialogContent!: TemplateRef<unknown>;

  showStickyMobileHeader = false;
  private coverObserver: IntersectionObserver | null = null;

  selectedJoy: Joy | null = null;
  groupCards: JoyGroup[] = [];
  deletingGroupId = "";
  pendingDeleteGroup: JoyGroup | null = null;

  private openedSwipeGroupId = "";
  private draggingGroupId = "";
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private isMovementDetected = false;
  private currentSwipeOffset = 0;

  selectedExpenseGroupId = "";
  readonly joyCategories: JoyCategory[] = [
    "Food",
    "Dinner",
    "Transport",
    "Trip",
    "Entertainment",
    "Utilities",
    "Accommodation",
    "Rent",
    "Others",
    "General",
  ];
  joyConfigForm: JoyConfigForm = this.createEmptyJoyConfigForm();
  isSavingJoyConfig = false;
  joyConfigErrorMessage = "";
  currentUserEmail = "";

  private unsubscribeJoy: Unsubscribe | null = null;
  private unsubscribeGroups: Unsubscribe | null = null;
  private unsubscribeChecklist: Unsubscribe | null = null;
  private unsubscribeFamilyGroups: Unsubscribe | null = null;
  private groupExpensesUnsubscribers: Map<string, Unsubscribe> = new Map();
  private groupExpensesMap: Map<string, JoyExpense[]> = new Map();

  // Checklist state
  checklistItems: JoyChecklistItem[] = [];
  newChecklistText = '';
  checklistAdding = false;
  private deletingChecklistItemId = '';
  private editingChecklistItemId = '';

  // Checklist swipe state
  private checklistSwipeOpenId = '';
  private checklistDraggingId = '';
  private checklistTouchStartX = 0;
  private checklistTouchStartY = 0;
  private checklistCurrentOffset = 0;
  private checklistMovementDetected = false;

  // Member details dialog expense-level paid state
  // Key format: `${groupId}__${expenseId}` → boolean (dialog-local, current open dialog)
  dialogExpensePaidState = new Map<string, boolean>();
  // Persistent per-expense-member paid state across all dialogs
  // Key format: `${groupId}__${expenseId}__${memberKey}` → boolean
  expMemberPaidState = new Map<string, boolean>();
  currentDialogMemberKey = '';

  // Deposit state
  depositEntries: JoyDepositEntry[] = [];
  private unsubscribeDeposits: Unsubscribe | null = null;
  depositDialogRows: DepositDialogRow[] = [];
  isSavingDeposit = false;
  spenderDialogData: SpenderDialogData | null = null;
  matrixData: SettlementMatrix | null = null;
  matrixFilterKeys: string[] = [];
  matrixPayerFilterKeys: string[] = [];
  familyGroups: JoyFamilyGroup[] = [];
  newFamilyGroupName = '';
  readonly supportedCurrencies: AppCurrency[];

  private readonly userSubscription: Subscription;
  private lastSessionKey = '__uninitialized__';
  private loadVersion = 0;
  private readonly minimumLoadingDuration = 500;

  constructor(
    private readonly currencyService: CurrencyService,
    private readonly avatarColorService: AvatarColorService,
    private readonly joyService: JoyService,
    private readonly commonDialogService: CommonDialogService,
    private readonly translationService: TranslationService,
    private readonly userSessionService: UserSessionService,
    private readonly imageUploadService: ImageUploadService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.supportedCurrencies = this.currencyService.supportedCurrencies;
    this.userSubscription = this.userSessionService.user$.subscribe((user) => {
      this.currentUserEmail = user?.email?.trim().toLowerCase() ?? "";
      const nextSessionKey = user?.uid ?? 'guest';
      if (this.lastSessionKey === nextSessionKey) {
        return;
      }

      this.lastSessionKey = nextSessionKey;
      if (this.joyId) {
        this.subscribeToJoyData();
      }
    });
  }
  @Output() dataLoaded = new EventEmitter<void>();
  private lastLoadedJoyId = '';
  get totalSpent(): number {
    // Sum all expenses across groups converting each expense to system currency
    let total = 0;
    for (const [groupId, expenses] of this.groupExpensesMap.entries()) {
      for (const exp of expenses) {
        const sourceCurrency = (exp.currency as AppCurrency) ?? this.currencyService.currentCurrency();
        const original = typeof exp.originalAmount === 'number' ? exp.originalAmount : exp.amount;
        total += this.currencyService.convertUsingRateHeuristic(original, sourceCurrency);
      }
    }
    return total;
  }

  get filteredGroupCards(): JoyGroup[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.groupCards;

    return this.groupCards.filter((group) => {
      const name = (group.name || '').toLowerCase();
      const memberHit = (group.members || []).some((m) => {
        const n = (m.name || '').toLowerCase();
        const e = (m.email || '').toLowerCase();
        return n.includes(q) || e.includes(q);
      });
      return name.includes(q) || memberHit;
    });
  }

  // Tracks which member detail panels are open
  private memberDetailsOpen = new Map<string, boolean>();

  toggleMemberDetails(key: string): void {
    const current = this.memberDetailsOpen.get(key) ?? false;
    this.memberDetailsOpen.set(key, !current);
    this.cdr.detectChanges();
  }

  isMemberDetailsOpen(key: string): boolean {
    return this.memberDetailsOpen.get(key) ?? false;
  }

  getMemberExpenses(key: string): Array<{ expenseId: string; groupId: string; groupName: string; expenseTitle: string; originalAmount: number; originalCurrency: AppCurrency; convertedAmount: number; isDeposit: boolean }> {
    const results: Array<{ expenseId: string; groupId: string; groupName: string; expenseTitle: string; originalAmount: number; originalCurrency: AppCurrency; convertedAmount: number; isDeposit: boolean }> = [];

    const searchRaw = (key || '').toString();
    const search = searchRaw.trim().toLowerCase();

    for (const [groupId, expenses] of this.groupExpensesMap.entries()) {
      const group = this.groupCards.find((g) => g.id === groupId);
      const groupName = group?.name ?? '';

      for (const exp of expenses) {
        const expMembers = exp.members ?? [];
        const srcCurrency = (exp.currency as AppCurrency) ?? this.currencyService.currentCurrency();
        // originalTotal is in the expense's own currency (e.g. 140 SGD)
        const originalTotal = typeof exp.originalAmount === 'number' ? exp.originalAmount : exp.amount;
        const count = Math.max(expMembers.length, 1);

        for (const em of expMembers) {
          const memberKey = this.getMemberKey(em);
          const emEmail = (em.email || '').trim().toLowerCase();
          const emName  = (em.name  || '').trim().toLowerCase();
          const emId    = (em.id    || '').toString();

          const matches =
            memberKey === searchRaw || memberKey === search ||
            (emEmail && emEmail === search) ||
            (emId    && emId    === searchRaw) ||
            (emName  && emName  === search);

          if (!matches) continue;

          // em.shareAmount is saved ALREADY in system currency by add-expense-dialog.
          // Use it directly; do NOT pass through convertUsingRateHeuristic again.
          const convertedAmount =
            typeof em.shareAmount === 'number' && Number.isFinite(em.shareAmount) && em.shareAmount > 0
              ? em.shareAmount
              : this.currencyService.convertUsingRateHeuristic(originalTotal / count, srcCurrency);

          // Derive the original-currency share for display.
          // Ratio: member's system-currency share / total system-currency amount.
          const systemTotal = typeof exp.amount === 'number' && exp.amount > 0 ? exp.amount : convertedAmount * count;
          const shareRatio  = systemTotal > 0 ? convertedAmount / systemTotal : 1 / count;
          const originalAmount = originalTotal * shareRatio;

          results.push({
            expenseId: `${groupId}__${exp.id}`,
            groupId,
            groupName,
            expenseTitle: exp.title || '',
            originalAmount,
            originalCurrency: srcCurrency,
            convertedAmount,
            isDeposit: !!(exp.paidBy?.startsWith('DEPOSIT:')),
          });
        }
      }
    }

    return results;
  }

  openMemberDetailsDialog(item: SplitBillSummary, event?: Event): void {
    event?.stopPropagation();
    if (!this.memberDetailsDialog) return;

    // Initialise per-expense paid state for this dialog
    this.currentDialogMemberKey = item.key;
    this.dialogExpensePaidState.clear();
    for (const e of this.getMemberExpenses(item.key)) {
      // e.expenseId = `${groupId}__${exp.id}`; parse to get the actual expense member key
      const sepIdx = e.expenseId.indexOf('__');
      const groupId = e.expenseId.substring(0, sepIdx);
      const realExpId = e.expenseId.substring(sepIdx + 2);
      const expMembers = this.groupExpensesMap.get(groupId)?.find(ex => ex.id === realExpId)?.members ?? [];
      const memberKeyNorm = item.key.trim().toLowerCase();
      // Deposit expenses are always paid — no tracking needed
      if (e.isDeposit) {
        this.dialogExpensePaidState.set(e.expenseId, true);
        continue;
      }
      // Find the matching expense member and use ITS canonical key for expMemberPaidState lookup
      let isPaid = false;
      for (const em of expMembers) {
        const emKey = this.getMemberKey(em);
        const emEmailNorm = (em.email || '').trim().toLowerCase();
        const emNameNorm  = (em.name  || '').trim().toLowerCase();
        const isMatch = emKey === memberKeyNorm ||
          (emEmailNorm && emEmailNorm === memberKeyNorm) ||
          em.id === item.key ||
          (emNameNorm && emNameNorm === memberKeyNorm);
        if (isMatch) {
          const actualPairKey = `${groupId}__${realExpId}__${emKey}`;
          isPaid = this.expMemberPaidState.get(actualPairKey) ?? !!(em.isPaid);
          break;
        }
      }
      this.dialogExpensePaidState.set(e.expenseId, isPaid);
    }

    const title = this.translationService.t('dashboard.splittedExpenses') || 'Splitted Expenses';
    const closeLabel = this.translationService.t('friends.cancel') || 'Cancel';

    this.commonDialogService.open({
      title,
      content: this.memberDetailsDialog,
      context: { key: item.key, name: item.name },
      bodyClass: 'p-0',
      actions: [
        {
          label: closeLabel,
          kind: 'primary',
          grow: true,
          handler: () => this.commonDialogService.close(),
        },
      ],
      onClose: () => {
        this.currentDialogMemberKey = '';
        this.dialogExpensePaidState.clear();
        this.cdr.detectChanges();
      },
    });
  }

  isDialogExpensePaid(expenseId: string): boolean {
    return this.dialogExpensePaidState.get(expenseId) ?? false;
  }

  async toggleDialogExpensePaid(memberKey: string, expenseId: string, event: Event): Promise<void> {
    const checked = (event.target as HTMLInputElement).checked;
    // Update dialog-local state
    this.dialogExpensePaidState.set(expenseId, checked);

    // Parse expenseId → groupId + realExpenseId
    const sepIdx = expenseId.indexOf('__');
    const groupId = expenseId.substring(0, sepIdx);
    const realExpId = expenseId.substring(sepIdx + 2);

    // Optimistically update the expense member in memory
    const expenses = this.groupExpensesMap.get(groupId);
    const expense = expenses?.find(e => e.id === realExpId);
    if (expense) {
      const memberKeyNorm = memberKey.trim().toLowerCase();
      const updatedMembers = (expense.members ?? []).map(em => {
        const emKey = this.getMemberKey(em);
        const emEmailNorm = (em.email || '').trim().toLowerCase();
        const emNameNorm  = (em.name  || '').trim().toLowerCase();
        const isMatch = emKey === memberKeyNorm ||
          (emEmailNorm && emEmailNorm === memberKeyNorm) ||
          em.id === memberKey ||
          (emNameNorm && emNameNorm === memberKeyNorm);
        if (isMatch) {
          // Also make sure the key spenderSummaries uses (emKey) is registered in expMemberPaidState
          const actualPairKey = `${groupId}__${realExpId}__${emKey}`;
          this.expMemberPaidState.set(actualPairKey, checked);
          return { ...em, isPaid: checked };
        }
        return em;
      });
      expense.members = updatedMembers;
      // Persist to Firebase
      if (this.joyId) {
        try {
          await this.joyService.updateExpenseMembers(this.joyId, groupId, realExpId, updatedMembers);
        } catch (err) {
          console.error('Failed to persist expense member paid state', err);
        }
      }
    }

    // Sync outer member isPaid without cascading back down to expenses.
    // All checked → mark outer as paid; any unchecked → mark outer as unpaid.
    const allExpenses = this.getMemberExpenses(memberKey);
    // Deposit expenses are always paid; only non-deposit ones must all be checked.
    const nonDepositExpenses = allExpenses.filter(e => !e.isDeposit);
    const allChecked = allExpenses.length > 0 && (
      nonDepositExpenses.length === 0
        ? true
        : nonDepositExpenses.every(e => this.dialogExpensePaidState.get(e.expenseId) ?? false)
    );

    // Update the visual cross-line on the split-bill row and persist to groups
    // but do NOT cascade "syncExpenseLevelPaidStateForMember" again.
    const splitItem = this.splitBillSummaries.find(s => s.key === memberKey);
    if (splitItem) {
      if (allChecked && !splitItem.isPaid) {
        splitItem.isPaid = true;
        void this.setMemberPaidInGroupsOnly(memberKey, true);
      } else if (!checked && splitItem.isPaid) {
        splitItem.isPaid = false;
        void this.setMemberPaidInGroupsOnly(memberKey, false);
      }
    }

    this.cdr.detectChanges();
  }

  get dialogTotalPaid(): number {
    return this.getMemberExpenses(this.currentDialogMemberKey)
      .filter(e => e.isDeposit || (this.dialogExpensePaidState.get(e.expenseId) ?? false))
      .reduce((sum, e) => sum + e.convertedAmount, 0);
  }

  get dialogHasAnyPaid(): boolean {
    for (const e of this.getMemberExpenses(this.currentDialogMemberKey)) {
      if (e.isDeposit) return true;
      if (this.dialogExpensePaidState.get(e.expenseId) ?? false) return true;
    }
    return false;
  }

  /**
   * Updates only the group-member isPaid flag (no expense-level cascade).
   * Used by inner-dialog checkboxes to reflect back on the outer split-bill
   * without triggering another outward-inward propagation loop.
   */
  private async setMemberPaidInGroupsOnly(memberKey: string, checked: boolean): Promise<void> {
    const memberKeyNorm = memberKey.trim().toLowerCase();
    if (!this.joyId) return;

    const nextGroups = this.groupCards.map(group => {
      let changed = false;
      const nextMembers = (group.members ?? []).map(member => {
        const memKey = this.getMemberKey(member);
        const memEmail = (member.email || '').trim().toLowerCase();
        const memName  = (member.name  || '').trim().toLowerCase();
        const isMatch = memKey === memberKeyNorm ||
          (memEmail && memEmail === memberKeyNorm) ||
          member.id === memberKey ||
          (memName && memName === memberKeyNorm);
        if (isMatch && !!(member.isPaid) !== checked) {
          changed = true;
          return { ...member, isPaid: checked };
        }
        return member;
      });
      return changed ? { ...group, members: nextMembers } : group;
    });

    const changedGroups = nextGroups.filter((g, i) => g !== this.groupCards[i]);
    if (!changedGroups.length) return;

    this.groupCards = nextGroups;
    this.cdr.detectChanges();

    try {
      await Promise.all(changedGroups.map(group => {
        const { id, ...payload } = group;
        return this.joyService.updateJoyGroup(this.joyId!, id, payload);
      }));
    } catch (err) {
      console.error('Failed to update group member isPaid from dialog', err);
    }
  }

  getGroupTotal(groupId: string): number {
    const expenses = this.groupExpensesMap.get(groupId) ?? [];
    let total = 0;
    for (const exp of expenses) {
      const sourceCurrency = (exp.currency as AppCurrency) ?? this.currencyService.currentCurrency();
      const original = typeof exp.originalAmount === 'number' ? exp.originalAmount : exp.amount;
      total += this.currencyService.convertUsingRateHeuristic(original, sourceCurrency);
    }
    return total;
  }

  get isCreator(): boolean {
    if (!this.selectedJoy || !this.selectedJoy.createdBy || !this.currentUserEmail) {
      return false;
    }
    return this.selectedJoy.createdBy.email.trim().toLowerCase() === this.currentUserEmail;
  }

  isUploadingCover = false;

  async onCoverImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0 || !this.joyId) {
      return;
    }

    const file = input.files[0];
    try {
      this.isUploadingCover = true;
      this.cdr.detectChanges(); // Ensure spinner shows immediately
      
      const compressedFile = await this.imageUploadService.compressImage(file, 1600, 1600, 0.85);
      const imageUrl = await this.imageUploadService.uploadImage(compressedFile);
      
      await this.joyService.updateJoyCoverImage(this.joyId, imageUrl);
      
      // Update local joy reference immediately for snappy UI
      if (this.selectedJoy) {
        this.selectedJoy.coverImage = imageUrl;
      }
    } catch (error) {
      console.error('Upload failed', error);
      alert('Failed to upload image. Make sure your ImgBB API key is set.');
    } finally {
      this.isUploadingCover = false;
      input.value = ''; // Reset input
      this.cdr.detectChanges();
    }
  }

  get totalYouSpent(): number {
    if (!this.currentUserEmail) {
      return 0;
    }

    return this.splitBillSummaries.reduce((sum, item) => {
      if (this.normalizeIdentity(item.email) === this.currentUserEmail) {
        return sum + item.amount;
      }

      return sum;
    }, 0);
  }

  ngAfterViewInit(): void {
    this.startCoverObserver();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["joyId"]) {
      this.subscribeToJoyData();
    }
  }

  ngOnDestroy(): void {
    this.coverObserver?.disconnect();
    this.unsubscribeJoy?.();
    this.unsubscribeGroups?.();
    this.unsubscribeChecklist?.();
    this.unsubscribeFamilyGroups?.();
    this.unsubscribeDeposits?.();
    this.userSubscription.unsubscribe();
    // cleanup expense listeners
    this.groupExpensesUnsubscribers.forEach((unsub) => unsub());
    this.groupExpensesUnsubscribers.clear();
    this.groupExpensesMap.clear();
  }

  private startCoverObserver(): void {
    this.coverObserver?.disconnect();
    this.coverObserver = null;

    const el = this.mobileCoverRef?.nativeElement;
    if (!el) return;

    this.coverObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        this.ngZone.run(() => {
          this.showStickyMobileHeader = !entry.isIntersecting;
          this.cdr.detectChanges();
        });
      },
      { threshold: 0 }
    );
    this.coverObserver.observe(el);
  }

  onNewGroupClick(): void {
    if (!this.joyId) return;
    this.newGroupClicked.emit(this.joyId);
  }

  onBackToJoysClick(): void {
    this.backToJoysClicked.emit();
  }

  getBalanceClasses(type: "owed" | "owe" | "settled"): string {
    if (type === "owed") return "text-emerald-600";
    if (type === "owe") return "text-rose-500";
    return "text-slate-500 dark:text-slate-400";
  }

  getStatusLabel(type: "owed" | "owe" | "settled"): string {
    if (type === "owed")
      return this.translationService.t("dashboard.status.owed");
    if (type === "owe")
      return this.translationService.t("dashboard.status.owe");
    return this.translationService.t("dashboard.status.settled");
  }

  getCategoryLabel(category?: string | null): string {
    if (!category) {
      return this.translationService.t("groupDetail.general");
    }

    return this.translationService.tCategory(category);
  }

  requestDeleteGroup(group: JoyGroup, event: Event): void {
    event.stopPropagation();

    if (this.deletingGroupId === group.id) {
      return;
    }

    this.pendingDeleteGroup = group;
    this.commonDialogService.open({
      title: this.translationService.t("dashboard.deleteGroupDialogTitle"),
      icon: "delete",
      content: this.deleteGroupDialog,
      bodyClass: "p-6",
      actions: this.getDeleteGroupActions(),
      onClose: () => {
        this.pendingDeleteGroup = null;
      },
    });
  }

  async deleteGroup(group: JoyGroup): Promise<void> {
    if (!this.joyId || this.deletingGroupId === group.id) {
      return;
    }

    this.deletingGroupId = group.id;

    try {
      await this.joyService.deleteJoyGroup(this.joyId, group.id);
      if (this.openedSwipeGroupId === group.id) {
        this.closeSwipeActions();
      }
      this.commonDialogService.close();
    } catch (error) {
      console.error("Failed to delete joy group.", error);
    } finally {
      this.deletingGroupId = "";
      this.cdr.detectChanges();
    }
  }

  private getDeleteGroupActions(): CommonDialogAction[] {
    return [
      {
        label: this.translationService.t("friends.cancel"),
        kind: "secondary",
        disabled: () => !!this.deletingGroupId,
        handler: () => this.commonDialogService.close(),
      },
      {
        label: () =>
          this.translationService.t(
            this.deletingGroupId
              ? "dashboard.deletingGroup"
              : "dashboard.deleteGroup"
          ),
        icon: () => (this.deletingGroupId ? "progress_activity" : "delete"),
        kind: "danger",
        grow: true,
        disabled: () => !!this.deletingGroupId || !this.pendingDeleteGroup,
        handler: () => {
          if (this.pendingDeleteGroup) {
            void this.deleteGroup(this.pendingDeleteGroup);
          }
        },
      },
    ];
  }

  // Mobile Swipe Actions
  getSwipeTransform(groupId: string): string {
    if (this.draggingGroupId === groupId) {
      return `translateX(${this.currentSwipeOffset}px)`;
    }

    if (this.openedSwipeGroupId === groupId) {
      return `translateX(-${MOBILE_SWIPE_ACTION_WIDTH}px)`;
    }

    return "translateX(0px)";
  }

  isSwipeDeleteVisible(groupId: string): boolean {
    return this.getSwipeRevealProgress(groupId) > 0;
  }

  getSwipeDeleteOpacity(groupId: string): string {
    return this.getSwipeRevealProgress(groupId).toFixed(2);
  }

  getSwipeDeleteTransform(groupId: string): string {
    const progress = this.getSwipeRevealProgress(groupId);
    const offset = (1 - progress) * 24;
    return `translateX(${offset}px)`;
  }

  isSwipeDeleteActionEnabled(groupId: string): boolean {
    return this.openedSwipeGroupId === groupId;
  }

  onGroupTouchStart(groupId: string, event: TouchEvent): void {
    if (this.openedSwipeGroupId && this.openedSwipeGroupId !== groupId) {
      this.closeSwipeActions();
    }
    this.draggingGroupId = groupId;
    this.touchStartX = event.touches[0]?.clientX ?? 0;
    this.touchStartY = event.touches[0]?.clientY ?? 0;
    this.touchStartTime = Date.now();
    this.isMovementDetected = false;
    this.currentSwipeOffset =
      this.openedSwipeGroupId === groupId ? -MOBILE_SWIPE_ACTION_WIDTH : 0;
  }

  onGroupTouchMove(groupId: string, event: TouchEvent): void {
    if (this.draggingGroupId !== groupId) {
      return;
    }

    const currentX = event.touches[0]?.clientX ?? this.touchStartX;
    const currentY = event.touches[0]?.clientY ?? this.touchStartY;
    const deltaX = currentX - this.touchStartX;
    const deltaY = currentY - this.touchStartY;

    // If there is significant vertical movement, it's a scroll or pull.
    // Abort the swipe-to-delete to avoid "impacting the group item".
    if (!this.isMovementDetected && Math.abs(deltaY) > Math.abs(deltaX) + 5) {
      this.draggingGroupId = "";
      return;
    }

    // Movement threshold to avoid jitters and allow clicks
    if (!this.isMovementDetected && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      return;
    }
    
    this.isMovementDetected = true;

    const baseOffset =
      this.openedSwipeGroupId === groupId ? -MOBILE_SWIPE_ACTION_WIDTH : 0;
    this.currentSwipeOffset = Math.max(
      -MOBILE_SWIPE_ACTION_WIDTH,
      Math.min(0, baseOffset + deltaX)
    );
  }

  onGroupTouchEnd(groupId: string, event: TouchEvent): void {
    if (this.draggingGroupId !== groupId) {
      return;
    }

    if (this.currentSwipeOffset <= -(MOBILE_SWIPE_ACTION_WIDTH / 2)) {
      this.openedSwipeGroupId = groupId;
    } else {
      this.openedSwipeGroupId = "";
    }

    this.draggingGroupId = "";
    this.currentSwipeOffset = 0;

    // ── iOS Tap Navigation ─────────────────────────────────────────────────
    // On real iOS, click events on non-interactive divs are suppressed when
    // any touchmove fired. So we detect a tap here via time + distance and
    // emit navigation directly, bypassing the click event.
    if (!this.isMovementDetected) {
      const elapsed = Date.now() - this.touchStartTime;
      const changedTouch = event.changedTouches[0];
      const distX = Math.abs((changedTouch?.clientX ?? this.touchStartX) - this.touchStartX);
      const distY = Math.abs((changedTouch?.clientY ?? this.touchStartY) - this.touchStartY);
      const isTap = elapsed < 500 && distX < 10 && distY < 10;

      if (isTap && this.openedSwipeGroupId !== groupId) {
        // Only suppress the browser's subsequent click event when the tap
        // target is the card div itself — not a child button/input which
        // relies on click to function (e.g. Add Expense button).
        const target = event.target as HTMLElement | null;
        const isChildButton = target?.closest('button, a, input, label') !== null;
        if (!isChildButton) {
          event.preventDefault();
          this.groupClicked.emit(groupId);
        }
        // If it's a child button, let its own click event fire normally.
      }
    }
  }

  onGroupTouchCancel(): void {
    this.draggingGroupId = "";
    this.currentSwipeOffset = 0;
  }

  private closeSwipeActions(): void {
    this.openedSwipeGroupId = "";
    this.draggingGroupId = "";
    this.currentSwipeOffset = 0;
  }

  private getSwipeRevealProgress(groupId: string): number {
    if (this.openedSwipeGroupId === groupId) {
      return 1;
    }

    if (this.draggingGroupId !== groupId || this.currentSwipeOffset >= 0) {
      return 0;
    }

    return Math.min(
      1,
      Math.abs(this.currentSwipeOffset) / MOBILE_SWIPE_ACTION_WIDTH
    );
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

  getJoyConfigCategoryClasses(category: JoyCategory): string {
    const base = 'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all disabled:opacity-60';

    if (this.joyConfigForm.category === category) {
      return `${base} border-primary bg-primary/5 text-primary`;
    }

    return `${base} border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300`;
  }

  getBalanceText(group: JoyGroup): string {
    if (group.balanceType === "owed")
      return this.currencyService.formatSignedAmount(
        Math.abs(group.yourBalance)
      );
    if (group.balanceType === "owe")
      return this.currencyService.formatSignedAmount(
        -Math.abs(group.yourBalance)
      );
    return this.currencyService.formatAmount(0);
  }

  abs(value: number): number {
    return Math.abs(value);
  }

  formatAmount(value: number): string {
    return this.currencyService.formatAmount(value);
  }

  formatAmountInCurrency(amount: number, currency: AppCurrency): string {
    return this.currencyService.formatAmountInCurrency(amount, currency);
  }

  get systemCurrency(): AppCurrency {
    return this.currencyService.currentCurrency();
  }

  getAvatarColorClasses(seed: string): string {
    return this.avatarColorService.getInitialAvatarClasses(seed);
  }

  /**
   * Resolve the canonical totals-map key for an expense member.
   * Expense members are sometimes saved without email (or with a different id)
   * compared to the corresponding group member.  We do a fuzzy look-up:
   * 1. Exact getMemberKey match (email-first).
   * 2. Fall back to matching an existing entry by email / id / name so the
   *    expense amount is merged into the correct group-member row instead of
   *    creating a phantom duplicate row.
   */
  private resolveExpenseMemberKey(
    em: JoyGroupMember,
    totals: Map<string, SplitBillSummary>
  ): string {
    const exactKey = this.getMemberKey(em);
    if (totals.has(exactKey)) return exactKey;

    const emEmail = (em.email || '').trim().toLowerCase();
    const emName  = (em.name  || '').trim().toLowerCase();
    const emId    = (em.id    || '');

    for (const [k, existing] of totals.entries()) {
      const exEmail = (existing.email || '').trim().toLowerCase();
      const exName  = (existing.name  || '').trim().toLowerCase();
      if (emEmail && exEmail && emEmail === exEmail) return k;
      if (emId    && (k === emId || existing.key === emId)) return k;
      if (emName  && exName  && emName  === exName)  return k;
    }

    return exactKey; // new row — no match found
  }

  get splitBillSummaries(): SplitBillSummary[] {
    const totals = new Map<string, SplitBillSummary>();

    for (const group of this.groupCards) {
      const groupMembers = group.members ?? [];

      // Seed every group member so 0-expense members still appear.
      // isPaid comes ONLY from group.member.isPaid — expense members don't
      // carry isPaid and must not override it.
      for (const member of groupMembers) {
        const key = this.getMemberKey(member);
        if (!totals.has(key)) {
          totals.set(key, {
            key,
            name: member.name || this.translationService.t('groupDetail.unknown'),
            email: member.email || '',
            amount: 0,
            isPaid: !!member.isPaid,
          });
        } else {
          // Member appears in multiple groups — keep isPaid from the group
          // that has it set to true (OR semantics: paid if ANY group marks paid).
          const cur = totals.get(key)!;
          if (!!member.isPaid) cur.isPaid = true;
        }
      }

      const expenses = this.groupExpensesMap.get(group.id) ?? [];
      for (const exp of expenses) {
        const srcCurrency = (exp.currency as AppCurrency) ?? this.currencyService.currentCurrency();
        const originalTotal = typeof exp.originalAmount === 'number' ? exp.originalAmount : exp.amount;
        const expMembers = exp.members ?? [];
        const count = Math.max(expMembers.length, 1);

        for (const em of expMembers) {
          // ── amount in system currency ────────────────────────────────────
          // em.shareAmount is saved by add-expense-dialog ALREADY converted to
          // system currency via convertUsingRateHeuristic.  Using it directly
          // avoids a double-conversion.  Fall back to original-total-based
          // equal split only when shareAmount is missing.
          const convertedShare =
            typeof em.shareAmount === 'number' && Number.isFinite(em.shareAmount) && em.shareAmount > 0
              ? em.shareAmount
              : this.currencyService.convertUsingRateHeuristic(originalTotal / count, srcCurrency);

          // Resolve canonical key — merges into existing group-member row
          // even when expense member has a different email/id stored.
          const key = this.resolveExpenseMemberKey(em, totals);

          const current = totals.get(key) ?? {
            key,
            name: em.name || this.translationService.t('groupDetail.unknown'),
            email: em.email || '',
            amount: 0,
            // isPaid for rows NOT seeded from group.members comes from expense
            // member — best-effort initialisation only.
            isPaid: !!em.isPaid,
          };

          current.amount += convertedShare;
          // Prefer the email/key with the most information
          if (!current.email && em.email) current.email = em.email;
          // Do NOT touch current.isPaid here — it must only reflect the
          // group.member.isPaid persisted value.
          totals.set(key, current);
        }
      }
    }

    return Array.from(totals.values()).sort((a, b) => b.amount - a.amount);
  }

  private resolveSpenderName(paidByRaw: string): string {
    const normalized = paidByRaw.trim().toLowerCase();
    for (const group of this.groupCards) {
      for (const member of group.members ?? []) {
        const email = (member.email || '').trim().toLowerCase();
        const name  = (member.name  || '').trim().toLowerCase();
        if (email === normalized || name === normalized || member.id === paidByRaw) {
          return member.name || paidByRaw;
        }
      }
    }
    return paidByRaw;
  }

  get spenderSummaries(): SpenderSummary[] {
    const regularMap = new Map<string, { name: string; totalSpent: number; totalEarned: number }>();
    const depositExpMap = new Map<string, number>(); // currency → total spent from deposit

    for (const [groupId, expenses] of this.groupExpensesMap.entries()) {
      for (const exp of expenses) {
        const paidByRaw = (exp.paidBy || '').trim();
        if (!paidByRaw) continue;

        const srcCurrency = (exp.currency as AppCurrency) ?? this.currencyService.currentCurrency();
        const originalTotal = typeof exp.originalAmount === 'number' ? exp.originalAmount : exp.amount;

        // Deposit-paid expenses go into the deposit map (in original currency)
        if (paidByRaw.startsWith('DEPOSIT:')) {
          const currency = paidByRaw.split(':')[1];
          depositExpMap.set(currency, (depositExpMap.get(currency) ?? 0) + originalTotal);
          continue;
        }

        const paidByKey = paidByRaw.toLowerCase();
        const systemTotal = this.currencyService.convertUsingRateHeuristic(originalTotal, srcCurrency);

        if (!regularMap.has(paidByKey)) {
          regularMap.set(paidByKey, { name: this.resolveSpenderName(paidByRaw), totalSpent: 0, totalEarned: 0 });
        }
        const entry = regularMap.get(paidByKey)!;
        entry.totalSpent += systemTotal;

        for (const em of exp.members ?? []) {
          const emKey = this.getMemberKey(em);
          const persistKey = `${groupId}__${exp.id}__${emKey}`;
          const isPaidMember = this.expMemberPaidState.get(persistKey) ?? !!(em.isPaid);
          if (isPaidMember) {
            const share = typeof em.shareAmount === 'number' && em.shareAmount > 0 ? em.shareAmount : 0;
            entry.totalEarned += share;
          }
        }
      }
    }

    const regularSummaries: SpenderSummary[] = Array.from(regularMap.entries())
      .map(([key, v]) => ({ key, ...v }))
      .filter(s => s.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent);

    // Build deposit summaries — one per currency that has deposit entries
    const depositTotals = new Map<string, number>();
    for (const entry of this.depositEntries) {
      depositTotals.set(entry.currency, (depositTotals.get(entry.currency) ?? 0) + entry.amount);
    }
    // Also include currencies that only have deposit expenses (but no deposit entries yet)
    for (const currency of depositExpMap.keys()) {
      if (!depositTotals.has(currency)) depositTotals.set(currency, 0);
    }

    const depositSummaries: SpenderSummary[] = Array.from(depositTotals.entries())
      .map(([currency, total]) => {
        const spent = depositExpMap.get(currency) ?? 0;
        return {
          key: `DEPOSIT:${currency}`,
          name: `Deposit in ${currency}`,
          totalSpent: spent,
          totalEarned: 0,
          isDeposit: true,
          depositCurrency: currency,
          depositTotal: total,
          depositRemaining: total - spent,
        };
      })
      .sort((a, b) => (a.depositCurrency ?? '').localeCompare(b.depositCurrency ?? ''));

    return [...regularSummaries, ...depositSummaries];
  }

  // ── Deposit helpers ─────────────────────────────────────────────────────

  get allJoyMembers(): JoyGroupMember[] {
    const seen = new Set<string>();
    const members: JoyGroupMember[] = [];
    for (const group of this.groupCards) {
      for (const member of group.members ?? []) {
        const key = this.getMemberKey(member);
        if (!seen.has(key)) {
          seen.add(key);
          members.push(member);
        }
      }
    }
    return members;
  }

  // Deprecated: use depositSummaries for chips
  // get depositChips(): { currency: string; total: number }[] {
  //   ...
  // }

  get depositSummaries(): { currency: AppCurrency; total: number; remaining: number }[] {
    const totals = new Map<string, number>();
    for (const entry of this.depositEntries) {
      totals.set(entry.currency, (totals.get(entry.currency) ?? 0) + entry.amount);
    }
    const used = new Map<string, number>();
    for (const [, expenses] of this.groupExpensesMap.entries()) {
      for (const exp of expenses) {
        if (!exp.paidBy?.startsWith('DEPOSIT:')) continue;
        const currency = exp.paidBy.split(':')[1];
        const originalAmt = exp.originalAmount ?? exp.amount;
        used.set(currency, (used.get(currency) ?? 0) + originalAmt);
      }
    }
    return Array.from(totals.entries()).map(([currency, total]) => ({
      currency: currency as AppCurrency,
      total,
      remaining: total - (used.get(currency) ?? 0),
    }));
  }

  get depositDialogChipsList(): { currency: string; total: number }[] {
    const totals = new Map<string, number>();
    for (const row of this.depositDialogRows) {
      if (!row.amount || row.amount <= 0) continue;
      totals.set(row.currency, (totals.get(row.currency) ?? 0) + (row.amount ?? 0));
    }
    return Array.from(totals.entries()).map(([currency, total]) => ({ currency, total }));
  }

  openDepositDialog(): void {
    if (!this.depositDialogContent) return;
    // Build rows from all unique members across all groups; default currency = system currency
    const defaultCurrency = this.currencyService.currentCurrency();
    this.depositDialogRows = this.allJoyMembers.map(m => ({
      memberId: m.id,
      memberName: m.name,
      memberEmail: m.email,
      currency: defaultCurrency,
      amount: null,
    }));
    this.isSavingDeposit = false;

    const saveLabel = this.translationService.t('common.save') || 'Save';
    const cancelLabel = this.translationService.t('friends.cancel') || 'Cancel';
    this.commonDialogService.open({
      title: 'Add Deposit',
      icon: 'attach_money',
      content: this.depositDialogContent,
      bodyClass: 'p-0',
      actions: [
        { label: cancelLabel, kind: 'secondary', handler: () => this.commonDialogService.close() },
        { label: saveLabel, kind: 'primary', handler: () => void this.saveDeposit() },
      ],
    });
  }

  async saveDeposit(): Promise<void> {
    if (!this.joyId || this.isSavingDeposit) return;
    const rows = this.depositDialogRows.filter(r => r.amount && r.amount > 0);
    if (!rows.length) { this.commonDialogService.close(); return; }
    this.isSavingDeposit = true;
    try {
      await Promise.all(rows.map(row =>
        this.joyService.addJoyDepositEntry(this.joyId!, {
          memberId: row.memberId,
          memberName: row.memberName,
          memberEmail: row.memberEmail,
          currency: row.currency,
          amount: row.amount!,
        })
      ));
      this.commonDialogService.close();
    } catch (err) {
      console.error('Failed to save deposit', err);
    } finally {
      this.isSavingDeposit = false;
      this.cdr.detectChanges();
    }
  }

  openSpenderDialog(s: SpenderSummary, event?: Event): void {
    event?.stopPropagation();
    if (!this.spenderDialogContent) return;

    if (s.isDeposit) {
      const currency = s.depositCurrency!;
      const depositExpenses: SpenderDialogData['expenses'] = [];
      for (const [groupId, expenses] of this.groupExpensesMap.entries()) {
        for (const exp of expenses) {
          if (!exp.paidBy?.startsWith('DEPOSIT:')) continue;
          const expCurrency = exp.paidBy.split(':')[1];
          if (expCurrency !== currency) continue;
          const originalAmt = exp.originalAmount ?? exp.amount;
          const srcCurrency = (exp.currency as AppCurrency) ?? this.currencyService.currentCurrency();
          const convertedAmt = this.currencyService.convertUsingRateHeuristic(originalAmt, srcCurrency);
          const allMembersPaid = (exp.members ?? []).every(em => {
            const emKey = this.getMemberKey(em);
            const pKey = `${groupId}__${exp.id}__${emKey}`;
            return this.expMemberPaidState.get(pKey) ?? !!(em.isPaid);
          });
          depositExpenses.push({ title: exp.title, originalAmount: originalAmt, convertedAmount: convertedAmt, currency: expCurrency, isPaid: allMembersPaid });
        }
      }
      this.spenderDialogData = { spenderKey: s.key, name: s.name, isDeposit: true, depositCurrency: currency, depositTotal: s.depositTotal, depositRecords: this.depositEntries.filter(d => d.currency === currency).map(d => ({ memberName: d.memberName, amount: d.amount, currency: d.currency, date: d.createdAt })), expenses: depositExpenses };
    } else {
      const spenderExpenses: SpenderDialogData['expenses'] = [];
      for (const [groupId, expenses] of this.groupExpensesMap.entries()) {
        for (const exp of expenses) {
          if (exp.paidBy?.startsWith('DEPOSIT:')) continue;
          const paidByNorm = (exp.paidBy || '').trim().toLowerCase();
          if (paidByNorm !== s.key && paidByNorm !== s.name.toLowerCase()) continue;
          const srcCurrency = (exp.currency as AppCurrency) ?? this.currencyService.currentCurrency();
          const originalAmt = exp.originalAmount ?? exp.amount;
          const convertedAmt = this.currencyService.convertUsingRateHeuristic(originalAmt, srcCurrency);
          const allMembersPaid = (exp.members ?? []).every(em => {
            const emKey = this.getMemberKey(em);
            const pKey = `${groupId}__${exp.id}__${emKey}`;
            return this.expMemberPaidState.get(pKey) ?? !!(em.isPaid);
          });
          spenderExpenses.push({ title: exp.title, originalAmount: originalAmt, convertedAmount: convertedAmt, currency: exp.currency ?? srcCurrency, isPaid: allMembersPaid });
        }
      }
      this.spenderDialogData = { spenderKey: s.key, name: s.name, isDeposit: false, expenses: spenderExpenses };
    }

    const closeLabel = this.translationService.t('friends.cancel') || 'Close';
    this.commonDialogService.open({
      title: s.name,
      icon: s.isDeposit ? 'attach_money' : 'person',
      content: this.spenderDialogContent,
      bodyClass: 'p-0',
      actions: [{ label: closeLabel, kind: 'primary', grow: true, handler: () => this.commonDialogService.close() }],
      onClose: () => { this.spenderDialogData = null; this.cdr.detectChanges(); },
    });
  }

  formatDepositAmount(amount: number, currency: string): string {
    return this.currencyService.formatAmountInCurrency(amount, currency as AppCurrency);
  }

  trackByExpenseId(_index: number, e: { expenseId: string }): string {
    return e.expenseId;
  }

  onEditGroup(group: JoyGroup, event: Event) {
    event.stopPropagation();
    this.editGroupClicked.emit(group);
  }

  private getMemberKey(member: JoyGroupMember): string {
    return this.normalizeIdentity(member.email) || member.id || member.name;
  }

  private normalizeIdentity(value?: string | null): string {
    return value?.trim().toLowerCase() ?? "";
  }

  private getMemberSplitAmountValue(
    group: JoyGroup,
    memberShareAmount: number | undefined,
    memberCount: number
  ): number {
    if (
      typeof memberShareAmount === "number" &&
      Number.isFinite(memberShareAmount) &&
      memberShareAmount >= 0
    ) {
      return memberShareAmount;
    }

    return group.totalSpent / memberCount;
  }

  isAllDialogExpensesPaid(key: string): boolean {
    const expenses = this.getMemberExpenses(key);
    const nonDeposit = expenses.filter(e => !e.isDeposit);
    if (!nonDeposit.length) return expenses.some(e => e.isDeposit);
    return nonDeposit.every(e => this.dialogExpensePaidState.get(e.expenseId) ?? false);
  }

  async toggleAllDialogExpensesPaid(key: string, event: Event): Promise<void> {
    const checked = (event.target as HTMLInputElement).checked;
    // Only toggle non-deposit expenses; deposits are always paid and disabled.
    const expenses = this.getMemberExpenses(key).filter(e => !e.isDeposit);
    await Promise.all(
      expenses.map(e =>
        this.toggleDialogExpensePaid(key, e.expenseId, { target: { checked } } as unknown as Event)
      )
    );
  }

  onGroupClick(groupId: string): void {
    // This fires only when touched from desktop (no touch events). On mobile,
    // navigation is handled directly in onGroupTouchEnd above.
    if (this.isMovementDetected) {
      return;
    }
    this.groupClicked.emit(groupId);
  }

  openQuickAddExpense(groupId: string, event: Event): void {
    event.stopPropagation();
    this.selectedExpenseGroupId = groupId;
    this.quickAddExpenseDialog.open();
  }

  /**
   * Dedicated touchend handler for the "Add Expense" button inside the swipe card.
   * On real iOS, we can't rely on (click) firing after a touch sequence on a child
   * element whose parent has touch listeners. So we handle the tap directly here:
   * stop propagation (so parent onGroupTouchEnd doesn't run), reset swipe state,
   * and call the action immediately.
   */
  onAddExpenseButtonTap(groupId: string, event: TouchEvent): void {
    event.stopPropagation();   // prevent parent div's onGroupTouchEnd
    event.preventDefault();    // prevent the synthetic click that follows touchend
    // Reset any swipe state so the group card snaps back cleanly
    this.draggingGroupId = '';
    this.isMovementDetected = false;
    this.currentSwipeOffset = 0;
    this.openQuickAddExpense(groupId, event);
  }

  openJoyConfigDialog(): void {
    if (!this.selectedJoy) {
      return;
    }

    const dateRange = this.parseJoyDateRange(this.selectedJoy.date);
    this.joyConfigForm = {
      name: this.selectedJoy.joyName,
      category: this.selectedJoy.category,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      coverImage: this.selectedJoy.coverImage
    };
    this.joyConfigErrorMessage = "";
    this.isSavingJoyConfig = false;

    this.commonDialogService.open({
      title: this.translationService.t("dashboard.joyConfigDialogTitle"),
      icon: "settings",
      content: this.joyConfigDialog,
      bodyClass: "p-6",
      actions: this.getJoyConfigActions(),
      onClose: () => {
        this.joyConfigErrorMessage = "";
        this.isSavingJoyConfig = false;
      },
    });
  }

  private getJoyConfigActions(): CommonDialogAction[] {
    return [
      {
        label: this.translationService.t("joys.cancel"),
        kind: "secondary",
        disabled: () => this.isSavingJoyConfig,
        handler: () => this.commonDialogService.close(),
      },
      {
        label: () =>
          this.translationService.t(
            this.isSavingJoyConfig
              ? "dashboard.savingJoyConfig"
              : "dashboard.saveJoyConfig"
          ),
        icon: () => (this.isSavingJoyConfig ? "progress_activity" : "save"),
        kind: "primary",
        grow: true,
        disabled: () =>
          this.isSavingJoyConfig || !this.isJoyConfigFormValid() || !this.joyId,
        handler: () => {
          void this.saveJoyConfig();
        },
      },
    ];
  }

  private async saveJoyConfig(): Promise<void> {
    if (!this.isJoyConfigFormValid() || !this.joyId) {
      return;
    }

    this.isSavingJoyConfig = true;
    this.joyConfigErrorMessage = "";

    try {
      await this.joyService.updateJoy(this.joyId, {
        joyName: this.joyConfigForm.name.trim(),
        category: this.joyConfigForm.category,
        date: this.formatJoyDateRange(
          this.joyConfigForm.startDate,
          this.joyConfigForm.endDate
        ),
        coverImage: this.joyConfigForm.coverImage,
      });
      this.commonDialogService.close();
    } catch (error) {
      console.error("Unable to update joy config.", error);
      this.joyConfigErrorMessage =
        "Unable to save joy settings. Please try again.";
    } finally {
      this.isSavingJoyConfig = false;
    }
  }

  private isJoyConfigFormValid(): boolean {
    return !!(
      this.joyConfigForm.name.trim() &&
      this.joyConfigForm.category &&
      this.joyConfigForm.startDate &&
      this.joyConfigForm.endDate &&
      this.joyConfigForm.startDate <= this.joyConfigForm.endDate
    );
  }

  isConfigUploadingCover = false;

  async onConfigCoverSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    try {
      this.isConfigUploadingCover = true;
      this.cdr.detectChanges(); // spinner shows immediately
      
      const compressedFile = await this.imageUploadService.compressImage(file, 1600, 1600, 0.85); // same as main cover
      const imageUrl = await this.imageUploadService.uploadImage(compressedFile);
      
      this.joyConfigForm.coverImage = imageUrl;
    } catch (error) {
      console.error('Upload failed', error);
      alert('Failed to upload image. Make sure your ImgBB API key is set.');
    } finally {
      this.isConfigUploadingCover = false;
      input.value = ''; // Reset input
      this.cdr.detectChanges();
    }
  }

  private createEmptyJoyConfigForm(): JoyConfigForm {
    const today = new Date().toISOString().split("T")[0];
    return {
      name: "",
      category: "Others",
      startDate: today,
      endDate: today,
    };
  }

  private parseJoyDateRange(value: string): {
    startDate: string;
    endDate: string;
  } {
    const trimmed = value.trim();
    if (!trimmed) {
      const today = new Date().toISOString().split("T")[0];
      return { startDate: today, endDate: today };
    }

    if (trimmed.includes("→")) {
      const [startRaw, endRaw] = trimmed.split("→").map((part) => part.trim());
      const startDate = this.normalizeDateForInput(startRaw);
      const endDate = this.normalizeDateForInput(endRaw || startRaw);
      return { startDate, endDate };
    }

    const normalized = this.normalizeDateForInput(trimmed);
    return { startDate: normalized, endDate: normalized };
  }

  private normalizeDateForInput(value: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return new Date().toISOString().split("T")[0];
    }

    return parsed.toISOString().split("T")[0];
  }

  private formatJoyDateRange(startDate: string, endDate: string): string {
    if (startDate === endDate) {
      return startDate;
    }

    return `${startDate} → ${endDate}`;
  }

  private subscribeToJoyData(): void {
    const currentLoadVersion = ++this.loadVersion;
    const loadStartedAt = Date.now();
    let joyResolved = false;
    let groupsResolved = false;

    this.unsubscribeJoy?.();
    this.unsubscribeGroups?.();
    this.unsubscribeDeposits?.();
    this.unsubscribeFamilyGroups?.();

    if (!this.joyId) {
      this.lastLoadedJoyId = '';
      this.selectedJoy = null;
      this.groupCards = [];
      this.depositEntries = [];
      this.expMemberPaidState.clear();
      this.dialogExpensePaidState.clear();
      this.cdr.detectChanges();
      return;
    }

    this.selectedJoy = null;
    this.groupCards = [];
    this.depositEntries = [];
    this.expMemberPaidState.clear();
    this.dialogExpensePaidState.clear();

    const tryFinishLoading = () => {
      if (!joyResolved || !groupsResolved || currentLoadVersion !== this.loadVersion) {
        return;
      }

      const remainingDelay = Math.max(0, this.minimumLoadingDuration - (Date.now() - loadStartedAt));
      setTimeout(() => {
        if (currentLoadVersion !== this.loadVersion) {
          return;
        }

        if (this.selectedJoy?.id) {
          this.lastLoadedJoyId = this.selectedJoy.id;
          this.dataLoaded.emit();
        }

        this.cdr.detectChanges();
        // Attach cover observer now that DOM has been updated
        this.startCoverObserver();
      }, remainingDelay);
    };

    this.unsubscribeJoy = this.joyService.listenToJoy(
      this.joyId,
      (joy) => {
        this.ngZone.run(() => {
          if (currentLoadVersion !== this.loadVersion) {
            return;
          }

          this.selectedJoy = joy;
          joyResolved = true;
          tryFinishLoading();
        });
      },
      (error) => {
        console.error("Failed to sync joy.", error);
        this.ngZone.run(() => {
          if (currentLoadVersion !== this.loadVersion) {
            return;
          }

          this.selectedJoy = null;
          joyResolved = true;
          tryFinishLoading();
        });
      }
    );

    this.unsubscribeGroups = this.joyService.listenToJoyGroups(
      this.joyId,
      (groups) => {
        this.ngZone.run(() => {
          if (currentLoadVersion !== this.loadVersion) {
            return;
          }

          this.groupCards = groups;
          this.syncGroupExpensesListeners(groups);
          this.cdr.detectChanges();
          groupsResolved = true;
          tryFinishLoading();
        });
      },
      (error) => {
        console.error("Failed to sync groups.", error);
        this.ngZone.run(() => {
          if (currentLoadVersion !== this.loadVersion) {
            return;
          }

          this.groupCards = [];
          this.cdr.detectChanges();
          groupsResolved = true;
          tryFinishLoading();
        });
      }
    );

    // Family groups subscription
    this.unsubscribeFamilyGroups?.();
    this.unsubscribeFamilyGroups = this.joyService.listenToJoyFamilyGroups(
      this.joyId,
      (groups) => {
        this.ngZone.run(() => {
          this.familyGroups = groups;
          this.cdr.detectChanges();
        });
      },
      (error) => {
        console.error('Failed to sync family groups.', error);
      }
    );

    // Checklist subscription
    this.unsubscribeChecklist?.();
    this.unsubscribeChecklist = this.joyService.listenToJoyChecklist(
      this.joyId,
      (items) => {
        this.ngZone.run(() => {
          this.checklistItems = items;
          this.cdr.detectChanges();
        });
      },
      (error) => {
        console.error('Failed to sync checklist.', error);
      }
    );

    // Deposit subscription
    this.unsubscribeDeposits?.();
    this.unsubscribeDeposits = this.joyService.listenToJoyDepositEntries(
      this.joyId,
      (entries) => {
        this.ngZone.run(() => {
          this.depositEntries = entries;
          this.cdr.detectChanges();
        });
      },
      (error) => {
        console.error('Failed to sync deposits.', error);
      }
    );
  }

  private syncGroupExpensesListeners(groups: JoyGroup[]) {
    const activeIds = new Set(groups.map((g) => g.id));

    // Unsubscribe removed groups
    Array.from(this.groupExpensesUnsubscribers.keys()).forEach((id) => {
      if (!activeIds.has(id)) {
        this.groupExpensesUnsubscribers.get(id)?.();
        this.groupExpensesUnsubscribers.delete(id);
        this.groupExpensesMap.delete(id);
      }
    });

    // Subscribe new groups
    groups.forEach((group) => {
      if (this.groupExpensesUnsubscribers.has(group.id)) return;

      const unsub = this.joyService.listenToJoyGroupExpenses(
        this.joyId,
        group.id,
        (expenses) => {
          this.ngZone.run(() => {
            this.groupExpensesMap.set(group.id, expenses);
            // Populate persistent per-expense-member paid state from freshly loaded expenses
            for (const exp of expenses) {
              for (const em of exp.members ?? []) {
                const emKey = this.getMemberKey(em);
                const pairKey = `${group.id}__${exp.id}__${emKey}`;
                this.expMemberPaidState.set(pairKey, !!(em.isPaid));
              }
            }
            this.cdr.detectChanges();
          });
        },
        (error) => {
          console.error('Failed to load expenses for group', group.id, error);
          this.ngZone.run(() => {
            this.groupExpensesMap.set(group.id, []);
            this.cdr.detectChanges();
          });
        }
      );

      this.groupExpensesUnsubscribers.set(group.id, unsub);
    });
  }

  // ── Settlement Matrix ────────────────────────────────────────────────────

  openCalculateDialog(): void {
    if (!this.matrixDialogContent) return;
    this.matrixData = this.computeSettlementMatrix();
    this.matrixFilterKeys = [];
    this.matrixPayerFilterKeys = [];
    this.newFamilyGroupName = '';
    const closeLabel = this.translationService.t('friends.cancel') || 'Đóng';
    this.commonDialogService.open({
      title: 'Tính toán',
      icon: 'calculate',
      content: this.matrixDialogContent,
      bodyClass: 'p-0',
      actions: [{ label: closeLabel, kind: 'primary', grow: true, handler: () => this.commonDialogService.close() }],
      onClose: () => { this.matrixData = null; this.matrixFilterKeys = []; this.matrixPayerFilterKeys = []; this.cdr.detectChanges(); },
    });
  }

  toggleMatrixFilter(key: string): void {
    const idx = this.matrixFilterKeys.indexOf(key);
    if (idx >= 0) {
      this.matrixFilterKeys.splice(idx, 1);
    } else {
      this.matrixFilterKeys.push(key);
    }
    this.cdr.detectChanges();
  }

  toggleMatrixPayerFilter(key: string): void {
    const idx = this.matrixPayerFilterKeys.indexOf(key);
    if (idx >= 0) {
      this.matrixPayerFilterKeys.splice(idx, 1);
    } else {
      this.matrixPayerFilterKeys.push(key);
    }
    this.cdr.detectChanges();
  }

  getMatrixPayerChipClass(key: string): string {
    const base = 'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors border';
    if (this.matrixPayerFilterKeys.length === 0 || this.matrixPayerFilterKeys.includes(key)) {
      return `${base} bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700`;
    }
    return `${base} bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700`;
  }

  get matrixPayerList(): { key: string; name: string }[] {
    if (!this.matrixData) return [];
    const seen = new Set<string>();
    const result: { key: string; name: string }[] = [];
    for (const row of this.matrixData.rows) {
      if (!seen.has(row.payerKey)) {
        seen.add(row.payerKey);
        result.push({ key: row.payerKey, name: row.payerName });
      }
    }
    return result;
  }

  getMatrixMemberChipClass(key: string): string {
    const base = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold transition-colors border';
    if (this.matrixFilterKeys.length === 0 || this.matrixFilterKeys.includes(key)) {
      return `${base} bg-primary/10 text-primary border-primary/30`;
    }
    return `${base} bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700`;
  }

  getMatrixCell(row: MatrixRow, memberKey: string): MatrixCell | null {
    return row.cells.get(memberKey) ?? null;
  }

  getMatrixMemberStats(key: string): { totalPaid: number; totalOwed: number; totalAlreadyPaid: number; totalStillOwed: number } {
    const s = this.matrixData?.memberStats.get(key);
    if (!s) return { totalPaid: 0, totalOwed: 0, totalAlreadyPaid: 0, totalStillOwed: 0 };
    return { totalPaid: s.totalPaid, totalOwed: s.totalOwed, totalAlreadyPaid: s.totalAlreadyPaid, totalStillOwed: s.totalOwed - s.totalAlreadyPaid };
  }

  getMatrixMemberName(key: string): string {
    return this.matrixData?.members.find(m => m.key === key)?.name ?? key;
  }

  get filteredMatrixRows(): MatrixRow[] {
    if (!this.matrixData) return [];
    let rows = this.matrixData.rows;
    if (this.matrixPayerFilterKeys.length) {
      rows = rows.filter(row => this.matrixPayerFilterKeys.includes(row.payerKey));
    }
    if (this.matrixFilterKeys.length) {
      rows = rows.filter(row =>
        this.matrixFilterKeys.includes(row.payerKey) ||
        this.matrixFilterKeys.some(k => row.cells.has(k))
      );
    }
    return rows;
  }

  private computeSettlementMatrix(): SettlementMatrix {
    // Gather all unique members across groups
    const memberMap = new Map<string, string>(); // key → display name
    for (const group of this.groupCards) {
      for (const m of group.members ?? []) {
        const key = this.getMemberKey(m);
        if (!memberMap.has(key)) memberMap.set(key, m.name);
      }
    }
    // Sort members: family-group members first (grouped by family), then individuals
    const baseMembers = Array.from(memberMap.entries()).map(([key, name]) => ({ key, name }));
    const orderedMembers: typeof baseMembers = [];
    const usedMemberKeys = new Set<string>();
    for (const fg of this.familyGroups) {
      for (const mk of fg.memberKeys) {
        const found = baseMembers.find(m => m.key === mk);
        if (found && !usedMemberKeys.has(found.key)) {
          orderedMembers.push(found);
          usedMemberKeys.add(found.key);
        }
      }
    }
    for (const m of baseMembers) {
      if (!usedMemberKeys.has(m.key)) orderedMembers.push(m);
    }
    const members = orderedMembers;
    const systemCurrency = this.currencyService.currentCurrency();

    // Build one row per expense
    const rows: MatrixRow[] = [];
    for (const [groupId, expenses] of this.groupExpensesMap.entries()) {
      const group = this.groupCards.find(g => g.id === groupId);
      const groupName = group?.name ?? '';
      for (const exp of expenses) {
        const payerRaw = (exp.paidBy || '').trim();
        if (!payerRaw || payerRaw.startsWith('DEPOSIT:')) continue;
        const payerKey = this.resolvePayerKeyFromMap(payerRaw, memberMap);
        const payerName = this.resolveSpenderName(payerRaw);
        const srcCurrency = (exp.currency as AppCurrency) ?? systemCurrency;
        const origTotal = exp.originalAmount ?? exp.amount;
        const isForeign = srcCurrency !== systemCurrency;
        const sysTotal = typeof exp.amount === 'number' && exp.amount > 0 ? exp.amount : 0;

        const cells = new Map<string, MatrixCell>();
        let allPaid = true;
        for (const em of exp.members ?? []) {
          // Resolve to canonical group-member key so it matches payerKey
          const emKey = this.resolveMemberToCanonicalKey(em, memberMap);
          const persistKey = `${groupId}__${exp.id}__${emKey}`;
          const isPaid = this.expMemberPaidState.get(persistKey) ?? !!(em.isPaid);
          const shareSystem =
            typeof em.shareAmount === 'number' && em.shareAmount > 0
              ? em.shareAmount
              : this.currencyService.convertUsingRateHeuristic(
                  origTotal / Math.max(exp.members.length, 1),
                  srcCurrency
                );
          const ratio = sysTotal > 0 ? shareSystem / sysTotal : 1 / Math.max(exp.members.length, 1);
          const origShare = origTotal * ratio;
          const isPayer = emKey === payerKey;
          if (!isPayer && !isPaid) allPaid = false;
          cells.set(emKey, { amount: shareSystem, origAmount: origShare, currency: srcCurrency, isPaid: isPayer ? true : isPaid, isForeign, isPayer });
        }

        rows.push({ expenseId: exp.id, groupId, groupName, title: exp.title, payerKey, payerName, totalAmount: sysTotal, origAmount: origTotal, currency: srcCurrency, cells, allPaid });
      }
    }

    // Per-member statistics
    const memberStats = new Map<string, { name: string; totalPaid: number; totalOwed: number; totalAlreadyPaid: number }>();
    for (const [key, name] of memberMap) {
      let totalPaid = 0;
      let totalOwed = 0;
      let totalAlreadyPaid = 0;
      for (const row of rows) {
        if (row.payerKey === key) {
          for (const [ck, cell] of row.cells) {
            if (ck !== key) totalPaid += cell.amount;
          }
        }
        const cell = row.cells.get(key);
        if (cell && !cell.isPayer) {
          totalOwed += cell.amount;
          if (cell.isPaid) totalAlreadyPaid += cell.amount;
        }
      }
      memberStats.set(key, { name, totalPaid, totalOwed, totalAlreadyPaid });
    }

    // Build direct pairwise debts: for every unpaid cell record debtor → payer.
    // This preserves WHO each person actually owes so settlements are accurate.
    const rawDebt = new Map<string, number>(); // `${debtorKey}||${payerKey}` → amount
    // Also keep net balances (per-member aggregated) for stats display.
    const net = new Map<string, number>();
    for (const [key] of memberMap) net.set(key, 0);
    for (const row of rows) {
      if (!memberMap.has(row.payerKey)) continue;
      for (const [ck, cell] of row.cells) {
        if (cell.isPayer || cell.isPaid) continue;
        if (!memberMap.has(ck)) continue;
        const pairKey = `${ck}||${row.payerKey}`;
        rawDebt.set(pairKey, (rawDebt.get(pairKey) ?? 0) + cell.amount);
        net.set(row.payerKey, net.get(row.payerKey)! + cell.amount);
        net.set(ck, net.get(ck)! - cell.amount);
      }
    }

    // Pairwise netting: if A→B and B→A both exist, net them off
    const settlements: SettlementEntry[] = [];
    const processed = new Set<string>();
    for (const [pairKey, amount] of rawDebt) {
      if (processed.has(pairKey)) continue;
      const [fromKey, toKey] = pairKey.split('||');
      const reverseKey = `${toKey}||${fromKey}`;
      const reverseAmt = rawDebt.get(reverseKey) ?? 0;
      processed.add(pairKey);
      processed.add(reverseKey);
      const netAmt = amount - reverseAmt;
      if (netAmt > 0.5) {
        settlements.push({ fromKey, fromName: memberMap.get(fromKey) ?? fromKey, toKey, toName: memberMap.get(toKey) ?? toKey, amount: netAmt });
      } else if (netAmt < -0.5) {
        settlements.push({ fromKey: toKey, fromName: memberMap.get(toKey) ?? toKey, toKey: fromKey, toName: memberMap.get(fromKey) ?? fromKey, amount: -netAmt });
      }
    }

    return { members, rows, settlements, memberStats, netBalances: new Map(net), debtPairs: rawDebt };
  }

  /** Resolves an expense member to its canonical group-member key (email-first),
   *  falling back to name-match against the memberMap so it stays consistent with payerKey. */
  private resolveMemberToCanonicalKey(em: JoyGroupMember, memberMap: Map<string, string>): string {
    const directKey = this.getMemberKey(em);
    if (memberMap.has(directKey)) return directKey;
    const emEmail = (em.email || '').trim().toLowerCase();
    const emName = (em.name || '').trim().toLowerCase();
    for (const [key, name] of memberMap) {
      if (emEmail && key === emEmail) return key;
      if (emName && name.trim().toLowerCase() === emName) return key;
    }
    return directKey;
  }

  private resolvePayerKeyFromMap(payerRaw: string, memberMap: Map<string, string>): string {
    const normalized = payerRaw.trim().toLowerCase();
    if (memberMap.has(normalized)) return normalized;
    for (const [key, name] of memberMap) {
      if (name.trim().toLowerCase() === normalized) return key;
    }
    return normalized;
  }

  createFamilyGroup(): void {
    const name = this.newFamilyGroupName.trim();
    if (!name) return;
    const updated = [...this.familyGroups, { id: Date.now().toString(), name, memberKeys: [] }];
    this.familyGroups = updated;
    this.newFamilyGroupName = '';
    void this.joyService.saveJoyFamilyGroups(this.joyId, updated).catch(err => console.error('Failed to save family groups', err));
    this.cdr.detectChanges();
  }

  removeFamilyGroup(id: string): void {
    const updated = this.familyGroups.filter(g => g.id !== id);
    this.familyGroups = updated;
    void this.joyService.saveJoyFamilyGroups(this.joyId, updated).catch(err => console.error('Failed to save family groups', err));
    this.cdr.detectChanges();
  }

  addMemberToFamilyGroup(groupId: string, memberKey: string): void {
    const updated = this.familyGroups.map(g => ({
      ...g,
      memberKeys: g.id === groupId
        ? [...g.memberKeys.filter(k => k !== memberKey), memberKey]
        : g.memberKeys.filter(k => k !== memberKey),
    }));
    this.familyGroups = updated;
    void this.joyService.saveJoyFamilyGroups(this.joyId, updated).catch(err => console.error('Failed to save family groups', err));
    this.cdr.detectChanges();
  }

  removeMemberFromFamilyGroup(groupId: string, memberKey: string): void {
    const updated = this.familyGroups.map(g =>
      g.id === groupId ? { ...g, memberKeys: g.memberKeys.filter(k => k !== memberKey) } : g
    );
    this.familyGroups = updated;
    void this.joyService.saveJoyFamilyGroups(this.joyId, updated).catch(err => console.error('Failed to save family groups', err));
    this.cdr.detectChanges();
  }

  getMemberFamilyGroupId(memberKey: string): string | null {
    return this.familyGroups.find(g => g.memberKeys.includes(memberKey))?.id ?? null;
  }

  getFamilyGroupHeaderClass(idx: number): string {
    const p = [
      'bg-violet-100 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700 text-violet-900 dark:text-violet-100',
      'bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-900 dark:text-amber-100',
      'bg-cyan-100 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-700 text-cyan-900 dark:text-cyan-100',
      'bg-rose-100 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700 text-rose-900 dark:text-rose-100',
      'bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-900 dark:text-green-100',
    ];
    return p[idx % p.length];
  }

  getFamilyGroupChipClass(idx: number): string {
    const p = [
      'bg-violet-200 dark:bg-violet-800 text-violet-900 dark:text-violet-100',
      'bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100',
      'bg-cyan-200 dark:bg-cyan-800 text-cyan-900 dark:text-cyan-100',
      'bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100',
      'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100',
    ];
    return p[idx % p.length];
  }

  getFamilyGroupIndex(groupId: string): number {
    return this.familyGroups.findIndex(g => g.id === groupId);
  }

  get unassignedMatrixMembers(): Array<{ key: string; name: string }> {
    if (!this.matrixData) return [];
    const assignedKeys = new Set(this.familyGroups.flatMap(g => g.memberKeys));
    return this.matrixData.members.filter(m => !assignedKeys.has(m.key));
  }

  /** Column grouping info for the matrix header row — one entry per contiguous group/individual. */
  get matrixColumnGroups(): { name: string; colspan: number; colorIndex: number; isFamilyGroup: boolean }[] {
    if (!this.matrixData) return [];
    const result: { name: string; colspan: number; colorIndex: number; isFamilyGroup: boolean }[] = [];
    const members = this.matrixData.members;
    let i = 0;
    while (i < members.length) {
      const fgIndex = this.familyGroups.findIndex(g => g.memberKeys.includes(members[i].key));
      if (fgIndex >= 0) {
        const fg = this.familyGroups[fgIndex];
        let count = 0;
        while (i + count < members.length && fg.memberKeys.includes(members[i + count].key)) count++;
        result.push({ name: fg.name, colspan: count, colorIndex: fgIndex, isFamilyGroup: true });
        i += count;
      } else {
        result.push({ name: members[i].name, colspan: 1, colorIndex: -1, isFamilyGroup: false });
        i++;
      }
    }
    return result;
  }

  get familyAwareSettlements(): SettlementEntry[] {
    if (!this.matrixData) return [];
    const memberMap = new Map(this.matrixData.members.map(m => [m.key, m.name]));

    // Map each individual debt pair to the family-group level.
    // Intra-family debts (same effective key on both sides) are dropped.
    const familyDebt = new Map<string, number>(); // `${eFromKey}||${eToKey}` → amount
    for (const [pairKey, amount] of this.matrixData.debtPairs) {
      const [fromKey, toKey] = pairKey.split('||');
      const fgFrom = this.familyGroups.find(g => g.memberKeys.includes(fromKey));
      const fgTo   = this.familyGroups.find(g => g.memberKeys.includes(toKey));
      const eFrom  = fgFrom ? `family:${fgFrom.id}` : fromKey;
      const eTo    = fgTo   ? `family:${fgTo.id}`   : toKey;
      if (eFrom === eTo) continue; // intra-family: cancel out
      const k = `${eFrom}||${eTo}`;
      familyDebt.set(k, (familyDebt.get(k) ?? 0) + amount);
    }

    const getFamilyName = (eKey: string): string => {
      if (eKey.startsWith('family:')) {
        return this.familyGroups.find(g => g.id === eKey.slice(7))?.name ?? eKey;
      }
      return memberMap.get(eKey) ?? eKey;
    };

    // Pairwise netting at family level
    const result: SettlementEntry[] = [];
    const processed = new Set<string>();
    for (const [pairKey, amount] of familyDebt) {
      if (processed.has(pairKey)) continue;
      const [fromKey, toKey] = pairKey.split('||');
      const reverseKey = `${toKey}||${fromKey}`;
      const reverseAmt = familyDebt.get(reverseKey) ?? 0;
      processed.add(pairKey);
      processed.add(reverseKey);
      const netAmt = amount - reverseAmt;
      if (netAmt > 0.5) {
        result.push({ fromKey, fromName: getFamilyName(fromKey), toKey, toName: getFamilyName(toKey), amount: netAmt });
      } else if (netAmt < -0.5) {
        result.push({ fromKey: toKey, fromName: getFamilyName(toKey), toKey: fromKey, toName: getFamilyName(fromKey), amount: -netAmt });
      }
    }
    return result;
  }

  isSettlementFamilyGroup(key: string): boolean {
    return key.startsWith('family:');
  }

  isSettlementKeySelectedInFilter(key: string): boolean {
    if (!this.matrixFilterKeys.length) return true;
    if (key.startsWith('family:')) {
      const gId = key.slice(7);
      const g = this.familyGroups.find(fg => fg.id === gId);
      return !!g?.memberKeys.some(k => this.matrixFilterKeys.includes(k));
    }
    return this.matrixFilterKeys.includes(key);
  }

  // Returns color classes for each currency chip, and red border if negative
  getCurrencyChipClass(currency: AppCurrency, negative: boolean = false, compact = false): string {
    const base = compact
      ? 'inline-flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-[10px] font-bold'
      : 'inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-bold backdrop-blur-md';
    const colorMap: Record<AppCurrency, string> = {
      USD: 'bg-sky-100 text-sky-800',
      VND: 'bg-green-100 text-green-800',
      SGD: 'bg-yellow-100 text-yellow-800',
      MYR: 'bg-purple-100 text-purple-800',
    };
    const border = negative ? 'border border-red-500' : 'border border-transparent';
    return `${base} ${colorMap[currency] || 'bg-slate-100 text-slate-800'} ${border}`;
  }

  // Returns icon name for negative chips
  getCurrencyChipIcon(negative: boolean = false): string {
    return negative ? 'error' : '';
  }

  getInitials(name: string): string {
    return name?.trim() ? name.trim().charAt(0).toUpperCase() : '?';
  }

  /** Utility for keydown.enter on text inputs to commit the edit. */
  blurOnEnter(event: Event): void {
    (event.target as HTMLElement | null)?.blur();
  }

  // ── Checklist / To-do ────────────────────────────────────────────────────

  async addChecklistItem(): Promise<void> {
    const text = this.newChecklistText.trim();
    if (!text || !this.joyId || this.checklistAdding) return;
    this.checklistAdding = true;
    this.newChecklistText = '';
    try {
      await this.joyService.addChecklistItem(this.joyId, text);
    } catch (err) {
      console.error('Failed to add checklist item', err);
      this.newChecklistText = text; // restore on failure
    } finally {
      this.checklistAdding = false;
      this.cdr.detectChanges();
    }
  }

  async toggleChecklistItem(item: JoyChecklistItem, event: Event): Promise<void> {
    event.stopPropagation();
    const checked = (event.target as HTMLInputElement).checked;
    // Optimistic
    item.checked = checked;
    this.cdr.detectChanges();
    if (!this.joyId) return;
    try {
      await this.joyService.updateChecklistItem(this.joyId, item.id, { checked });
    } catch (err) {
      console.error('Failed to toggle checklist item', err);
      item.checked = !checked;
      this.cdr.detectChanges();
    }
  }

  isEditingChecklistItem(item: JoyChecklistItem): boolean {
    return this.editingChecklistItemId === item.id;
  }

  startEditingChecklistItem(item: JoyChecklistItem): void {
    if (!item.checked) {
      this.editingChecklistItemId = item.id;
    }
  }

  async finishEditingChecklistItem(item: JoyChecklistItem, event: Event): Promise<void> {
    this.editingChecklistItemId = '';
    const newText = (event.target as HTMLInputElement).value.trim();
    if (!newText || newText === item.text || !this.joyId) return;
    const oldText = item.text;
    item.text = newText;
    this.cdr.detectChanges();
    try {
      await this.joyService.updateChecklistItem(this.joyId, item.id, { text: newText });
    } catch (err) {
      console.error('Failed to update checklist item text', err);
      item.text = oldText;
      this.cdr.detectChanges();
    }
  }

  async deleteChecklistItem(item: JoyChecklistItem, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.joyId || this.deletingChecklistItemId === item.id) return;
    this.deletingChecklistItemId = item.id;
    // Optimistic removal
    this.checklistItems = this.checklistItems.filter((i) => i.id !== item.id);
    this.cdr.detectChanges();
    try {
      await this.joyService.deleteChecklistItem(this.joyId, item.id);
    } catch (err) {
      console.error('Failed to delete checklist item', err);
    } finally {
      this.deletingChecklistItemId = '';
    }
  }

  // ── Checklist swipe (mobile delete) ─────────────────────────────────────

  getChecklistSwipeTransform(itemId: string): string {
    if (this.checklistDraggingId === itemId) {
      return `translateX(${this.checklistCurrentOffset}px)`;
    }
    if (this.checklistSwipeOpenId === itemId) {
      return `translateX(-${MOBILE_SWIPE_ACTION_WIDTH}px)`;
    }
    return 'translateX(0px)';
  }

  getChecklistSwipeDeleteOpacity(itemId: string): string {
    return this.getChecklistSwipeProgress(itemId).toFixed(2);
  }

  getChecklistSwipeDeleteTransform(itemId: string): string {
    const p = this.getChecklistSwipeProgress(itemId);
    return `translateX(${(1 - p) * 24}px)`;
  }

  isChecklistSwipeDeleteEnabled(itemId: string): boolean {
    return this.checklistSwipeOpenId === itemId;
  }

  onChecklistTouchStart(itemId: string, event: TouchEvent): void {
    if (this.checklistSwipeOpenId && this.checklistSwipeOpenId !== itemId) {
      this.checklistSwipeOpenId = '';
    }
    this.checklistDraggingId = itemId;
    this.checklistTouchStartX = event.touches[0]?.clientX ?? 0;
    this.checklistTouchStartY = event.touches[0]?.clientY ?? 0;
    this.checklistMovementDetected = false;
    this.checklistCurrentOffset = this.checklistSwipeOpenId === itemId ? -MOBILE_SWIPE_ACTION_WIDTH : 0;
  }

  onChecklistTouchMove(itemId: string, event: TouchEvent): void {
    if (this.checklistDraggingId !== itemId) return;
    const dx = (event.touches[0]?.clientX ?? this.checklistTouchStartX) - this.checklistTouchStartX;
    const dy = (event.touches[0]?.clientY ?? this.checklistTouchStartY) - this.checklistTouchStartY;
    if (!this.checklistMovementDetected && Math.abs(dy) > Math.abs(dx) + 5) {
      this.checklistDraggingId = '';
      return;
    }
    if (!this.checklistMovementDetected && Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    this.checklistMovementDetected = true;
    const base = this.checklistSwipeOpenId === itemId ? -MOBILE_SWIPE_ACTION_WIDTH : 0;
    this.checklistCurrentOffset = Math.max(-MOBILE_SWIPE_ACTION_WIDTH, Math.min(0, base + dx));
  }

  onChecklistTouchEnd(itemId: string): void {
    if (this.checklistDraggingId !== itemId) return;
    this.checklistSwipeOpenId = this.checklistCurrentOffset <= -(MOBILE_SWIPE_ACTION_WIDTH / 2) ? itemId : '';
    this.checklistDraggingId = '';
    this.checklistCurrentOffset = 0;
  }

  onChecklistTouchCancel(): void {
    this.checklistDraggingId = '';
    this.checklistCurrentOffset = 0;
  }

  private getChecklistSwipeProgress(itemId: string): number {
    if (this.checklistSwipeOpenId === itemId) return 1;
    if (this.checklistDraggingId !== itemId || this.checklistCurrentOffset >= 0) return 0;
    return Math.min(1, Math.abs(this.checklistCurrentOffset) / MOBILE_SWIPE_ACTION_WIDTH);
  }
}
