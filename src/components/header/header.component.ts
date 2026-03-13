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
  styleUrl: './header.component.scss',
  selector: 'joys-header',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  // outputs property removed, use @Output decorator
  templateUrl: './header.component.html'
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