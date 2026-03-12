import { Component, ViewChild } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { MainContentComponent } from './components/main-content/main-content.component';
import { NewGroupDialogComponent } from './components/new-group-dialog/new-group-dialog.component';
import { CommonDialogComponent } from './components/shared-common/common-dialog/common-dialog.component';
import { TranslatePipe } from './pipes/translate.pipe';
import { initializeFirebaseAnalytics } from './firebase';

@Component({
  selector: 'joys-root',
  standalone: true,
  imports: [CommonModule, HeaderComponent, SidebarComponent, MainContentComponent, NewGroupDialogComponent, CommonDialogComponent, TranslatePipe],
  template: `
    <div class="relative flex h-[100dvh] w-screen overflow-hidden bg-slate-50 dark:bg-background-dark">
      <div class="hidden lg:block">
        <joys-sidebar 
          [collapsed]="sidebarCollapsed"
          [externalOverlay]="sidebarOverlay"
          (externalOverlayChange)="sidebarOverlay = $event"
          (collapseToggle)="sidebarCollapsed = $event"
          (navigationClicked)="onNavigationChanged($event)"
        ></joys-sidebar>
      </div>
      <div class="flex min-h-0 flex-1 flex-col">
        <div class="hidden lg:block">
          <joys-header (createGroupClicked)="onCreateGroupClicked()" [sidebarCollapsed]="sidebarCollapsed" (toggleSidebar)="toggleSidebar()"></joys-header>
        </div>
        <div class="min-h-0 flex-1 w-full">
          <joys-main-content #mainContent (newGroupClicked)="onCreateGroupClicked($event)"></joys-main-content>
        </div>
      </div>

      <div class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] lg:hidden">
      <div class="liquid-dock-layout pointer-events-auto w-full items-end">
      <nav class="liquid-glass-dock liquid-glass-entrance w-full" [attr.aria-label]="'mobileNav.activities' | translate">
        <div class="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            (click)="onBottomNavigation('joys-table')"
            class="liquid-glass-item"
            [attr.data-active]="isBottomNavActive('joys')"
            [class]="getBottomNavItemClasses('joys')"
          >
            <span class="material-symbols-outlined text-[22px] leading-none">auto_awesome</span>
            <span class="text-[10px] font-semibold leading-none">{{ 'mobileNav.joys' | translate }}</span>
          </button>

          <button
            type="button"
            (click)="onBottomNavigation('friends')"
            class="liquid-glass-item"
            [attr.data-active]="isBottomNavActive('friends')"
            [class]="getBottomNavItemClasses('friends')"
          >
            <span class="material-symbols-outlined text-[22px] leading-none">group</span>
            <span class="text-[10px] font-semibold leading-none">{{ 'mobileNav.friends' | translate }}</span>
          </button>

          <button
            type="button"
            (click)="onBottomNavigation('activities')"
            class="liquid-glass-item"
            [attr.data-active]="isBottomNavActive('activities')"
            [class]="getBottomNavItemClasses('activities')"
          >
            <span class="material-symbols-outlined text-[22px] leading-none">timeline</span>
            <span class="text-[10px] font-semibold leading-none">{{ 'mobileNav.activities' | translate }}</span>
          </button>

          <button
            type="button"
            (click)="onBottomNavigation('account')"
            class="liquid-glass-item"
            [attr.data-active]="isBottomNavActive('account')"
            [class]="getBottomNavItemClasses('account')"
          >
            <span class="material-symbols-outlined text-[22px] leading-none">person</span>
            <span class="text-[10px] font-semibold leading-none">{{ 'mobileNav.account' | translate }}</span>
          </button>
        </div>
      </nav>

      <button
        *ngIf="isFriendsView()"
        type="button"
        (click)="openAddFriendFromDock()"
        class="liquid-glass-dock liquid-dock-side-button liquid-glass-entrance"
        [attr.aria-label]="'friends.add' | translate"
        [title]="'friends.add' | translate"
      >
        <span class="material-symbols-outlined text-[20px]">person_add</span>
      </button>

      <button
        *ngIf="isDashboardView()"
        type="button"
        (click)="onCreateGroupClicked()"
        class="liquid-glass-dock liquid-dock-side-button liquid-glass-entrance"
          [attr.aria-label]="'newGroup.title' | translate"
          [title]="'newGroup.title' | translate"
      >
        <span class="material-symbols-outlined text-[20px]">add_circle</span>
      </button>

      <button
        *ngIf="isGroupDetailView()"
        type="button"
        (click)="openAddExpenseFromDock()"
        class="liquid-glass-dock liquid-dock-side-button liquid-glass-entrance"
          [attr.aria-label]="'groupDetail.addExpense' | translate"
          [title]="'groupDetail.addExpense' | translate"
      >
        <span class="material-symbols-outlined text-[20px]">add_circle</span>
      </button>
      </div>
      </div>
    </div>

    <joys-new-group-dialog #newGroupDialog (groupCreated)="onGroupCreated($event)"></joys-new-group-dialog>
    <joys-common-dialog></joys-common-dialog>
  `
})
export class App {
  @ViewChild('mainContent') mainContent!: MainContentComponent;
  @ViewChild('newGroupDialog') newGroupDialog!: NewGroupDialogComponent;
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
    this.mainContent.onNavigationChanged(route);
  }

  onCreateGroupClicked(joyId = '') {
    const selectedJoyId = joyId || this.mainContent?.selectedJoyId || '';
    this.newGroupDialog.open(selectedJoyId);
  }

  onGroupCreated(group: any) {
    console.log('New group created:', group);
    // Intentionally left TODOs for business logic: add group to list, show message, navigate
  }

  onBottomNavigation(route: string): void {
    this.onNavigationChanged(route);
  }

  isBottomNavActive(item: 'joys' | 'friends' | 'activities' | 'account'): boolean {
    const view = this.mainContent?.currentView ?? 'joys-table';
    return (
      (item === 'joys' && view === 'joys-table') ||
      (item === 'friends' && view === 'friends') ||
      (item === 'activities' && view === 'activities') ||
      (item === 'account' && view === 'account')
    );
  }

  getBottomNavItemClasses(item: 'joys' | 'friends' | 'activities' | 'account'): string {
    if (this.isBottomNavActive(item)) {
      return 'liquid-glass-item-active';
    }

    return 'liquid-glass-item-inactive';
  }

  isFriendsView(): boolean {
    return (this.mainContent?.currentView ?? 'joys-table') === 'friends';
  }

  isDashboardView(): boolean {
    return (this.mainContent?.currentView ?? '') === 'dashboard' && !!this.mainContent?.selectedJoyId;
  }

  isGroupDetailView(): boolean {
    return (this.mainContent?.currentView ?? '') === 'group-detail';
  }

  openAddFriendFromDock(): void {
    this.mainContent?.openAddFriendDialog();
  }

  openAddExpenseFromDock(): void {
    this.mainContent?.triggerAddExpense();
  }
}

void initializeFirebaseAnalytics();

bootstrapApplication(App);