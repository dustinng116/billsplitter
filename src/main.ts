import { Component, OnDestroy, ViewChild } from "@angular/core";
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
  private readonly routeSubscription: Subscription;

  constructor(
    private authService: AuthService,
    private readonly appRouteService: AppRouteService
  ) {
    AuthService.exposeToWindow(this.authService);

    this.routeSubscription = this.appRouteService.state$.subscribe((state) => {
      this.currentRouteView = state.view;
      this.selectedJoyId = state.selectedJoyId;
      this.selectedGroupId = state.selectedGroupId;
    });

    if (typeof globalThis.window !== "undefined") {
      globalThis.window.addEventListener("touchstart", this.onTouchStart, {
        passive: true,
      });
      globalThis.window.addEventListener("touchend", this.onTouchEnd, {
        passive: true,
      });
    }
  }

  private readonly onTouchStart = (e: TouchEvent) => {
    if (globalThis.window.innerWidth >= 1024) return; // Only mobile
    const touch = e.touches[0];
    if (touch.clientX > 30) return; // Only left edge
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();
  };

  private readonly onTouchEnd = (e: TouchEvent) => {
    if (globalThis.window.innerWidth >= 1024) return;
    if (
      this.touchStartX === null ||
      this.touchStartY === null ||
      this.touchStartTime === null
    )
      return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - this.touchStartX;
    const dy = Math.abs(touch.clientY - this.touchStartY);
    const dt = Date.now() - this.touchStartTime;
    // Swipe right, mostly horizontal, quick, at least 50px
    if (this.touchStartX <= 30 && dx > 50 && dy < 40 && dt < 500) {
      globalThis.window.history.back();
    }
    this.touchStartX = this.touchStartY = this.touchStartTime = null;
  };
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
