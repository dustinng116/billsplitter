import { Component, EventEmitter, Output, ViewChild } from "@angular/core";
import { AvatarColorService } from "../../services/avatar-color.service";
import { UserSessionService } from "../../services/user-session.service";
import { Observable, Subscription } from "rxjs";
import { CommonModule } from "@angular/common";
import { DashboardComponent } from "../dashboard/dashboard.component";
import { GroupDetailComponent } from "../group-detail/group-detail.component";
import { JoysTableComponent } from "../joys-table/joys-table.component";
import { FriendsPageComponent } from "../friends-page/friends-page.component";
import { ActivitiesPageComponent } from "../activities-page/activities-page.component";
import { TranslatePipe } from "../../pipes/translate.pipe";
import {
  AppLanguage,
  TranslationService,
} from "../../services/translation.service";
import { AppCurrency, CurrencyService } from "../../services/currency.service";
import { ThemeMode, ThemeService } from "../../services/theme.service";
import { ActivityService } from "../../services/activity.service";
import { Joy } from "../../types/joy.interface";
import { GuestSyncService } from "../../services/guest-sync.service";
import { AppRouteService } from "../../services/app-route.service";

type ViewType =
  | "dashboard"
  | "group-detail"
  | "joys-table"
  | "friends"
  | "activities"
  | "account";

@Component({
  selector: "joys-main-content",
  standalone: true,
  imports: [
    CommonModule,
    DashboardComponent,
    GroupDetailComponent,
    JoysTableComponent,
    FriendsPageComponent,
    ActivitiesPageComponent,
    TranslatePipe,
  ],
  template: `
    <!-- Global Overlay Loading Spinner -->
    <div
      *ngIf="isPageLoading"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 pointer-events-auto transition-opacity duration-300"
    >
      <div class="flex flex-col items-center">
        <span
          class="material-symbols-outlined animate-spin text-5xl text-primary"
          >progress_activity</span
        >
        <span class="mt-2 text-white text-sm font-medium">Loading...</span>
      </div>
    </div>
    <main
      class="h-full overflow-y-auto bg-slate-50 dark:bg-background-dark w-full"
      style="padding-bottom:calc(env(safe-area-inset-bottom,0px) + 6rem);padding-top:0;padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px);"
      (touchstart)="onMainTouchStart($event)"
      (touchmove)="onMainTouchMove($event)"
      (touchend)="onMainTouchEnd()"
      (touchcancel)="onMainTouchCancel()"
    >
      <div
        *ngIf="showPullRefreshIndicator"
        class="pointer-events-none fixed left-1/2 z-[60] flex -translate-x-1/2 items-center justify-center rounded-full bg-white/90 p-2 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900/90 dark:ring-slate-700 lg:hidden"
        [style.top]="'calc(env(safe-area-inset-top, 0px) + 8px)'"
        [style.opacity]="pullRefreshOpacity"
        [style.transform]="'translate(-50%, ' + pullRefreshTranslateY + 'px)'"
      >
        <span
          class="material-symbols-outlined text-[20px] text-primary"
          [class.animate-spin]="isPullRefreshing"
        >
          {{ isPullRefreshing ? "progress_activity" : "refresh" }}
        </span>
      </div>

      <!-- Dashboard View -->
      <div *ngIf="currentView === 'dashboard'" class="w-full page-fade-in">
        <joys-dashboard
          [joyId]="selectedJoyId"
          (groupClicked)="onGroupClicked($event)"
          (newGroupClicked)="onDashboardNewGroupClicked($event)"
          (backToJoysClicked)="onDashboardBackToJoys()"
          (dataLoaded)="onDashboardDataLoaded()"
        ></joys-dashboard>
      </div>

      <!-- Group Detail View -->
      <joys-group-detail
        *ngIf="currentView === 'group-detail'"
        class="page-fade-in"
        [joyId]="selectedJoyId"
        [groupId]="selectedGroupId"
        (backClicked)="onBackToDashboard()"
        (dataLoaded)="onGroupDetailDataLoaded()"
      ></joys-group-detail>

      <!-- Joys Table View -->
      <joys-joys-table
        *ngIf="currentView === 'joys-table'"
        class="page-fade-in"
        (joyRowClicked)="onJoyRowClicked($event)"
      ></joys-joys-table>

      <joys-friends-page
        *ngIf="currentView === 'friends'"
        class="page-fade-in"
      ></joys-friends-page>

      <joys-activities-page
        *ngIf="currentView === 'activities'"
        class="page-fade-in"
      ></joys-activities-page>

      <section
        *ngIf="currentView === 'account'"
        class="p-5 md:p-8 page-fade-in"
      >
        <div class="mx-auto flex max-w-xl flex-col gap-4 pb-4">
          <section
            class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div
              class="flex items-center gap-4"
              *ngIf="user$ | async as user; else guestBlock"
            >
              <ng-container *ngIf="hasUserAvatar(user); else userInitialBlock">
                <img
                  [src]="user.photoURL"
                  [alt]="user.displayName || user.email"
                  (error)="onUserAvatarError(user)"
                  class="h-16 w-16 rounded-full object-cover ring-2 ring-primary/20"
                />
              </ng-container>
              <ng-template #userInitialBlock>
                <div
                  class="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold ring-2 ring-primary/20"
                  [ngClass]="
                    getAvatarColorClasses(user.displayName || user.email)
                  "
                >
                  {{ getInitials(user.displayName || user.email) }}
                </div>
              </ng-template>
              <div class="min-w-0 flex-1">
                <h2 class="truncate text-base font-bold">
                  {{ user.displayName || user.email }}
                </h2>
                <p class="truncate text-xs text-slate-500 dark:text-slate-400">
                  {{ user.email }}
                </p>
              </div>
            </div>
            <ng-template #guestBlock>
              <div class="flex items-center gap-4">
                <div
                  class="h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold ring-2 ring-primary/20 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  GU
                </div>
                <div class="min-w-0">
                  <h2 class="truncate text-lg font-bold">Guest</h2>
                  <p
                    class="truncate text-sm text-slate-500 dark:text-slate-400"
                  >
                    Not signed in
                  </p>
                </div>
              </div>
            </ng-template>
          </section>

          <section
            class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h3
              class="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {{ "account.language" | translate }}
            </h3>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                (click)="setLanguage('EN')"
                [class]="getLanguageButtonClasses('EN')"
              >
                EN
              </button>
              <button
                type="button"
                (click)="setLanguage('VN')"
                [class]="getLanguageButtonClasses('VN')"
              >
                VN
              </button>
            </div>
          </section>

          <section
            class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h3
              class="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {{ "account.currency" | translate }}
            </h3>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                (click)="setCurrency('USD')"
                [class]="getCurrencyButtonClasses('USD')"
              >
                USD ($)
              </button>
              <button
                type="button"
                (click)="setCurrency('VND')"
                [class]="getCurrencyButtonClasses('VND')"
              >
                VND (đ)
              </button>
              <button
                type="button"
                (click)="setCurrency('SGD')"
                [class]="getCurrencyButtonClasses('SGD')"
              >
                SGD (S$)
              </button>
              <button
                type="button"
                (click)="setCurrency('RM')"
                [class]="getCurrencyButtonClasses('RM')"
              >
                RM (RM)
              </button>
            </div>

            <div
              class="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70"
            >
              <div
                class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                {{
                  "account.currencyRateTitle"
                    | translate : { currency: currentCurrency() }
                }}
              </div>

              <div
                *ngIf="isSyncingCurrencyRates"
                class="inline-flex items-center gap-2 text-xs font-medium text-primary"
              >
                <span class="material-symbols-outlined animate-spin text-sm"
                  >progress_activity</span
                >
                <span>{{ "account.currencyRateSyncing" | translate }}</span>
              </div>

              <div
                *ngFor="let currency of supportedCurrencies"
                class="grid grid-cols-[80px_1fr] items-center gap-3"
              >
                <label
                  class="text-sm font-semibold text-slate-700 dark:text-slate-300"
                  >{{ currency }}</label
                >
                <input
                  [value]="getCurrencyRateInputValue(currency)"
                  (input)="onCurrencyRateInput(currency, $event)"
                  [disabled]="currency === currentCurrency()"
                  class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  inputmode="decimal"
                  type="number"
                  min="0"
                  step="0.0001"
                />
              </div>
            </div>
          </section>

          <section
            class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:hidden"
          >
            <h3
              class="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {{ "sidebar.theme" | translate }}
            </h3>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                (click)="setTheme('light')"
                [class]="getThemeButtonClasses('light')"
              >
                <span class="material-symbols-outlined text-[18px]"
                  >light_mode</span
                >
                <span>{{ "sidebar.theme.light" | translate }}</span>
              </button>
              <button
                type="button"
                (click)="setTheme('dark')"
                [class]="getThemeButtonClasses('dark')"
              >
                <span class="material-symbols-outlined text-[18px]"
                  >dark_mode</span
                >
                <span>{{ "sidebar.theme.dark" | translate }}</span>
              </button>
              <button
                type="button"
                (click)="setTheme('system')"
                [class]="getThemeButtonClasses('system')"
              >
                <span class="material-symbols-outlined text-[18px]"
                  >desktop_windows</span
                >
                <span>{{ "sidebar.theme.system" | translate }}</span>
              </button>
            </div>
          </section>

          <ng-container *ngIf="user$ | async as user; else signInBtn">
            <button
              *ngIf="hasGuestData"
              type="button"
              (click)="syncGuestData()"
              [disabled]="isSyncingGuestData"
              class="mb-2 flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300"
            >
              <span
                class="material-symbols-outlined text-[18px]"
                [class.animate-spin]="isSyncingGuestData"
              >
                {{ isSyncingGuestData ? "progress_activity" : "sync" }}
              </span>
              <span>
                <ng-container *ngIf="isSyncingGuestData; else syncGuestDataText"
                  >Syncing...</ng-container
                >
                <ng-template #syncGuestDataText>Sync guest data</ng-template>
              </span>
            </button>
            <button
              type="button"
              (click)="onLogout()"
              class="flex h-12 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300"
            >
              <span class="material-symbols-outlined text-[18px]">logout</span>
              <span>{{ "account.logout" | translate }}</span>
            </button>
          </ng-container>
          <ng-template #signInBtn>
            <button
              type="button"
              (click)="signInWithGoogleAccount()"
              class="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#135bec] bg-white text-[#135bec] text-sm font-bold shadow-sm hover:bg-[#f0f6ff] transition-colors"
              style="width:100%"
            >
              <span class="material-symbols-outlined text-[18px]">login</span>
              <span>Sign in with Google</span>
            </button>
          </ng-template>
          <p class="px-1 text-center text-xs text-slate-400">
            {{ "account.mobileHint" | translate }}
          </p>
        </div>
      </section>
    </main>
  `,
})
export class MainContentComponent {
  @Output() newGroupClicked = new EventEmitter<string>();
  @Output() addFriendClicked = new EventEmitter<void>();
  @Output() pageDataLoaded = new EventEmitter<string>();
  @ViewChild(FriendsPageComponent) friendsPage?: FriendsPageComponent;
  @ViewChild(GroupDetailComponent) groupDetailComp?: GroupDetailComponent;
  currentView: ViewType = "joys-table";
  selectedJoyId: string = "";
  selectedGroupId: string = "";
  user$: Observable<any>;
  private readonly brokenAvatarSeeds = new Set<string>();
  hasGuestData = false;
  isSyncingGuestData = false;
  isPageLoading = false;
  private pullStartY: number | null = null;
  pullDistance = 0;
  isPulling = false;
  isPullRefreshing = false;
  private readonly pullTriggerDistance = 66;
  private readonly pullMaxDistance = 96;
  private readonly routeSubscription: Subscription;
  readonly supportedCurrencies: AppCurrency[];
  isSyncingCurrencyRates = false;

  signInWithGoogleAccount() {
    if ((window as any).firebaseAuthSignInWithGoogle) {
      void (window as any)
        .firebaseAuthSignInWithGoogle()
        .catch((error: unknown) => {
          console.error("Google sign in failed:", error);
          const message =
            (error as { message?: string })?.message ||
            "Sign in failed. Please try again.";
          if (typeof (window as any).joysShowToast === "function") {
            (window as any).joysShowToast(message);
          }
        });
    } else {
      void this.userSession.signInWithGoogle().catch((error: unknown) => {
        console.error("Google sign in failed:", error);
        const message =
          (error as { message?: string })?.message ||
          "Sign in failed. Please try again.";
        if (typeof (window as any).joysShowToast === "function") {
          (window as any).joysShowToast(message);
        }
      });
    }
  }

  constructor(
    private readonly translationService: TranslationService,
    private readonly currencyService: CurrencyService,
    private readonly themeService: ThemeService,
    private readonly activityService: ActivityService,
    private readonly userSession: UserSessionService,
    private readonly avatarColorService: AvatarColorService,
    private readonly guestSyncService: GuestSyncService,
    private readonly appRouteService: AppRouteService
  ) {
    this.supportedCurrencies = this.currencyService.supportedCurrencies;
    this.user$ = this.userSession.user$;
    this.user$.subscribe((user) => {
      if (user) {
        console.log("Logged in user profile:", user);
      }

      this.hasGuestData = !!user && this.guestSyncService.hasGuestData();
    });

    this.routeSubscription = this.appRouteService.state$.subscribe((state) => {
      this.currentView = state.view;
      this.selectedJoyId = state.selectedJoyId;
      this.selectedGroupId = state.selectedGroupId;
      if (state.view !== "dashboard" && state.view !== "group-detail") {
        this.isPageLoading = false;
      }
    });
  }
  onDashboardDataLoaded() {
    if (this.isPageLoading) {
      this.isPageLoading = false;
      this.pageDataLoaded.emit("dashboard");
    }
  }

  onGroupDetailDataLoaded() {
    if (this.isPageLoading) {
      this.isPageLoading = false;
      this.pageDataLoaded.emit("group-detail");
    }
  }
  async syncGuestData(): Promise<void> {
    if (this.isSyncingGuestData) {
      return;
    }
    this.isSyncingGuestData = true;
    try {
      await this.guestSyncService.syncGuestDataToCloud();
      this.hasGuestData = false;
      await this.activityService.logActivity({
        type: "other",
        title: "Synced guest data",
        description: "Migrated guest data from local storage to Firebase",
      });
      setTimeout(() => {
        this.isSyncingGuestData = false;
      }, 600);
    } catch (error) {
      console.error("Failed to sync guest data:", error);
      this.isSyncingGuestData = false;
    }
  }

  getAvatarColorClasses(seed?: string | null): string {
    return this.avatarColorService.getInitialAvatarClasses(
      seed ?? "guest-user"
    );
  }

  get showPullRefreshIndicator(): boolean {
    return this.isPulling || this.isPullRefreshing || this.pullDistance > 0;
  }

  get pullRefreshOpacity(): number {
    if (this.isPullRefreshing) {
      return 1;
    }

    return Math.max(
      0,
      Math.min(1, this.pullDistance / this.pullTriggerDistance)
    );
  }

  get pullRefreshTranslateY(): number {
    if (this.isPullRefreshing) {
      return 0;
    }

    return Math.max(-18, 8 - this.pullDistance * 0.25);
  }

  onMainTouchStart(event: TouchEvent): void {
    if (this.isPullRefreshing) {
      return;
    }

    if ((globalThis.window?.innerWidth ?? 1200) >= 1024) {
      this.pullStartY = null;
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    if (!target || target.scrollTop > 0) {
      this.pullStartY = null;
      return;
    }

    this.pullStartY = event.touches[0]?.clientY ?? null;
  }

  onMainTouchMove(event: TouchEvent): void {
    if (this.pullStartY === null || this.isPullRefreshing) {
      return;
    }

    const currentY = event.touches[0]?.clientY ?? this.pullStartY;
    const delta = currentY - this.pullStartY;
    if (delta <= 0) {
      this.pullDistance = 0;
      this.isPulling = false;
      return;
    }

    this.isPulling = true;
    this.pullDistance = Math.min(this.pullMaxDistance, delta * 0.6);
    if (event.cancelable) {
      event.preventDefault();
    }
  }

  onMainTouchEnd(): void {
    if (!this.isPulling || this.isPullRefreshing) {
      this.resetPullState();
      return;
    }

    if (this.pullDistance >= this.pullTriggerDistance) {
      this.isPullRefreshing = true;
      this.pullDistance = this.pullTriggerDistance;
      setTimeout(() => {
        globalThis.window.location.reload();
      }, 120);
      return;
    }

    this.resetPullState();
  }

  onMainTouchCancel(): void {
    if (this.isPullRefreshing) {
      return;
    }

    this.resetPullState();
  }

  private resetPullState(): void {
    this.pullStartY = null;
    this.pullDistance = 0;
    this.isPulling = false;
  }

  getInitials(name?: string | null): string {
    return (
      (name ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "GU"
    );
  }

  hasUserAvatar(user: any): boolean {
    const avatarUrl = user?.photoURL?.trim?.() ?? "";
    if (!avatarUrl) {
      return false;
    }

    return !this.brokenAvatarSeeds.has(this.getAvatarSeed(user));
  }

  onUserAvatarError(user: any): void {
    this.brokenAvatarSeeds.add(this.getAvatarSeed(user));
  }

  private getAvatarSeed(user: any): string {
    return String(
      user?.uid || user?.email || user?.displayName || "guest-user"
    );
  }

  onGroupClicked(groupId: any) {
    if (!this.selectedJoyId || !groupId) {
      return;
    }

    this.isPageLoading = true;
    this.appRouteService.goToGroupDetail(this.selectedJoyId, String(groupId));
  }

  onBackToDashboard() {
    this.appRouteService.goToDashboard(this.selectedJoyId);
  }

  onJoyRowClicked(joy: Joy): void {
    this.isPageLoading = true;
    this.appRouteService.goToDashboard(joy.id);
  }

  onDashboardNewGroupClicked(joyId: string): void {
    this.newGroupClicked.emit(joyId || this.selectedJoyId);
  }

  onDashboardBackToJoys(): void {
    this.appRouteService.goToJoysTable();
  }

  onNavigationChanged(route: string) {
    switch (route) {
      case "dashboard":
        if (this.selectedJoyId) {
          this.appRouteService.goToDashboard(this.selectedJoyId);
          break;
        }
        this.appRouteService.goToJoysTable();
        break;
      case "joys-table":
        this.appRouteService.goToJoysTable();
        break;
      case "friends":
        this.appRouteService.goToFriends();
        break;
      case "activities":
        this.appRouteService.goToActivities();
        break;
      case "account":
        this.appRouteService.goToAccount();
        break;
      default:
        this.appRouteService.goToJoysTable();
    }
  }

  setLanguage(language: AppLanguage): void {
    this.translationService.setLanguage(language);
  }

  setCurrency(currency: AppCurrency): void {
    this.currencyService.setCurrency(currency);
    void this.syncLiveCurrencyRates(currency);
    void this.activityService.logActivity({
      type: "change-currency",
      title: "Changed currency",
      description: `Set app currency to ${currency}`,
      metadata: { currency },
    });
  }

  currentCurrency(): AppCurrency {
    return this.currencyService.currentCurrency();
  }

  onCurrencyRateInput(currency: AppCurrency, event: Event): void {
    const rate = Number((event.target as HTMLInputElement).value || 1);
    this.currencyService.setCurrencyRate(currency, rate);
  }

  getCurrencyRateInputValue(currency: AppCurrency): number {
    return this.currencyService.getCurrencyRate(currency);
  }

  private async syncLiveCurrencyRates(
    targetCurrency: AppCurrency
  ): Promise<void> {
    this.isSyncingCurrencyRates = true;

    try {
      const base = this.toApiCurrency(targetCurrency).toLowerCase();

      const response = await fetch(
        `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`
      );

      if (!response.ok) {
        throw new Error(`Currency API request failed ${response.status}`);
      }

      const payload = await response.json();

      const rates = payload[base];

      if (!rates) {
        throw new Error("Invalid currency response");
      }

      for (const currency of this.supportedCurrencies) {
        if (currency === targetCurrency) {
          this.currencyService.setCurrencyRate(currency, 1);
          continue;
        }

        const code = this.toApiCurrency(currency).toLowerCase();
        const rate = rates[code];

        if (!Number.isFinite(rate)) {
          continue;
        }

        this.currencyService.setCurrencyRate(currency, rate);
      }
    } catch (error) {
      console.error("Currency sync failed", error);

      if (typeof (window as any).joysShowToast === "function") {
        (window as any).joysShowToast(
          this.translationService.t("account.currencyRateSyncFailed")
        );
      }
    } finally {
      this.isSyncingCurrencyRates = false;
    }
  }

  private toApiCurrency(currency: AppCurrency): string {
    return currency === "RM" ? "MYR" : currency;
  }

  getLanguageButtonClasses(language: AppLanguage): string {
    const isActive = this.translationService.currentLanguage() === language;
    const base = "h-11 rounded-xl px-3 text-sm font-semibold transition-colors";
    if (isActive) {
      return `${base} bg-primary text-white`;
    }
    return `${base} border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300`;
  }

  getCurrencyButtonClasses(currency: AppCurrency): string {
    const isActive = this.currencyService.currentCurrency() === currency;
    const base = "h-11 rounded-xl px-3 text-sm font-semibold transition-colors";
    if (isActive) {
      return `${base} bg-primary text-white`;
    }
    return `${base} border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300`;
  }

  setTheme(mode: ThemeMode): void {
    this.themeService.setMode(mode);
  }

  getThemeButtonClasses(mode: ThemeMode): string {
    const isActive = this.themeService.currentMode() === mode;
    const base =
      "h-12 rounded-xl px-2 text-xs font-semibold transition-colors flex flex-col items-center justify-center gap-1";
    if (isActive) {
      return `${base} bg-primary text-white`;
    }
    return `${base} border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300`;
  }

  onLogout(): void {
    this.userSession.signOut().then(() => {
      void this.activityService.logActivity({
        type: "logout",
        title: "Logged out",
        description: "User logged out via Firebase Auth",
      });
      this.appRouteService.goToJoysTable();
    });
  }

  openAddFriendDialog(): void {
    if (this.currentView === "friends") {
      this.friendsPage?.openAddFriendDialog();
      return;
    }

    this.addFriendClicked.emit();
  }

  triggerAddExpense(): void {
    this.groupDetailComp?.openAddExpenseDialog();
  }

  ngOnDestroy(): void {
    this.routeSubscription.unsubscribe();
  }
}
