import { ChangeDetectorRef, Component, NgZone, OnDestroy, ViewChild } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { CommonModule } from "@angular/common";
import { Subscription } from "rxjs";
import { OverlayLoadingComponent } from "./components/shared-common/overlay-loading/overlay-loading.component";
import { HeaderComponent } from "./components/header/header.component";
import { SidebarComponent } from "./components/sidebar/sidebar.component";
import { MainContentComponent } from "./components/main-content/main-content.component";
import { NewGroupDialogComponent } from "./components/new-group-dialog/new-group-dialog.component";
import { CommonDialogComponent } from "./components/shared-common/common-dialog/common-dialog.component";
import { TranslatePipe } from "./pipes/translate.pipe";
import { TranslationService } from "./services/translation.service";
import { initializeFirebaseAnalytics } from "./firebase";
import { AuthService } from "./services/auth.service";
import { AppRouteService, type AppView } from "./services/app-route.service";

@Component({
  selector: "joys-root",
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    SidebarComponent,
    MainContentComponent,
    NewGroupDialogComponent,
    CommonDialogComponent,
    TranslatePipe,
    OverlayLoadingComponent,
  ],
  templateUrl: './app.component.html',
})
export class App {
  private readonly sidebarStorageKey = 'ui.sidebar.collapsed';
  globalLoading = false;
  searchQuery = '';
  currentRouteView: AppView = "joys-table";
  selectedJoyId = "";
  selectedGroupId = "";
  private touchStartX: number | null = null;
  private touchStartY: number | null = null;
  private touchStartTime: number | null = null;
  
  // Pull to refresh state
  pullDistance = 0;
  isPulling = false;
  isPullRefreshing = false;
  private pullStartY: number | null = null;
  readonly pullTriggerDistance = 70;
  private readonly pullMaxDistance = 110;

  private readonly routeSubscription: Subscription;

  constructor(
    private authService: AuthService,
    private readonly appRouteService: AppRouteService,
    private readonly translationService: TranslationService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {
    AuthService.exposeToWindow(this.authService);

    this.routeSubscription = this.appRouteService.state$.subscribe((state) => {
      this.currentRouteView = state.view;
      this.selectedJoyId = state.selectedJoyId;
      this.selectedGroupId = state.selectedGroupId;
    });

    if (typeof globalThis.window !== 'undefined' && globalThis.window.innerWidth >= 1024) {
      this.sidebarCollapsed = this.readSidebarCollapsedState();
    }

    if (typeof globalThis.window !== "undefined") {
      globalThis.window.addEventListener("touchstart", this.onTouchStart, { passive: true });
      globalThis.window.addEventListener("touchmove", this.onTouchMove, { passive: true });
      globalThis.window.addEventListener("touchend", this.onTouchEnd, { passive: true });
      globalThis.window.addEventListener("touchcancel", this.onTouchCancel, { passive: true });
    }
  }

  private readonly onTouchStart = (e: TouchEvent) => {
    if (globalThis.window.innerWidth >= 1024) return; // desktop only
    if (this.isPullRefreshing) return;

    const touch = e.touches[0];
    // Record start for both back-swipe and pull detection
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();

    // Snapshot the pullStartY — we'll decide in touchmove whether to use it
    const mainEl = globalThis.window.document.querySelector('main') as HTMLElement | null;
    const isAtTop = !mainEl || mainEl.scrollTop <= 5;
    const touchedOutsideMain = mainEl ? !mainEl.contains(e.target as Node) : true;

    // Pre-arm pull if we're at the scroll top or outside the scrollable area.
    // We do NOT set isPulling yet — that only happens when the move direction is confirmed.
    this.pullStartY = (isAtTop || touchedOutsideMain) ? touch.clientY : null;
  };

  private readonly onTouchMove = (e: TouchEvent) => {
    if (globalThis.window.innerWidth >= 1024) return;
    if (this.pullStartY === null || this.isPullRefreshing) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - this.pullStartY;
    const deltaX = Math.abs(touch.clientX - (this.touchStartX ?? touch.clientX));

    // ── Key guard ──────────────────────────────────────────────────────────
    // If the gesture isn't clearly downward-vertical, cancel the pull arm and
    // let the event propagate untouched to child elements (swipe, scroll, tap).
    if (!this.isPulling) {
      if (deltaY < 10) return;           // haven't moved far enough yet
      if (deltaX > deltaY) {             // more horizontal than vertical → not a pull
        this.pullStartY = null;
        return;
      }
    }
    // ───────────────────────────────────────────────────────────────────────

    if (deltaY <= 0) {
      if (this.isPulling) {
        // Only update Angular when we were actually pulling
        this.ngZone.run(() => {
          this.isPulling = false;
          this.pullDistance = 0;
          this.cdr.detectChanges();
        });
      }
      return;
    }

    // Confirmed pull — update UI
    const newDistance = Math.min(this.pullMaxDistance, deltaY * 0.5);
    this.ngZone.run(() => {
      this.isPulling = true;
      this.pullDistance = newDistance;
      this.cdr.detectChanges();
    });
  };

  private readonly onTouchEnd = (e: TouchEvent) => {
    if (globalThis.window.innerWidth >= 1024) return;

    // Only handle pull logic if we were actually pulling
    if (this.isPulling && !this.isPullRefreshing) {
      if (this.pullDistance >= this.pullTriggerDistance) {
        this.ngZone.run(() => {
          this.isPulling = false;
          this.isPullRefreshing = true;
          this.pullDistance = this.pullTriggerDistance;
          this.cdr.detectChanges();
        });
        setTimeout(() => {
          globalThis.window.location.reload();
        }, 800);
      } else {
        this.ngZone.run(() => {
          this.resetPullState();
          this.cdr.detectChanges();
        });
      }
      // Consumed by pull — don't also fire back-swipe
      this.touchStartX = this.touchStartY = this.touchStartTime = null;
      return;
    }

    // Not a pull — handle back-swipe detection and clear state, no Angular run needed
    if (this.touchStartX !== null && this.touchStartY !== null && this.touchStartTime !== null) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - this.touchStartX;
      const dy = Math.abs(touch.clientY - this.touchStartY);
      const dt = Date.now() - this.touchStartTime;

      if (this.touchStartX <= 30 && dx > 50 && dy < 40 && dt < 500) {
        globalThis.window.history.back();
      }
    }

    this.touchStartX = this.touchStartY = this.touchStartTime = null;
    // Reset pull arm without Angular zone (state was never set, so no CD needed)
    this.pullStartY = null;
  };

  private readonly onTouchCancel = () => {
    if (this.isPulling) {
      this.ngZone.run(() => {
        this.resetPullState();
        this.cdr.detectChanges();
      });
    } else {
      this.pullStartY = null;
    }
    this.touchStartX = this.touchStartY = this.touchStartTime = null;
  };

  private resetPullState() {
    this.pullStartY = null;
    this.pullDistance = 0;
    this.isPulling = false;
  }

  get showPullRefreshIndicator(): boolean {
    return this.isPulling || this.isPullRefreshing || this.pullDistance > 0;
  }

  get pullRefreshOpacity(): number {
    if (this.isPullRefreshing) return 1;
    return Math.max(0, Math.min(1, (this.pullDistance - 5) / 35));
  }

  get mainContainerTransform(): string {
    if (this.isPullRefreshing) {
      return `translate3d(0, ${this.pullTriggerDistance}px, 0)`;
    }
    if (this.isPulling) {
      return `translate3d(0, ${this.pullDistance}px, 0)`;
    }
    return '';
  }
  @ViewChild("mainContent") mainContent!: MainContentComponent;
  @ViewChild("newGroupDialog") newGroupDialog!: NewGroupDialogComponent;
  sidebarCollapsed = false;
  // Controls overlay open state for mobile/tablet
  sidebarOverlay = false;

  toggleSidebar() {
    const win = (globalThis as any).window;
    const isSmall = !!win && win.innerWidth < 1024;
    if (isSmall) {
      this.sidebarOverlay = !this.sidebarOverlay;
    } else {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      this.persistSidebarCollapsedState(this.sidebarCollapsed);
    }
  }

  onSidebarCollapseToggle(collapsed: boolean): void {
    this.sidebarCollapsed = collapsed;
    this.persistSidebarCollapsedState(collapsed);
  }

  onSearchChanged(query: string): void {
    this.searchQuery = query;
  }

  private readSidebarCollapsedState(): boolean {
    try {
      return localStorage.getItem(this.sidebarStorageKey) === '1';
    } catch {
      return false;
    }
  }

  private persistSidebarCollapsedState(collapsed: boolean): void {
    try {
      localStorage.setItem(this.sidebarStorageKey, collapsed ? '1' : '0');
    } catch {
      // ignore storage errors
    }
  }

  onNavigationChanged(route: string) {
    this.globalLoading = false;
    this.mainContent.onNavigationChanged(route);
  }

  onCreateGroupClicked(joyId = "") {
    const selectedJoyId = joyId || this.selectedJoyId || this.mainContent?.selectedJoyId || "";
    this.newGroupDialog.open(selectedJoyId);
  }

  onEditGroupClicked(event: { joyId: string; group: any }) {
    this.newGroupDialog.openForEdit(event.joyId, event.group);
  }

  // Placeholder for sign-in logic that would use the translation service
  // This block is added based on the user's instruction to "translate hardcoded sign-in error messages"
  // and the provided Code Edit snippet, which implies such a method exists or should be considered.
  // The original App component does not contain sign-in methods, so this is an illustrative addition.
  private handleSignInError(error: unknown): void {
    console.error("Sign in failed:", error);
    const message =
      (error as { message?: string })?.message ||
      this.translationService.t("common.signInFailed"); // Using translation service
    if (typeof (window as any).joysShowToast === "function") {
      (window as any).joysShowToast(message);
    }
  }

  onGroupCreated(group: any) {
    console.log("New group created:", group);
    // Intentionally left TODOs for business logic: add group to list, show message, navigate
  }

  onBottomNavigation(route: string): void {
    this.onNavigationChanged(route);
  }

  isBottomNavActive(
    item: "joys" | "friends" | "activities" | "account"
  ): boolean {
    const view = this.currentRouteView;
    return (
      (item === "joys" && ["joys-table", "dashboard", "group-detail"].includes(view)) ||
      (item === "friends" && view === "friends") ||
      (item === "activities" && view === "activities") ||
      (item === "account" && view === "account")
    );
  }

  getBottomNavItemClasses(
    item: "joys" | "friends" | "activities" | "account"
  ): string {
    if (this.isBottomNavActive(item)) {
      return "liquid-glass-item-active";
    }

    return "liquid-glass-item-inactive";
  }

  isFriendsView(): boolean {
    return this.currentRouteView === "friends";
  }

  isDashboardView(): boolean {
    return this.currentRouteView === "dashboard" && !!this.selectedJoyId;
  }

  isGroupDetailView(): boolean {
    return this.currentRouteView === "group-detail";
  }

  openAddFriendFromDock(): void {
    this.mainContent?.openAddFriendDialog();
  }

  openAddExpenseFromDock(): void {
    this.mainContent?.triggerAddExpense();
  }

  ngOnDestroy(): void {
    this.routeSubscription.unsubscribe();
  }
}

void initializeFirebaseAnalytics();

bootstrapApplication(App);
