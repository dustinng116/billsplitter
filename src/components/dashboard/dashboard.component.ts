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
          <div class="relative min-h-[224px] overflow-hidden rounded-[28px] shadow-sm">
            <img
              src="https://images.unsplash.com/photo-1525625293386-3f8f99389edd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
              alt="Cover"
              class="absolute inset-0 h-full w-full object-cover"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/35 to-slate-900/10"></div>

            <div class="relative z-10 flex min-h-[224px] flex-col justify-between p-4">
              <div class="flex items-center justify-between gap-3">
                <button
                  type="button"
                  (click)="onBackToJoysClick()"
                  class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25"
                >
                  <span class="material-symbols-outlined text-[20px]"
                    >arrow_back</span
                  >
                </button>
                <button
                  type="button"
                  (click)="openJoyConfigDialog()"
                  class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25"
                  [attr.aria-label]="'dashboard.editJoy' | translate"
                  [title]="'dashboard.editJoy' | translate"
                >
                  <span class="material-symbols-outlined text-[18px]"
                    >settings</span
                  >
                </button>
              </div>

              <div class="space-y-3 pr-2">
                <div>
                  <h1
                    class="break-words text-3xl font-black tracking-tight text-white"
                  >
                    {{ joy.joyName }}
                  </h1>
                  <p
                    class="mt-2 flex flex-wrap items-center gap-1.5 text-sm font-medium text-white/90"
                  >
                    <span class="material-symbols-outlined text-sm"
                      >calendar_today</span
                    >
                    {{ joy.date || ("dashboard.noDate" | translate) }} •
                    {{ getCategoryLabel(joy.category) }}
                  </p>
                </div>

                <!-- <button
                  type="button"
                  (click)="onNewGroupClick()"
                  class="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl border border-white/25 bg-white/15 px-4 text-sm font-bold text-white backdrop-blur-md transition-colors hover:bg-white/25"
                >
                  <span class="material-symbols-outlined text-[18px]"
                    >group_add</span
                  >
                  {{ "dashboard.newGroup" | translate }}
                </button> -->
              </div>
            </div>
          </div>
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
            <button
              type="button"
              (click)="onBackToJoysClick()"
              class="absolute left-6 top-6 z-20 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/30 px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            >
              <span class="material-symbols-outlined text-sm"
                >arrow_back</span
              >
              {{ "groupDetail.backToJoys" | translate }}
            </button>
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
                    {{ getCategoryLabel(joy.category) }}</span
                  >
                </div>
              </div>
              <div class="flex items-center gap-2">
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
            class="bg-gradient-to-br from-sky-100 via-cyan-50 to-white dark:from-sky-950/50 dark:via-cyan-950/30 dark:to-slate-900 p-4 md:p-6 rounded-xl md:rounded-2xl border border-sky-200/70 dark:border-sky-900/40 shadow-sm flex flex-col justify-between"
          >
            <p
              class="text-sky-700/80 dark:text-sky-200/70 text-xs md:text-sm font-semibold uppercase tracking-wider mb-1 md:mb-2"
            >
              {{ "dashboard.totalGroupSpend" | translate }}
            </p>
            <p
              class="text-xl md:text-3xl font-black text-sky-950 dark:text-sky-100"
            >
              {{ formatAmount(totalSpent) }}
            </p>
          </div>

          <div
            class="bg-gradient-to-br from-violet-100 via-fuchsia-50 to-white dark:from-violet-950/50 dark:via-fuchsia-950/30 dark:to-slate-900 p-4 md:p-6 rounded-xl md:rounded-2xl border border-violet-200/70 dark:border-violet-900/40 shadow-sm flex flex-col justify-between"
          >
            <p
              class="text-violet-700/80 dark:text-violet-200/70 text-xs md:text-sm font-semibold uppercase tracking-wider mb-1 md:mb-2"
            >
              {{ "dashboard.totalYouSpent" | translate }}
            </p>
            <p class="text-xl md:text-3xl font-black text-violet-950 dark:text-violet-100">
              {{ formatAmount(totalYouSpent) }}
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
                  <div class="flex items-start gap-3">
                    <div
                      class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                      [ngClass]="getAvatarColorClasses(item.name)"
                    >
                      {{ item.name.charAt(0).toUpperCase() }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-start gap-3 justify-between">
                        <div class="min-w-0 flex-1">
                          <p
                            class="truncate text-sm font-bold text-slate-900 dark:text-white"
                            [class.line-through]="item.isPaid"
                            [class.text-slate-400]="item.isPaid"
                            [class.dark:text-slate-500]="item.isPaid"
                          >
                            {{ item.name }}
                          </p>
                          <p *ngIf="item.email" class="truncate text-xs text-slate-500 dark:text-slate-400" [class.line-through]="item.isPaid">
                            {{ item.email }}
                          </p>
                        </div>

                        <label class="mt-0.5 hidden shrink-0 cursor-pointer items-center md:inline-flex">
                          <input
                            type="checkbox"
                            class="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30 dark:border-slate-600 dark:bg-slate-900"
                            [checked]="item.isPaid"
                            [disabled]="isSplitBillSaving(item)"
                            [attr.aria-label]="(item.isPaid ? 'dashboard.markUnpaid' : 'dashboard.markPaid') | translate"
                            [title]="(item.isPaid ? 'dashboard.markUnpaid' : 'dashboard.markPaid') | translate"
                            (click)="$event.stopPropagation()"
                            (change)="toggleSplitBillPaid(item, $event)"
                          />
                        </label>
                      </div>

                      <div class="mt-3 flex items-end justify-between gap-3 md:mt-0 md:block">
                        <p
                          class="text-sm font-bold text-slate-900 dark:text-white md:text-right"
                          [class.line-through]="item.isPaid"
                          [class.text-slate-400]="item.isPaid"
                          [class.dark:text-slate-500]="item.isPaid"
                        >
                          {{ formatAmount(item.amount) }}
                        </p>

                        <label class="inline-flex shrink-0 cursor-pointer items-center md:hidden">
                          <input
                            type="checkbox"
                            class="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30 dark:border-slate-600 dark:bg-slate-900"
                            [checked]="item.isPaid"
                            [disabled]="isSplitBillSaving(item)"
                            [attr.aria-label]="(item.isPaid ? 'dashboard.markUnpaid' : 'dashboard.markPaid') | translate"
                            [title]="(item.isPaid ? 'dashboard.markUnpaid' : 'dashboard.markPaid') | translate"
                            (click)="$event.stopPropagation()"
                            (change)="toggleSplitBillPaid(item, $event)"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
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
                    {{ 'dashboard.noSplitDetails' | translate }}
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
            <div class="flex flex-wrap gap-2.5">
              <button
                *ngFor="let cat of joyCategories"
                type="button"
                (click)="joyConfigForm.category = cat"
                [disabled]="isSavingJoyConfig"
                [class]="getJoyConfigCategoryClasses(cat)"
              >
                <span class="material-symbols-outlined text-[18px]">{{ getCategoryIcon(cat) }}</span>
                <span>{{ getCategoryLabel(cat) }}</span>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <label
                class="text-sm font-semibold text-slate-700 dark:text-slate-300"
                >{{ "common.startDate" | translate }}</label
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
                >{{ "common.endDate" | translate }}</label
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

        if (this.selectedJoy?.id && this.lastLoadedJoyId !== this.selectedJoy.id) {
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
