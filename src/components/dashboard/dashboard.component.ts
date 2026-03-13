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
import { AddExpenseDialogComponent } from "../add-expense-dialog/add-expense-dialog.component";
import { CurrencyService } from "../../services/currency.service";
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
} from "../../types/joy.interface";

interface SplitBillSummary {
  key: string;
  name: string;
  amount: number;
}

interface JoyConfigForm {
  name: string;
  category: JoyCategory;
  startDate: string;
  endDate: string;
}

@Component({
  selector: "joys-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    AddExpenseDialogComponent,
  ],
  template: `
    <div class="p-4 md:p-8 max-w-6xl mx-auto">
      <div
        *ngIf="!joyId"
        class="flex flex-col items-center justify-center h-[50vh] rounded-2xl border border-slate-200 bg-white p-6 md:p-8 text-center dark:border-slate-800 dark:bg-slate-900 shadow-sm"
      >
        <span
          class="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-4"
          >auto_awesome</span
        >
        <h3 class="text-2xl font-bold text-slate-900 dark:text-white">
          {{ "dashboard.selectJoy" | translate }}
        </h3>
        <p class="mt-2 text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          {{ "dashboard.selectJoyDesc" | translate }}
        </p>
      </div>

      <ng-container *ngIf="joyId && selectedJoy as joy">
        <header class="md:hidden pb-4">
          <div class="flex items-center justify-between mb-2">
            <button
              type="button"
              (click)="onBackToJoysClick()"
              class="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span
                class="material-symbols-outlined text-slate-600 dark:text-slate-400"
                >arrow_back</span
              >
            </button>
            <button
              type="button"
              (click)="openJoyConfigDialog()"
              class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-primary/30 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-primary/30 dark:hover:text-primary"
              [attr.aria-label]="'dashboard.editJoy' | translate"
              [title]="'dashboard.editJoy' | translate"
            >
              <span class="material-symbols-outlined text-[18px]"
                >settings</span
              >
            </button>
          </div>
          <h1
            class="text-3xl font-bold tracking-tight text-slate-900 dark:text-white"
          >
            {{ joy.joyName }}
          </h1>
          <p
            class="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium flex items-center gap-1"
          >
            <span class="material-symbols-outlined text-sm"
              >calendar_today</span
            >
            {{ joy.date || ("dashboard.noDate" | translate) }} •
            {{ joy.category }}
          </p>
        </header>

        <header class="hidden md:block mb-8">
          <div
            class="relative h-64 w-full rounded-2xl overflow-hidden shadow-sm group"
          >
            <div
              class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent z-10"
            ></div>
            <img
              src="https://images.unsplash.com/photo-1525625293386-3f8f99389edd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
              alt="Cover"
              class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div
              class="absolute bottom-0 left-0 p-8 z-20 w-full flex justify-between items-end"
            >
              <div>
                <h2 class="text-white text-4xl font-black tracking-tight mb-2">
                  {{ joy.joyName }}
                </h2>
                <div class="flex items-center gap-2 text-white/90">
                  <span class="material-symbols-outlined text-sm"
                    >calendar_today</span
                  >
                  <span class="text-sm font-medium"
                    >{{ joy.date || ("dashboard.noDate" | translate) }} •
                    {{ joy.category }}</span
                  >
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="onBackToJoysClick()"
                  class="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/30 px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                >
                  <span class="material-symbols-outlined text-sm"
                    >arrow_back</span
                  >
                  {{ "groupDetail.backToJoys" | translate }}
                </button>
                <button
                  type="button"
                  (click)="openJoyConfigDialog()"
                  class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/40 bg-white/20 text-white backdrop-blur-md transition-all hover:bg-white/30"
                  [attr.aria-label]="'dashboard.editJoy' | translate"
                  [title]="'dashboard.editJoy' | translate"
                >
                  <span class="material-symbols-outlined text-[18px]"
                    >settings</span
                  >
                </button>
                <button
                  type="button"
                  (click)="onNewGroupClick()"
                  class="bg-primary hover:bg-primary/90 text-white border border-primary/70 px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-primary/30"
                >
                  <span class="material-symbols-outlined text-sm"
                    >group_add</span
                  >
                  {{ "dashboard.newGroup" | translate }}
                </button>
              </div>
            </div>
          </div>
        </header>

        <section class="grid grid-cols-2 gap-4 md:gap-6 mb-8">
          <div
            class="bg-primary/5 md:bg-white dark:bg-primary/10 md:dark:bg-slate-900 p-4 md:p-6 rounded-xl md:rounded-2xl border border-primary/10 md:border-slate-200 dark:border-primary/20 md:dark:border-slate-800 shadow-sm flex flex-col justify-between"
          >
            <p
              class="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-semibold uppercase tracking-wider mb-1 md:mb-2"
            >
              {{ "dashboard.totalGroupSpend" | translate }}
            </p>
            <p
              class="text-xl md:text-3xl font-black text-slate-900 dark:text-white"
            >
              {{ formatAmount(totalSpent) }}
            </p>
          </div>

          <div
            class="bg-slate-50 md:bg-white dark:bg-slate-800 md:dark:bg-slate-900 p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 md:border-slate-200 dark:border-slate-700 md:dark:border-slate-800 shadow-sm flex flex-col justify-between"
          >
            <p
              class="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-semibold uppercase tracking-wider mb-1 md:mb-2"
            >
              {{ "dashboard.totalYouOwe" | translate }}
            </p>
            <p class="text-xl md:text-3xl font-black text-rose-500">
              {{ formatAmount(totalYouOwe) }}
            </p>
          </div>
        </section>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div class="lg:col-span-8">
            <div class="flex items-center justify-between mb-4 md:mb-6">
              <h3
                class="text-lg md:text-xl font-bold text-slate-900 dark:text-white"
              >
                {{ "dashboard.yourGroups" | translate }}
              </h3>
            </div>

            <div
              *ngIf="!groupCards.length"
              class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900"
            >
              <span
                class="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600"
                >group</span
              >
              <h3 class="mt-3 text-xl font-bold text-slate-900 dark:text-white">
                {{ "dashboard.blankTitle" | translate }}
              </h3>
              <p class="mt-1 text-slate-500 dark:text-slate-400">
                {{ "dashboard.blankDesc" | translate }}
              </p>
            </div>

            <div class="space-y-4" *ngIf="groupCards.length > 0">
              <div
                *ngFor="let group of groupCards"
                (click)="onGroupClick(group.id)"
                class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-row items-center justify-between hover:border-primary/30 transition-colors cursor-pointer group"
              >
                <div class="flex items-center gap-4 min-w-0 flex-1">
                  <div
                    class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-primary/10 text-primary flex items-center justify-center"
                  >
                    <img
                      *ngIf="group.photo"
                      [src]="group.photo"
                      [alt]="group.name"
                      class="w-full h-full object-cover"
                    />
                    <span *ngIf="!group.photo" class="material-symbols-outlined"
                      >receipt_long</span
                    >
                  </div>
                  <div class="min-w-0">
                    <h4
                      class="font-bold text-slate-900 dark:text-white truncate"
                    >
                      {{ group.name }}
                    </h4>
                    <p
                      class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate"
                    >
                      {{ group.members.length }}
                      {{ "dashboard.members" | translate }}
                    </p>
                  </div>
                </div>
                <div class="ml-3 w-50 shrink-0 text-right sm:w-36">
                  <p
                    class="text-sm font-bold text-slate-900 dark:text-white sm:text-base"
                  >
                    {{ formatAmount(group.totalSpent) }}
                  </p>
                </div>

                <div class="ml-3 flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    (click)="openQuickAddExpense(group.id, $event)"
                    class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary/90 sm:h-auto sm:w-auto sm:gap-1 sm:rounded-lg sm:px-3 sm:py-2 sm:text-xs sm:font-bold"
                    [attr.aria-label]="'groupDetail.addExpense' | translate"
                  >
                    <span class="material-symbols-outlined text-[16px]"
                      >add_circle</span
                    >
                    <span class="hidden sm:inline">{{
                      "groupDetail.addExpense" | translate
                    }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="lg:col-span-4 pb-20 lg:pb-0">
            <div
              class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
            >
              <div
                class="p-4 md:p-6 border-b border-slate-100 dark:border-slate-800/50"
              >
                <h3 class="text-lg font-bold text-slate-900 dark:text-white">
                  {{ "dashboard.yourSplitBills" | translate }}
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {{ "dashboard.memberSplit" | translate }}
                </p>
              </div>

              <div
                class="grid grid-cols-2 gap-3 p-4 md:grid-cols-1 md:gap-0 md:p-0"
              >
                <div
                  *ngFor="let item of splitBillSummaries"
                  class="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50 md:rounded-none md:border-0 md:bg-transparent md:p-4 md:border-b md:border-slate-50 md:dark:border-slate-800/50"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                      [ngClass]="getAvatarColorClasses(item.name)"
                    >
                      {{ item.name.charAt(0).toUpperCase() }}
                    </div>
                    <div class="min-w-0">
                      <p
                        class="truncate text-sm font-bold text-slate-900 dark:text-white"
                      >
                        {{ item.name }}
                      </p>
                    </div>
                  </div>
                  <p
                    class="mt-3 text-sm font-bold text-slate-900 dark:text-white md:mt-0 md:text-right"
                  >
                    {{ formatAmount(item.amount) }}
                  </p>
                </div>

                <div
                  *ngIf="!splitBillSummaries.length"
                  class="col-span-2 p-8 text-center md:col-span-1"
                >
                  <span
                    class="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600"
                    >pie_chart</span
                  >
                  <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    No split details available yet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <joys-add-expense-dialog
        #quickAddExpenseDialog
        [joyId]="joyId"
        [groupId]="selectedExpenseGroupId"
      ></joys-add-expense-dialog>

      <ng-template #joyConfigDialog>
        <div class="space-y-4">
          <div class="flex flex-col gap-2">
            <label
              class="text-sm font-semibold text-slate-700 dark:text-slate-300"
              >{{ "joys.joyName" | translate }}</label
            >
            <input
              [(ngModel)]="joyConfigForm.name"
              [disabled]="isSavingJoyConfig"
              type="text"
              class="w-full rounded-xl border-transparent bg-slate-50 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label
              class="text-sm font-semibold text-slate-700 dark:text-slate-300"
              >{{ "joys.category" | translate }}</label
            >
            <select
              [(ngModel)]="joyConfigForm.category"
              [disabled]="isSavingJoyConfig"
              class="w-full rounded-xl border-transparent bg-slate-50 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:text-slate-100"
            >
              <option *ngFor="let cat of joyCategories" [value]="cat">
                {{ cat }}
              </option>
            </select>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <label
                class="text-sm font-semibold text-slate-700 dark:text-slate-300"
                >Start date</label
              >
              <input
                [(ngModel)]="joyConfigForm.startDate"
                [disabled]="isSavingJoyConfig"
                type="date"
                class="tw-date-picker w-full rounded-xl border-transparent bg-slate-50 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div class="flex flex-col gap-2">
              <label
                class="text-sm font-semibold text-slate-700 dark:text-slate-300"
                >End date</label
              >
              <input
                [(ngModel)]="joyConfigForm.endDate"
                [disabled]="isSavingJoyConfig"
                [min]="joyConfigForm.startDate"
                type="date"
                class="tw-date-picker w-full rounded-xl border-transparent bg-slate-50 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <p
            *ngIf="joyConfigErrorMessage"
            class="text-sm text-red-600 dark:text-red-300"
          >
            {{ joyConfigErrorMessage }}
          </p>
        </div>
      </ng-template>
    </div>
  `,
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

  private unsubscribeJoy: Unsubscribe | null = null;
  private unsubscribeGroups: Unsubscribe | null = null;

  constructor(
    private readonly currencyService: CurrencyService,
    private readonly avatarColorService: AvatarColorService,
    private readonly joyService: JoyService,
    private readonly commonDialogService: CommonDialogService,
    private readonly translationService: TranslationService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}
  @Output() dataLoaded = new EventEmitter<void>();
  ngAfterViewInit(): void {
    setTimeout(() => {
      this.dataLoaded.emit();
    }, 0);
  }
  get totalSpent(): number {
    return this.groupCards.reduce((sum, group) => sum + group.totalSpent, 0);
  }

  get totalYouOwe(): number {
    return this.groupCards.reduce((sum, group) => {
      if (group.balanceType === "owe") {
        return sum + Math.abs(group.yourBalance);
      }
      return sum;
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["joyId"]) {
      this.subscribeToJoyData();
    }
  }

  ngDoCheck(): void {
    // Emit dataLoaded when selectedJoy is set (dashboard data loaded)
    if (this.selectedJoy) {
      this.dataLoaded.emit();
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeJoy?.();
    this.unsubscribeGroups?.();
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
          amount: 0,
        };
        const amount = this.getMemberSplitAmountValue(
          group,
          member.shareAmount,
          memberCount
        );
        current.amount += amount;
        totals.set(key, current);
      }
    }

    return Array.from(totals.values()).sort((a, b) => b.amount - a.amount);
  }

  private getMemberKey(member: JoyGroupMember): string {
    return member.id || member.email || member.name;
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
    this.unsubscribeJoy?.();
    this.unsubscribeGroups?.();

    if (!this.joyId) {
      this.selectedJoy = null;
      this.groupCards = [];
      this.cdr.detectChanges();
      return;
    }

    this.unsubscribeJoy = this.joyService.listenToJoy(
      this.joyId,
      (joy) => {
        this.ngZone.run(() => {
          this.selectedJoy = joy;
          this.cdr.detectChanges();
        });
      },
      (error) => {
        console.error("Failed to sync joy.", error);
      }
    );

    this.unsubscribeGroups = this.joyService.listenToJoyGroups(
      this.joyId,
      (groups) => {
        this.ngZone.run(() => {
          this.groupCards = groups;
          this.cdr.detectChanges();
        });
      },
      (error) => {
        console.error("Failed to sync groups.", error);
      }
    );
  }
}
