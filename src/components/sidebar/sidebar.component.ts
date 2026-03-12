import { Component, Output, EventEmitter, OnChanges, SimpleChanges, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ThemeMode, ThemeService } from '../../services/theme.service';
import { TranslationService } from '../../services/translation.service';

interface SidebarItem {
  icon: string;
  labelKey: string;
  active?: boolean;
  isLogout?: boolean;
  isThemeMenu?: boolean;
  href: string;
}

@Component({
  selector: 'joys-sidebar',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  // outputs property removed, use @Output decorator
  template: `
    <!-- mobile menu is provided by header; no floating button needed -->

    <!-- overlay panel for mobile/tablet (<lg) -->
        <div class="fixed inset-0 z-[9998] lg:hidden" [ngClass]="overlayOpen ? 'pointer-events-auto' : 'pointer-events-none'">
       <div (click)="closeOverlay()" class="absolute inset-0 bg-black/40 transition-opacity duration-300"
         [ngClass]="overlayOpen ? 'opacity-100' : 'opacity-0'"></div>
       <aside class="fixed left-0 top-0 bottom-0 w-72 z-[9999] bg-white dark:bg-slate-900 p-4 overflow-y-auto transform transition-transform duration-300 lg:hidden"
           [ngClass]="overlayOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'">
        <ng-container *ngTemplateOutlet="sidebarContent"></ng-container>
      </aside>
    </div>

    <!-- main sidebar (inline for lg and up) -->
    <aside 
      [class]="'relative hidden lg:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shrink-0 overflow-y-auto transition-all duration-300 ' + (collapsed ? 'w-[72px]' : 'w-72') + ' h-[100vh]'"
      *ngIf="true"
    >
      <ng-container *ngTemplateOutlet="sidebarContent"></ng-container>
    </aside>

    <ng-template #sidebarContent>
      <button *ngIf="overlayOpen || !collapsed"
        class="absolute top-3 right-3 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        (click)="onToggleCollapse($event)"
        [attr.aria-label]="'sidebar.closeSidebar' | translate"
        [title]="'sidebar.closeSidebar' | translate"
      >
        <span class="material-symbols-outlined">close</span>
      </button>
      <div class="flex flex-col h-full">
        <div class="mb-6 flex items-center" [ngClass]="(collapsed && !overlayOpen) ? 'justify-center gap-0' : 'justify-start gap-3'">
          <div 
            class="flex-none h-10 w-10 items-center justify-center rounded-lg cursor-pointer transition p-2"
            (click)="onToggleCollapse($event)"
            [ngClass]="{
              'bg-primary text-white': !collapsed,
              'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800': collapsed
            }"
            [title]="'sidebar.toggleSidebar' | translate"
          >
            <span class="material-symbols-outlined">{{ (collapsed && !overlayOpen) ? 'menu' : 'payments' }}</span>
          </div>
          <div class="overflow-hidden transition-all duration-300 ease-in-out"
            [ngClass]="(overlayOpen ? false : collapsed) ? 'max-w-0 opacity-0' : 'max-w-[200px] opacity-100'">
            <span class="text-xl font-bold leading-tight tracking-tight inline-block whitespace-nowrap">Joys Splitter</span>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <a
            *ngFor="let item of navigationItems"
            (click)="onNavigationClick(item, $event)"
            [class]="getSidebarItemClasses(item)"
            class="sidebar-link flex items-center py-2.5 rounded-lg transition-colors cursor-pointer"
            [ngClass]="(overlayOpen || !collapsed) ? 'justify-start px-3' : 'justify-center px-0'"
          >
              <div class="flex items-center justify-center h-10 w-10 rounded-lg"
                [ngClass]="(item.active ? 'text-primary' : 'text-slate-600 dark:text-slate-400') + (( !collapsed || overlayOpen ) ? ' mr-3' : '')"
                [ngStyle]="getIconStyle(item)">
              <span class="material-symbols-outlined">{{ item.icon }}</span>
            </div>
              <div class="overflow-hidden transition-all duration-300 ease-in-out"
                [ngClass]="(overlayOpen ? false : collapsed) ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100'">
                <span [class]="item.active ? 'text-sm font-semibold' : 'text-sm font-medium'" class="inline-block whitespace-nowrap">{{ item.labelKey | translate }}</span>
            </div>
          </a>
        </div>
        <div class="my-4 border-t border-slate-100 dark:border-slate-800"></div>
        <div class="mt-auto flex flex-col gap-1.5">
          <a
            *ngFor="let item of bottomItems"
            (click)="onNavigationClick(item, $event)"
            [class]="getSidebarItemClasses(item)"
            class="sidebar-link flex items-center py-2.5 rounded-lg transition-colors cursor-pointer"
            [ngClass]="(overlayOpen || !collapsed) ? 'justify-start px-3' : 'justify-center px-0'"
          >
              <div class="flex items-center justify-center h-10 w-10 rounded-lg"
                [ngClass]="(item.active ? 'text-primary' : 'text-slate-600 dark:text-slate-400') + (( !collapsed || overlayOpen ) ? ' mr-3' : '')"
                [ngStyle]="getIconStyle(item)">
              <span class="material-symbols-outlined">{{ item.icon }}</span>
            </div>
            <div class="overflow-hidden transition-all duration-300 ease-in-out"
                 [ngClass]="(overlayOpen ? false : collapsed) ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100'">
              <span class="text-sm font-medium inline-block whitespace-nowrap">{{ item.labelKey | translate }}</span>
            </div>
          </a>

          <div
            *ngIf="themeMenuOpen && (overlayOpen || !collapsed)"
            class="ml-2 mr-1 mt-1 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/70"
          >
            <div class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {{ 'sidebar.theme.current' | translate : { mode: getCurrentThemeLabel() } }}
            </div>
            <div class="grid grid-cols-3 gap-1">
              <button
                type="button"
                (click)="setTheme('light', $event)"
                [class]="getThemeButtonClasses('light')"
              >
                <span class="material-symbols-outlined text-base">light_mode</span>
                <span class="text-[11px] font-semibold">{{ 'sidebar.theme.light' | translate }}</span>
              </button>
              <button
                type="button"
                (click)="setTheme('dark', $event)"
                [class]="getThemeButtonClasses('dark')"
              >
                <span class="material-symbols-outlined text-base">dark_mode</span>
                <span class="text-[11px] font-semibold">{{ 'sidebar.theme.dark' | translate }}</span>
              </button>
              <button
                type="button"
                (click)="setTheme('system', $event)"
                [class]="getThemeButtonClasses('system')"
              >
                <span class="material-symbols-outlined text-base">desktop_windows</span>
                <span class="text-[11px] font-semibold">{{ 'sidebar.theme.system' | translate }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ng-template>
  `
})
export class SidebarComponent implements OnChanges, OnInit {
  @Output() navigationClicked = new EventEmitter<string>();
  @Input() collapsed = false;
  @Input() externalOverlay = false;
  @Output() externalOverlayChange = new EventEmitter<boolean>();
  @Output() collapseToggle = new EventEmitter<boolean>();
  // Overlay state for mobile/tablet when sidebar should overlay content
  overlayOpen = false;
  themeMenuOpen = false;
  navigationItems: SidebarItem[] = [
    { icon: 'auto_awesome', labelKey: 'sidebar.joys', active: true, href: 'joys-table' },
    { icon: 'person', labelKey: 'sidebar.friends', href: 'friends' },
    { icon: 'timeline', labelKey: 'sidebar.activities', href: 'activities' }
  ];
  bottomItems: SidebarItem[] = [
    { icon: 'settings', labelKey: 'sidebar.settings', href: 'settings' },
    { icon: 'contrast', labelKey: 'sidebar.theme', isThemeMenu: true, href: 'theme-menu' },
    { icon: 'logout', labelKey: 'sidebar.logout', isLogout: true, href: 'logout' }
  ];

  constructor(
    private readonly themeService: ThemeService,
    private readonly translationService: TranslationService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['collapsed']) {
      this.collapsed = changes['collapsed'].currentValue;
    }
    if (changes['externalOverlay']) {
      this.overlayOpen = changes['externalOverlay'].currentValue;
    }
  }

  ngOnInit(): void {
    // default to collapsed on tablet and smaller to match requested behaviour
    const win = (globalThis as any).window;
    if (win && win.innerWidth < 1024) {
      this.collapsed = true;
    }
  }

  onToggleCollapse(event: Event) {
    event.stopPropagation();
    // If on small screens we want overlay behaviour, toggle overlay instead
    const win = (globalThis as any).window;
    const isSmall = !!win && win.innerWidth < 1024;
    if (isSmall) {
      this.overlayOpen = !this.overlayOpen;
      this.externalOverlayChange.emit(this.overlayOpen);
    } else {
      this.collapsed = !this.collapsed;
      this.collapseToggle.emit(this.collapsed);
    }
  }

  getIconStyle(item: SidebarItem) {
    if (item.active) {
      return { 'background-color': 'rgba(19,91,236,0.15)' };
    }
    if (this.collapsed) {
      return { 'background-color': 'transparent' };
    }
    return { 'background-color': 'transparent' };
  }

  onNavigationClick(item: SidebarItem, event: Event) {
    event.preventDefault();

    if (item.isThemeMenu) {
      this.themeMenuOpen = !this.themeMenuOpen;
      return;
    }

    // Update active state
    this.navigationItems.forEach(navItem => navItem.active = false);
    this.bottomItems.forEach(bottomItem => {
      if (!bottomItem.isThemeMenu) {
        bottomItem.active = false;
      }
    });
    item.active = true;
    this.themeMenuOpen = false;
    this.navigationClicked.emit(item.href);
  }

  getSidebarItemClasses(item: SidebarItem): string {
    if (this.collapsed && !this.overlayOpen) {
      return this.getCollapsedItemClasses(item);
    }
    return this.getExpandedItemClasses(item);
  }

  openOverlay() {
    this.overlayOpen = true;
    this.externalOverlayChange.emit(this.overlayOpen);
  }

  closeOverlay() {
    this.overlayOpen = false;
    this.externalOverlayChange.emit(this.overlayOpen);
  }

  setTheme(mode: ThemeMode, event: Event): void {
    event.stopPropagation();
    this.themeService.setMode(mode);
  }

  getThemeButtonClasses(mode: ThemeMode): string {
    const isActive = this.themeService.currentMode() === mode;
    const base = 'flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 transition-colors';
    if (isActive) {
      return `${base} bg-primary text-white`;
    }
    return `${base} bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700`;
  }

  getCurrentThemeLabel(): string {
    const mode = this.themeService.currentMode();
    if (mode === 'light') return this.translationService.t('sidebar.theme.light');
    if (mode === 'dark') return this.translationService.t('sidebar.theme.dark');
    return this.translationService.t('sidebar.theme.system');
  }

  private getCollapsedItemClasses(item: SidebarItem): string {
    if (item.isThemeMenu) {
      return this.themeMenuOpen ? 'text-primary' : 'text-slate-600 dark:text-slate-400';
    }
    if (item.active) {
      return 'text-primary';
    }
    if (item.isLogout) {
      return 'text-red-500';
    }
    return 'text-slate-600 dark:text-slate-400';
  }

  private getExpandedItemClasses(item: SidebarItem): string {
    if (item.isThemeMenu) {
      return this.themeMenuOpen
        ? 'bg-primary/10 text-primary'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800';
    }
    if (item.active) {
      return 'bg-primary/10 text-primary';
    }
    if (item.isLogout) {
      return 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10';
    }
    return 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800';
  }
}