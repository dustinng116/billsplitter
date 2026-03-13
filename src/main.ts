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
  globalLoading = false;
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

    if (typeof globalThis.window !== "undefined") {
      globalThis.window.addEventListener("touchstart", this.onTouchStart, { passive: true });
      globalThis.window.addEventListener("touchmove", this.onTouchMove, { passive: true });
      globalThis.window.addEventListener("touchend", this.onTouchEnd, { passive: true });
      globalThis.window.addEventListener("touchcancel", this.onTouchCancel, { passive: true });
    }
  }

  private readonly onTouchStart = (e: TouchEvent) => {
    if (globalThis.window.innerWidth >= 1024) return; // Only mobile
    if (this.isPullRefreshing) return;

    const touch = e.touches[0];
    // Record for back-swipe detection
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();

    // Allow pull from ANYWHERE — check if the scrollable `main` is at top,
    // but if the touch started OUTSIDE the main element (e.g. header, dock),
    // still allow pull since there is nothing to scroll there.
    const mainEl = globalThis.window.document.querySelector('main') as HTMLElement | null;
    const isAtTop = !mainEl || mainEl.scrollTop <= 5;
    const touchedOutsideMain = mainEl ? !mainEl.contains(e.target as Node) : true;

    if (isAtTop || touchedOutsideMain) {
      this.pullStartY = touch.clientY;
    } else {
      this.pullStartY = null;
    }
  };

  private readonly onTouchMove = (e: TouchEvent) => {
    if (globalThis.window.innerWidth >= 1024) return;
    if (this.pullStartY === null || this.isPullRefreshing) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - this.pullStartY;

    // Start pulling threshold
    if (!this.isPulling && deltaY < 10) {
      return;
    }

    if (deltaY <= 0) {
      // Snap back smoothly
      this.ngZone.run(() => {
        this.isPulling = false;
        this.pullDistance = 0;
        this.cdr.detectChanges();
      });
      return;
    }

    // Use ngZone.run so the template updates as the finger moves
    this.ngZone.run(() => {
      this.isPulling = true;
      this.pullDistance = Math.min(this.pullMaxDistance, deltaY * 0.5);
      this.cdr.detectChanges();
    });
  };

  private readonly onTouchEnd = (e: TouchEvent) => {
    if (globalThis.window.innerWidth >= 1024) return;
    
    // 1. Handle Refresh Check
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
    }

    // 2. Handle Back Swipe (existing logic)
    if (this.touchStartX !== null && this.touchStartY !== null && this.touchStartTime !== null) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - this.touchStartX;
      const dy = Math.abs(touch.clientY - this.touchStartY);
      const dt = Date.now() - this.touchStartTime;

      if (this.touchStartX <= 30 && dx > 50 && dy < 40 && dt < 500 && !this.isPulling) {
        globalThis.window.history.back();
      }
    }

    this.touchStartX = this.touchStartY = this.touchStartTime = null;
    if (!this.isPullRefreshing) {
      this.ngZone.run(() => {
        this.resetPullState();
        this.cdr.detectChanges();
      });
    }
  };

  private readonly onTouchCancel = () => {
    this.resetPullState();
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
