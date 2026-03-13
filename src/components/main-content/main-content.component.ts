import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { UserSessionService } from '../../services/user-session.service';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { GroupDetailComponent } from '../group-detail/group-detail.component';
import { JoysTableComponent } from '../joys-table/joys-table.component';
import { FriendsPageComponent } from '../friends-page/friends-page.component';
import { ActivitiesPageComponent } from '../activities-page/activities-page.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppLanguage, TranslationService } from '../../services/translation.service';
import { AppCurrency, CurrencyService } from '../../services/currency.service';
import { ThemeMode, ThemeService } from '../../services/theme.service';
import { ActivityService } from '../../services/activity.service';
import { Joy } from '../../types/joy.interface';

type ViewType = 'dashboard' | 'group-detail' | 'joys-table' | 'friends' | 'activities' | 'account';

@Component({
  selector: 'joys-main-content',
  standalone: true,
  imports: [CommonModule, DashboardComponent, GroupDetailComponent, JoysTableComponent, FriendsPageComponent, ActivitiesPageComponent, TranslatePipe],
  template: `
    <main class="h-full overflow-y-auto bg-slate-50 dark:bg-background-dark w-full" style="padding-bottom:calc(env(safe-area-inset-bottom,0px) + 6rem);padding-top:env(safe-area-inset-top,0px);padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px);">
      <!-- Dashboard View -->
      <div *ngIf="currentView === 'dashboard'" class="w-full page-fade-in">
        <joys-dashboard
          [joyId]="selectedJoyId"
          (groupClicked)="onGroupClicked($event)"
          (newGroupClicked)="onDashboardNewGroupClicked($event)"
          (backToJoysClicked)="onDashboardBackToJoys()"
        ></joys-dashboard>
      </div>
      
      <!-- Group Detail View -->
      <joys-group-detail 
        *ngIf="currentView === 'group-detail'"
        class="page-fade-in"
        [joyId]="selectedJoyId"
        [groupId]="selectedGroupId"
        (backClicked)="onBackToDashboard()"
      ></joys-group-detail>
      
      <!-- Joys Table View -->
      <joys-joys-table
        *ngIf="currentView === 'joys-table'"
        class="page-fade-in"
        (joyRowClicked)="onJoyRowClicked($event)"
      ></joys-joys-table>

      <joys-friends-page *ngIf="currentView === 'friends'" class="page-fade-in"></joys-friends-page>

      <joys-activities-page *ngIf="currentView === 'activities'" class="page-fade-in"></joys-activities-page>

      <section *ngIf="currentView === 'account'" class="p-5 md:p-8 page-fade-in">
        <div class="mx-auto flex max-w-xl flex-col gap-4 pb-4">
          <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div class="flex items-center gap-4" *ngIf="(user$ | async) as user; else guestBlock">
              <img
                [src]="user.photoURL || 'https://ui-avatars.com/api/?name=' + (user.displayName || user.email)"
                [alt]="user.displayName || user.email"
                class="h-16 w-16 rounded-full object-cover ring-2 ring-primary/20"
              />
              <div class="min-w-0">
                <h2 class="truncate text-lg font-bold">{{ user.displayName || user.email }}</h2>
                <p class="truncate text-sm text-slate-500 dark:text-slate-400">{{ user.email }}</p>
              </div>
            </div>
            <ng-template #guestBlock>
              <div class="flex items-center gap-4">
                <img
                  src="https://ui-avatars.com/api/?name=Guest"
                  alt="Guest"
                  class="h-16 w-16 rounded-full object-cover ring-2 ring-primary/20"
                />
                <div class="min-w-0">
                  <h2 class="truncate text-lg font-bold">Guest</h2>
                  <p class="truncate text-sm text-slate-500 dark:text-slate-400">Not signed in</p>
                </div>
              </div>
            </ng-template>
          </section>

          <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {{ 'account.language' | translate }}
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

          <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {{ 'account.currency' | translate }}
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
            </div>
          </section>

          <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:hidden">
            <h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {{ 'sidebar.theme' | translate }}
            </h3>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                (click)="setTheme('light')"
                [class]="getThemeButtonClasses('light')"
              >
                <span class="material-symbols-outlined text-[18px]">light_mode</span>
                <span>{{ 'sidebar.theme.light' | translate }}</span>
              </button>
              <button
                type="button"
                (click)="setTheme('dark')"
                [class]="getThemeButtonClasses('dark')"
              >
                <span class="material-symbols-outlined text-[18px]">dark_mode</span>
                <span>{{ 'sidebar.theme.dark' | translate }}</span>
              </button>
              <button
                type="button"
                (click)="setTheme('system')"
                [class]="getThemeButtonClasses('system')"
              >
                <span class="material-symbols-outlined text-[18px]">desktop_windows</span>
                <span>{{ 'sidebar.theme.system' | translate }}</span>
              </button>
            </div>
          </section>

          <ng-container *ngIf="(user$ | async) as user; else signInBtn">
            <button
              type="button"
              (click)="onLogout()"
              class="flex h-12 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300"
            >
              <span class="material-symbols-outlined text-[18px]">logout</span>
              <span>{{ 'account.logout' | translate }}</span>
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
          <p class="px-1 text-center text-xs text-slate-400">{{ 'account.mobileHint' | translate }}</p>
        </div>
      </section>
    </main>
  `
})
export class MainContentComponent {
  @Output() newGroupClicked = new EventEmitter<string>();
  @Output() addFriendClicked = new EventEmitter<void>();
  @ViewChild(FriendsPageComponent) friendsPage?: FriendsPageComponent;
  @ViewChild(GroupDetailComponent) groupDetailComp?: GroupDetailComponent;
  currentView: ViewType = 'joys-table';
  selectedJoyId: string = '';
  selectedGroupId: string = '';
  user$: Observable<any>;

  signInWithGoogleAccount() {
    if ((window as any).firebaseAuthSignInWithGoogle) {
      (window as any).firebaseAuthSignInWithGoogle();
    } else {
      const win = window as any;
      if (win.google && win.google.accounts && win.google.accounts.id) {
        try {
          win.google.accounts.id.prompt();
        } catch {}
      }
    }
  }

  constructor(
    private readonly translationService: TranslationService,
    private readonly currencyService: CurrencyService,
    private readonly themeService: ThemeService,
    private readonly activityService: ActivityService,
    private readonly userSession: UserSessionService
  ) {
    this.user$ = this.userSession.user$;
  }

  onGroupClicked(groupId: any) {
    this.selectedGroupId = groupId;
    this.currentView = 'group-detail';
  }

  onBackToDashboard() {
    this.currentView = 'dashboard';
    this.selectedGroupId = '';
  }

  onJoyRowClicked(joy: Joy): void {
    this.selectedJoyId = joy.id;
    this.currentView = 'dashboard';
    this.selectedGroupId = '';
  }

  onDashboardNewGroupClicked(joyId: string): void {
    this.newGroupClicked.emit(joyId || this.selectedJoyId);
  }

  onDashboardBackToJoys(): void {
    this.currentView = 'joys-table';
    this.selectedGroupId = '';
    this.selectedJoyId = '';
  }

  onNavigationChanged(route: string) {
    switch (route) {
      case 'dashboard':
        this.currentView = 'dashboard';
        break;
      case 'joys-table':
        this.currentView = 'joys-table';
        break;
      case 'friends':
        this.currentView = 'friends';
        break;
      case 'activities':
        this.currentView = 'activities';
        break;
      case 'account':
        this.currentView = 'account';
        break;
      default:
        this.currentView = 'joys-table';
    }
    this.selectedGroupId = '';
    if (this.currentView !== 'dashboard') {
      this.selectedJoyId = '';
    }
  }

  setLanguage(language: AppLanguage): void {
    this.translationService.setLanguage(language);
  }

  setCurrency(currency: AppCurrency): void {
    this.currencyService.setCurrency(currency);
    void this.activityService.logActivity({
      type: 'change-currency',
      title: 'Changed currency',
      description: `Set app currency to ${currency}`,
      metadata: { currency }
    });
  }

  getLanguageButtonClasses(language: AppLanguage): string {
    const isActive = this.translationService.currentLanguage() === language;
    const base = 'h-11 rounded-xl px-3 text-sm font-semibold transition-colors';
    if (isActive) {
      return `${base} bg-primary text-white`;
    }
    return `${base} border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300`;
  }

  getCurrencyButtonClasses(currency: AppCurrency): string {
    const isActive = this.currencyService.currentCurrency() === currency;
    const base = 'h-11 rounded-xl px-3 text-sm font-semibold transition-colors';
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
    const base = 'h-12 rounded-xl px-2 text-xs font-semibold transition-colors flex flex-col items-center justify-center gap-1';
    if (isActive) {
      return `${base} bg-primary text-white`;
    }
    return `${base} border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300`;
  }

  onLogout(): void {
    this.userSession.signOut().then(() => {
      void this.activityService.logActivity({
        type: 'logout',
        title: 'Logged out',
        description: 'User logged out via Firebase Auth'
      });
      this.currentView = 'joys-table';
      this.selectedJoyId = '';
      this.selectedGroupId = '';
    });
  }

  openAddFriendDialog(): void {
    if (this.currentView === 'friends') {
      this.friendsPage?.openAddFriendDialog();
      return;
    }

    this.addFriendClicked.emit();
  }

  triggerAddExpense(): void {
    this.groupDetailComp?.openAddExpenseDialog();
  }
}