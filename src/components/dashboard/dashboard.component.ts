import {
  ChangeDetectorRef,
  Component,
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
import { CurrencyService } from "../../services/currency.service";
import { AppCurrency } from "../../services/currency.service";
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
  JoyGroup,
  JoyGroupMember,
  JoyExpense,
} from "../../types/joy.interface";
import { UserSessionService } from "../../services/user-session.service";

interface SplitBillSummary {
  key: string;
  name: string;
  email: string;
  amount: number;
  isPaid: boolean;
}

interface JoyConfigForm {
  name: string;
  category: JoyCategory;
  startDate: string;
  endDate: string;
}

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
export class DashboardComponent implements OnChanges, OnDestroy {
  @Input() joyId = "";
  @Output() groupClicked = new EventEmitter<string>();
  @Output() newGroupClicked = new EventEmitter<string>();
  @Output() backToJoysClicked = new EventEmitter<void>();
  @ViewChild("quickAddExpenseDialog")
  quickAddExpenseDialog!: AddExpenseDialogComponent;
  @ViewChild("joyConfigDialog", { static: true })
  joyConfigDialog!: TemplateRef<unknown>;

  selectedJoy: Joy | null = null;
  groupCards: JoyGroup[] = [];
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
  savingPaidSummaryKeys = new Set<string>();

  private unsubscribeJoy: Unsubscribe | null = null;
  private unsubscribeGroups: Unsubscribe | null = null;
  private groupExpensesUnsubscribers: Map<string, Unsubscribe> = new Map();
  private groupExpensesMap: Map<string, JoyExpense[]> = new Map();
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
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["joyId"]) {
      this.subscribeToJoyData();
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeJoy?.();
    this.unsubscribeGroups?.();
    this.userSubscription.unsubscribe();
    // cleanup expense listeners
    this.groupExpensesUnsubscribers.forEach((unsub) => unsub());
    this.groupExpensesUnsubscribers.clear();
    this.groupExpensesMap.clear();
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

  getAvatarColorClasses(seed: string): string {
    return this.avatarColorService.getInitialAvatarClasses(seed);
  }

  get splitBillSummaries(): SplitBillSummary[] {
    const totals = new Map<string, SplitBillSummary>();

    for (const group of this.groupCards) {
      const members = group.members ?? [];
      const memberCount = Math.max(members.length, 1);

      for (const member of members) {
        const key = this.getMemberKey(member);
        const current = totals.get(key) ?? {
          key,
          name: member.name || this.translationService.t("groupDetail.unknown"),
          email: member.email || "",
          amount: 0,
          isPaid: true,
        };
        const amount = this.getMemberSplitAmountValue(
          group,
          member.shareAmount,
          memberCount
        );
        current.amount += amount;
        current.email = current.email || member.email || "";
        current.isPaid = current.isPaid && !!member.isPaid;
        totals.set(key, current);
      }
    }

    return Array.from(totals.values()).sort((a, b) => b.amount - a.amount);
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

  isSplitBillSaving(item: SplitBillSummary): boolean {
    return this.savingPaidSummaryKeys.has(item.key);
  }

  async toggleSplitBillPaid(item: SplitBillSummary, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const checked = input.checked;

    if (!this.joyId || this.isSplitBillSaving(item)) {
      input.checked = item.isPaid;
      return;
    }

    const previousGroups = this.groupCards.map((group) => ({
      ...group,
      members: (group.members ?? []).map((member) => ({ ...member }))
    }));

    const nextGroups = this.groupCards.map((group) => {
      let changed = false;
      const nextMembers = (group.members ?? []).map((member) => {
        if (!this.isSplitBillMemberMatch(item, member)) {
          return member;
        }

        if (!!member.isPaid === checked) {
          return member;
        }

        changed = true;
        return {
          ...member,
          isPaid: checked
        };
      });

      return changed ? { ...group, members: nextMembers } : group;
    });

    const changedGroups = nextGroups.filter((group, index) => group !== this.groupCards[index]);
    if (!changedGroups.length) {
      return;
    }

    this.savingPaidSummaryKeys.add(item.key);
    this.groupCards = nextGroups;
    this.cdr.detectChanges();

    try {
      await Promise.all(
        changedGroups.map((group) => {
          const { id, ...groupPayload } = group;
          return this.joyService.updateJoyGroup(this.joyId, id, groupPayload);
        })
      );
    } catch (error) {
      console.error("Failed to update split bill paid state.", error);
      this.groupCards = previousGroups;
      input.checked = item.isPaid;
    } finally {
      this.savingPaidSummaryKeys.delete(item.key);
      this.cdr.detectChanges();
    }
  }

  private isSplitBillMemberMatch(item: SplitBillSummary, member: JoyGroupMember): boolean {
    const itemEmail = this.normalizeIdentity(item.email);
    if (itemEmail) {
      return this.normalizeIdentity(member.email) === itemEmail;
    }

    return this.getMemberKey(member) === item.key;
  }

  onGroupClick(groupId: string): void {
    this.groupClicked.emit(groupId);
  }

  openQuickAddExpense(groupId: string, event: Event): void {
    event.stopPropagation();
    this.selectedExpenseGroupId = groupId;
    this.quickAddExpenseDialog.open();
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

    if (!this.joyId) {
      this.lastLoadedJoyId = '';
      this.selectedJoy = null;
      this.groupCards = [];
      this.cdr.detectChanges();
      return;
    }

    this.selectedJoy = null;
    this.groupCards = [];

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
          groupsResolved = true;
          tryFinishLoading();
        });
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
}
