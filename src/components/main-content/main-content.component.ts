import { Component, ElementRef, EventEmitter, NgZone, OnInit, Output, ViewChild } from "@angular/core";
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
  private pullStartY: number | null = null;
  pullDistance = 0;
  isPulling = false;
  isPullRefreshing = false;
  readonly pullTriggerDistance = 70;
  private readonly pullMaxDistance = 110;
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
    private readonly appRouteService: AppRouteService,
    private readonly ngZone: NgZone,
    private readonly elementRef: ElementRef
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
      if (state.view === "account") {
        void this.syncLiveCurrencyRates(this.currencyService.currentCurrency());
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

    // Show more aggressively: starts showing at 5px, fully opaque at 40px
    return Math.max(
      0,
      Math.min(1, (this.pullDistance - 5) / 35)
    );
  }

  get pullRefreshTranslateY(): number {
    if (this.isPullRefreshing) {
      return 0;
    }

    return Math.max(-18, 8 - this.pullDistance * 0.25);
  }

  get mainTransform(): string {
    if (this.isPullRefreshing) {
      return `translate3d(0, ${this.pullTriggerDistance}px, 0)`;
    }
    if (this.isPulling) {
      return `translate3d(0, ${this.pullDistance}px, 0)`;
    }
    return '';
  }

  ngOnInit(): void {
    // Register touch listeners outside Angular so we can use { passive: true } for touchstart/touchmove.
    // This is CRITICAL on iOS Safari: non-passive touchmove listeners on a scroll container
    // prevent the browser from delivering tap/click events to child elements.
    this.ngZone.runOutsideAngular(() => {
      const mainEl = this.elementRef.nativeElement.querySelector('main') as HTMLElement | null;
      if (!mainEl) return;

      mainEl.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: true });
      mainEl.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: true });
      mainEl.addEventListener('touchend', () => this._onTouchEnd(), { passive: true });
      mainEl.addEventListener('touchcancel', () => this._onTouchCancel(), { passive: true });
    });
  }

  private _onTouchStart(event: TouchEvent): void {
    if (this.isPullRefreshing) return;
    if ((globalThis.window?.innerWidth ?? 1200) >= 1024) {
      this.pullStartY = null;
      return;
    }
    const target = event.currentTarget as HTMLElement | null;
    if (!target || target.scrollTop > 5) {
      this.pullStartY = null;
      return;
    }
    this.pullStartY = event.touches[0]?.clientY ?? null;
  }

  private _onTouchMove(event: TouchEvent): void {
    if (this.pullStartY === null || this.isPullRefreshing) return;
    const currentY = event.touches[0]?.clientY ?? this.pullStartY;
    const delta = currentY - this.pullStartY;
    if (delta <= 0) {
      this.ngZone.run(() => {
        this.pullDistance = 0;
        this.isPulling = false;
      });
      return;
    }
    // We do NOT prevent default here so iOS Safari allows taps.
    // overscroll-behavior-y: none on the container prevents the native bounce
    this.ngZone.run(() => {
      this.isPulling = true;
      this.pullDistance = Math.min(this.pullMaxDistance, delta * 0.5);
    });
  }

  private _onTouchEnd(): void {
    this.ngZone.run(() => {
      if (!this.isPulling || this.isPullRefreshing) {
        this.resetPullState();
        return;
      }
      if (this.pullDistance >= this.pullTriggerDistance) {
        this.isPullRefreshing = true;
        this.pullDistance = this.pullTriggerDistance;
        this.isPulling = false; // allows css transition to kick in for smooth release
        
        // Wait 800ms for the user to see the refresh animation 
        // before doing a hard browser reload
        setTimeout(() => {
          globalThis.window.location.reload();
        }, 800);
        return;
      }
      this.resetPullState();
    });
  }

  private _onTouchCancel(): void {
    if (this.isPullRefreshing) return;
    this.ngZone.run(() => this.resetPullState());
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
