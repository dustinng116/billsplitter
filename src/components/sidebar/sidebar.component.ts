import { Component, Output, EventEmitter, OnChanges, SimpleChanges, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ThemeMode, ThemeService } from '../../services/theme.service';
import { TranslationService } from '../../services/translation.service';

interface SidebarItem {
  icon?: string;
  labelKey: string;
  active?: boolean;
  isLogout?: boolean;
  isThemeMenu?: boolean;
  href: string;
}

@Component({
  styleUrl: './sidebar.component.scss',
  selector: 'joys-sidebar',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  // outputs property removed, use @Output decorator
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent implements OnChanges, OnInit {
  @Output() navigationClicked = new EventEmitter<string>();
  @Input() collapsed = false;
  @Input() externalOverlay = false;
  @Input() activeView = 'joys-table';
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
    { icon: 'contrast', labelKey: 'sidebar.theme', isThemeMenu: true, href: 'theme-menu' }
  ];

  constructor(
    private readonly themeService: ThemeService,
    private readonly translationService: TranslationService
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['collapsed']) {
      this.collapsed = changes['collapsed'].currentValue;
    }
    if (changes['externalOverlay']) {
      this.overlayOpen = changes['externalOverlay'].currentValue;
    }
    if (changes['activeView']) {
      this.syncActiveItems();
    }
  }

  ngOnInit(): void {
    // default to collapsed on tablet and smaller to match requested behaviour
    const win = (globalThis as any).window;
    if (win && win.innerWidth < 1024) {
      this.collapsed = true;
    }

    this.syncActiveItems();
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

  private syncActiveItems(): void {
    const normalizedView = this.activeView === 'dashboard' || this.activeView === 'group-detail'
      ? 'joys-table'
      : this.activeView;

    this.navigationItems.forEach((item) => {
      item.active = item.href === normalizedView;
    });

    this.bottomItems.forEach((item) => {
      if (!item.isThemeMenu && !item.isLogout) {
        item.active = item.href === normalizedView;
      }
    });
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
    this.themeMenuOpen = false;
  }

  getThemeButtonClasses(mode: ThemeMode): string {
    const isActive = this.themeService.currentMode() === mode;
    const base = 'flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 transition-colors';
    if (isActive) {
      return `${base} bg-primary text-white`;
    }
    return `${base} bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700`;
  }

  getCollapsedThemeButtonClasses(mode: ThemeMode): string {
    const isActive = this.themeService.currentMode() === mode;
    const base = 'inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors';
    if (isActive) {
      return `${base} border-primary bg-primary/10 text-primary`;
    }

    return `${base} border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300`;
  }

  getThemeMenuContainerClasses(): string {
    const base = 'rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/70';

    if (this.overlayOpen || !this.collapsed) {
      return `ml-2 mr-1 mt-1 ${base}`;
    }

    return `absolute bottom-[calc(100%+0.5rem)] left-1/2 z-20 w-[210px] -translate-x-1/2 shadow-xl shadow-slate-900/10 ${base}`;
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