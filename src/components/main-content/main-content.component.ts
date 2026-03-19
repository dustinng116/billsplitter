import { Component, ElementRef, EventEmitter, Input, NgZone, OnInit, Output, ViewChild } from "@angular/core";
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
  styleUrl: './main-content.component.scss',
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
  templateUrl: './main-content.component.html',
})
export class MainContentComponent implements OnInit {
  @Input() searchQuery = '';
  @Output() newGroupClicked = new EventEmitter<string>();
  @Output() editGroupClicked = new EventEmitter<{ joyId: string; group: any }>();
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
  readonly pullTriggerDistance = 70;
  private readonly pullMaxDistance = 110;
  private readonly minimumLoadingDuration = 500;
  
  private readonly routeSubscription: Subscription;
  readonly supportedCurrencies: AppCurrency[];
  isSyncingCurrencyRates = false;
  syncingCurrencyKey: AppCurrency | null = null;

  signInWithGoogleAccount() {
    if ((window as any).firebaseAuthSignInWithGoogle) {
      void (window as any)
        .firebaseAuthSignInWithGoogle()
        .catch((error: unknown) => {
          console.error("Google sign in failed:", error);
          const message =
            (error as { message?: string })?.message ||
            this.translationService.t("common.signInFailed");
          if (typeof (window as any).joysShowToast === "function") {
            (window as any).joysShowToast(message);
          }
        });
    } else {
      void this.userSession.signInWithGoogle().catch((error: unknown) => {
        console.error("Google sign in failed:", error);
        const message =
          (error as { message?: string })?.message ||
          this.translationService.t("common.signInFailed");
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
    private readonly appRouteService: AppRouteService,
    private readonly ngZone: NgZone,
    private readonly elementRef: ElementRef
  ) {
    this.supportedCurrencies = this.currencyService.supportedCurrencies;
    this.user$ = this.userSession.user$;
    this.user$.subscribe((user) => { 
      this.hasGuestData = !!user && this.guestSyncService.hasGuestData();
    });

    this.routeSubscription = this.appRouteService.state$.subscribe((state) => {
      this.currentView = state.view;
      this.selectedJoyId = state.selectedJoyId;
      this.selectedGroupId = state.selectedGroupId;
      if (state.view !== "dashboard" && state.view !== "group-detail") {
        this.isPageLoading = false;
      }
      if (state.view === "account") {
        // Do not auto-load API on account page — loads from local storage only.
        // User must click the refresh button next to a rate row to fetch from API.
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

  get mainTransform(): string {
    return '';
  }

  ngOnInit(): void {
  }

  private resetPullState(): void {
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

  private setPageLoading(value: boolean): void {
    this.isPageLoading = value;
    if (value) {
      // Safety: always clear loading after 5s to prevent permanently blocking interaction
      setTimeout(() => {
        this.isPageLoading = false;
      }, 5000);
    }
  }

  onGroupClicked(groupId: any) {
    if (!this.selectedJoyId || !groupId) {
      return;
    }

    this.setPageLoading(true);
    this.appRouteService.goToGroupDetail(this.selectedJoyId, String(groupId));
  }

  onEditGroupClicked(group: any) {
    this.editGroupClicked.emit({ joyId: this.selectedJoyId, group });
  }

  onBackToDashboard() {
    this.appRouteService.goToDashboard(this.selectedJoyId);
  }

  onJoyRowClicked(joy: Joy): void {
    this.setPageLoading(true);
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

  isCurrencyRowSyncing(currency: AppCurrency): boolean {
    return this.syncingCurrencyKey === currency;
  }

  syncRateForCurrency(currency: AppCurrency): void {
    if (this.isSyncingCurrencyRates || currency === this.currencyService.currentCurrency()) return;
    this.syncingCurrencyKey = currency;
    void this.syncLiveCurrencyRates(this.currencyService.currentCurrency()).then(() => {
      this.syncingCurrencyKey = null;
    }).catch(() => {
      this.syncingCurrencyKey = null;
    });
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
    return currency; // AppCurrency now uses 'MYR' directly
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
