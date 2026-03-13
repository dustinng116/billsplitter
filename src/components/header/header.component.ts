import { ChangeDetectorRef, Component, HostListener, Input, OnDestroy, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { CurrencyService, type AppCurrency } from '../../services/currency.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppLanguage, TranslationService } from '../../services/translation.service';
import { UserSessionService } from '../../services/user-session.service';
import { AppRouteService } from '../../services/app-route.service';
import { AvatarColorService } from '../../services/avatar-color.service';
import { GuestSyncService } from '../../services/guest-sync.service';
import { ActivityService } from '../../services/activity.service';

@Component({
  selector: 'joys-header',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  // outputs property removed, use @Output decorator
  template: `
    <header class="flex items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-4 lg:px-10 py-3 sticky top-0 z-50 w-full">
      <div class="flex flex-1 items-center gap-4">
        <button class="lg:hidden flex-none h-10 w-10 mr-2 rounded-md bg-white dark:bg-slate-900 shadow flex items-center justify-center" (click)="toggleSidebar.emit()" [attr.aria-label]="'header.openMenu' | translate">
          <span class="material-symbols-outlined">menu</span>
        </button>
        <label class="hidden sm:flex flex-col min-w-0 h-10 max-w-64 w-full">
          <div class="flex w-full flex-1 items-stretch rounded-lg h-full overflow-hidden border border-slate-200 dark:border-slate-700">
            <div class="text-slate-500 flex bg-slate-50 dark:bg-slate-800 items-center justify-center pl-4 pr-1">
              <span class="material-symbols-outlined text-xl">search</span>
            </div>
            <input 
              class="form-input flex w-full min-w-0 flex-1 border-none bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-0 px-2 text-sm" 
              [placeholder]="'app.searchPlaceholder' | translate"
              [value]="searchValue"
              (input)="onSearchChange($event)"
            />
          </div>
        </label>
        <div class="flex-1"></div>
        <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            (click)="setLanguage('EN')"
            [class]="getLanguageButtonClasses('EN')"
          >
            {{ 'header.language.EN' | translate }}
          </button>
          <button
            type="button"
            (click)="setLanguage('VN')"
            [class]="getLanguageButtonClasses('VN')"
          >
            {{ 'header.language.VN' | translate }}
          </button>
        </div>
        <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            (click)="setCurrency('USD')"
            [class]="getCurrencyButtonClasses('USD')"
          >
            $
          </button>
          <button
            type="button"
            (click)="setCurrency('VND')"
            [class]="getCurrencyButtonClasses('VND')"
          >
            đ
          </button>
        </div>
        <div class="relative ml-auto">
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-2 ring-primary/20 transition-transform hover:scale-[1.02] sm:h-10 sm:w-10"
            (click)="toggleUserMenu($event)"
            [attr.aria-expanded]="userMenuOpen"
            [attr.aria-label]="'header.userProfile' | translate"
            [title]="user?.displayName || user?.email || 'Guest'"
          >
            <img
              *ngIf="hasUserAvatar(user); else avatarFallback"
              [src]="user.photoURL"
              [alt]="user?.displayName || user?.email || 'Guest'"
              (error)="onUserAvatarError(user)"
              class="h-full w-full object-cover"
            />
            <ng-template #avatarFallback>
              <span class="flex h-full w-full items-center justify-center text-sm font-bold" [ngClass]="getAvatarColorClasses(user?.displayName || user?.email || 'Guest')">
                {{ getUserInitials(user?.displayName || user?.email || 'Guest') }}
              </span>
            </ng-template>
          </button>

          <div
            *ngIf="userMenuOpen"
            class="absolute right-0 top-[calc(100%+0.75rem)] z-[120] w-[320px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
          >
            <div class="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <div class="flex flex-col items-center gap-3 text-center">
                <div class="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full" [ngClass]="getAvatarColorClasses(user?.displayName || user?.email || 'Guest')">
                  <img
                    *ngIf="hasUserAvatar(user); else cardAvatarFallback"
                    [src]="user.photoURL"
                    [alt]="user?.displayName || user?.email || 'Guest'"
                    (error)="onUserAvatarError(user)"
                    class="h-full w-full object-cover"
                  />
                  <ng-template #cardAvatarFallback>
                    <span class="text-2xl font-bold">{{ getUserInitials(user?.displayName || user?.email || 'Guest') }}</span>
                  </ng-template>
                </div>
                <div>
                  <p class="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {{ user?.displayName || user?.email || 'Guest' }}
                  </p>
                  <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {{ user?.email || ('header.offlineMode' | translate) }}
                  </p>
                </div>
              </div>
            </div>

            <div class="space-y-3 px-6 py-5">
              <button
                type="button"
                class="flex w-full items-center justify-center rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                (click)="goToAccount()"
              >
                {{ 'header.manageAccount' | translate }}
              </button>
              <button
                *ngIf="user && hasGuestData"
                type="button"
                class="flex w-full items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-70"
                [disabled]="isSyncingGuestData"
                (click)="syncGuestData()"
              >
                <span class="material-symbols-outlined text-[18px]" [class.animate-spin]="isSyncingGuestData">
                  {{ isSyncingGuestData ? 'progress_activity' : 'sync' }}
                </span>
                {{ isSyncingGuestData ? ('header.syncingGuestData' | translate) : ('header.syncGuestData' | translate) }}
              </button>
              <button
                *ngIf="user"
                type="button"
                class="flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                (click)="signOut()"
              >
                {{ 'header.signOut' | translate }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() createGroupClicked = new EventEmitter<void>();
  @Output() toggleSidebar = new EventEmitter<void>();
  @Input() sidebarCollapsed = false;
  searchValue = '';
  user: any = null;
  userMenuOpen = false;
  hasGuestData = false;
  isSyncingGuestData = false;
  private readonly brokenAvatarSeeds = new Set<string>();
  private userSubscription: Subscription | null = null;

  constructor(
    private readonly currencyService: CurrencyService,
    private readonly translationService: TranslationService,
    private readonly userSessionService: UserSessionService,
    private readonly appRouteService: AppRouteService,
    private readonly avatarColorService: AvatarColorService,
    private readonly guestSyncService: GuestSyncService,
    private readonly activityService: ActivityService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.userSubscription = this.userSessionService.user$.subscribe((user) => {
      Promise.resolve().then(() => {
        this.user = user;
        this.hasGuestData = !!user && this.guestSyncService.hasGuestData();
        this.cdr.detectChanges();
      });
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.userMenuOpen = false;
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.userMenuOpen = !this.userMenuOpen;
  }

  getUserInitials(value: string): string {
    return value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'GU';
  }

  getAvatarColorClasses(seed?: string | null): string {
    return this.avatarColorService.getInitialAvatarClasses(seed ?? 'guest-user');
  }

  hasUserAvatar(user: any): boolean {
    const avatarUrl = user?.photoURL?.trim?.() ?? '';
    if (!avatarUrl) {
      return false;
    }

    return !this.brokenAvatarSeeds.has(this.getAvatarSeed(user));
  }

  onUserAvatarError(user: any): void {
    this.brokenAvatarSeeds.add(this.getAvatarSeed(user));
  }

  async syncGuestData(): Promise<void> {
    if (this.isSyncingGuestData || !this.user) {
      return;
    }

    this.isSyncingGuestData = true;

    try {
      await this.guestSyncService.syncGuestDataToCloud();
      this.hasGuestData = false;
      await this.activityService.logActivity({
        type: 'other',
        title: 'Synced guest data',
        description: 'Migrated guest data from local storage to Firebase'
      });
    } catch (error) {
      console.error('Failed to sync guest data:', error);
    } finally {
      this.isSyncingGuestData = false;
    }
  }

  goToAccount(): void {
    this.userMenuOpen = false;
    this.appRouteService.goToAccount();
  }

  signOut(): void {
    this.userMenuOpen = false;
    void this.userSessionService.signOut().then(() => {
      this.appRouteService.goToJoysTable();
    });
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
  }

  onSearchChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchValue = target.value;
  }

  onCreateGroupClick() {
    this.createGroupClicked.emit();
  }

  setCurrency(currency: AppCurrency): void {
    this.currencyService.setCurrency(currency);
  }

  setLanguage(language: AppLanguage): void {
    this.translationService.setLanguage(language);
  }

  getCurrencyButtonClasses(currency: AppCurrency): string {
    const isActive = this.currencyService.currentCurrency() === currency;
    const baseClasses = 'h-8 min-w-9 rounded-full px-3 text-xs font-bold transition-colors';
    if (isActive) {
      return `${baseClasses} bg-primary text-white`;
    }
    return `${baseClasses} text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700`;
  }

  getLanguageButtonClasses(language: AppLanguage): string {
    const isActive = this.translationService.currentLanguage() === language;
    const baseClasses = 'h-8 min-w-10 rounded-full px-3 text-xs font-bold transition-colors';
    if (isActive) {
      return `${baseClasses} bg-primary text-white`;
    }
    return `${baseClasses} text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700`;
  }

  private getAvatarSeed(user: any): string {
    return String(user?.uid || user?.email || user?.displayName || 'guest-user');
  }
}