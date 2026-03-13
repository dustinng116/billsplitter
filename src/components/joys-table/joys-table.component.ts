import { ChangeDetectorRef, Component, EventEmitter, NgZone, OnDestroy, OnInit, Output, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { type Unsubscribe } from 'firebase/database';
import { Subscription } from 'rxjs';
import {
  CommonCellDefDirective,
  CommonColumnDefDirective,
  CommonHeaderCellDefDirective,
  CommonMobileRowDefDirective,
  CommonNoDataDefDirective,
  CommonTableComponent
} from '../shared-common/common-table/common-table.component';
import { CommonPaginationComponent } from '../shared-common/common-pagination/common-pagination.component';
import { CommonDialogAction, CommonDialogService } from '../../services/common-dialog.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AvatarColorService } from '../../services/avatar-color.service';
import { ImageUploadService } from '../../services/image-upload.service';
import { JoyService } from '../../services/joy.service';
import { ActivityService } from '../../services/activity.service';
import { TranslationService } from '../../services/translation.service';
import { UserSessionService } from '../../services/user-session.service';
import { Joy, JoyCategory } from '../../types/joy.interface';

interface JoyForm {
  name: string;
  category: JoyCategory;
  startDate: string;
  endDate: string;
  coverImage?: string;
}

@Component({
  styleUrl: './joys-table.component.scss',
  selector: 'joys-joys-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CommonTableComponent,
    CommonColumnDefDirective,
    CommonHeaderCellDefDirective,
    CommonCellDefDirective,
    CommonMobileRowDefDirective,
    CommonNoDataDefDirective,
    CommonPaginationComponent,
    TranslatePipe
  ],
  templateUrl: './joys-table.component.html'
})
export class JoysTableComponent implements OnInit, OnDestroy {
  @Output() joyRowClicked = new EventEmitter<Joy>();
  @ViewChild('createJoyDialog', { static: true }) createJoyDialog!: TemplateRef<unknown>;

  joys: Joy[] = [];
  readonly displayedColumns = ['joyName', 'category', 'date', 'createdBy', 'action'] as const;
  readonly categories: JoyCategory[] = [
    'Food', 'Dinner', 'Transport', 'Trip', 'Entertainment',
    'Utilities', 'Accommodation', 'Rent', 'Others', 'General'
  ];
  readonly pageSize = 6;
  currentPage = 1;
  isLoading = false;
  errorMessage = '';
  isSubmitting = false;
  dialogErrorMessage = '';
  joyForm: JoyForm = this.createEmptyForm();
  private unsubscribeJoys: Unsubscribe | null = null;
  private userSubscription: Subscription | null = null;
  private lastSessionKey = '__uninitialized__';
  private loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private activeLoadVersion = 0;
  private readonly minimumLoadingDuration = 500;
  readonly handleRowClick = (joy: Joy): void => {
    this.joyRowClicked.emit(joy);
  };

  getCategoryLabel(category: string): string {
    return this.translationService.tCategory(category);
  }

  getCategoryIcon(category: string): string {
    const normalized = category.trim().toLowerCase();
    const categoryIconMap: Record<string, string> = {
      food: 'lunch_dining',
      dinner: 'restaurant',
      transport: 'commute',
      trip: 'flight',
      entertainment: 'movie',
      utilities: 'bolt',
      accommodation: 'hotel',
      rent: 'home_work',
      others: 'more_horiz',
      general: 'category'
    };

    return categoryIconMap[normalized] ?? 'category';
  }

  getCreateJoyCategoryClasses(category: JoyCategory): string {
    const base = 'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all disabled:opacity-60';

    if (this.joyForm.category === category) {
      return `${base} border-primary bg-primary/5 text-primary`;
    }

    return `${base} border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300`;
  }

  constructor(
    private readonly joyService: JoyService,
    private readonly commonDialogService: CommonDialogService,
    private readonly activityService: ActivityService,
    private readonly avatarColorService: AvatarColorService,
    private readonly translationService: TranslationService,
    private readonly userSessionService: UserSessionService,
    private readonly imageUploadService: ImageUploadService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.userSubscription = this.userSessionService.user$.subscribe((user) => {
      const nextSessionKey = user?.uid ?? 'guest';
      if (this.lastSessionKey === nextSessionKey) {
        return;
      }

      this.lastSessionKey = nextSessionKey;
      this.loadJoys();
    });
  }

  ngOnDestroy(): void {
    this.clearLoadingTimeout();
    this.unsubscribeJoys?.();
    this.unsubscribeJoys = null;
    this.userSubscription?.unsubscribe();
  }

  openCreateJoyDialog(): void {
    this.joyForm = this.createEmptyForm();
    this.dialogErrorMessage = '';
    this.commonDialogService.open({
      title: this.t('joys.createDialogTitle'),
      icon: 'auto_awesome',
      content: this.createJoyDialog,
      bodyClass: 'p-6',
      actions: this.getCreateJoyActions(),
      onClose: () => {
        this.dialogErrorMessage = '';
        this.isSubmitting = false;
        this.joyForm = this.createEmptyForm();
      }
    });
  }

  async createJoy(): Promise<void> {
    if (!this.isFormValid()) return;
    this.isSubmitting = true;
    this.dialogErrorMessage = '';
    try {
      const newJoy = await this.joyService.addJoy({
        joyName: this.joyForm.name.trim(),
        category: this.joyForm.category,
        date: this.formatJoyDateRange(),
        totalAmount: 0,
        yourShare: 0,
        status: 'Pending',
        icon: '',
        iconBg: '',
        iconColor: '',
        coverImage: this.joyForm.coverImage
      });
      await this.activityService.logActivity({
        type: 'create-joy',
        title: 'Created joy',
        description: `Created joy "${newJoy.joyName}"`,
        joyId: newJoy.id,
        metadata: { joyName: newJoy.joyName, category: newJoy.category }
      });
      this.commonDialogService.close();
    } catch (error) {
      console.error('Unable to create joy.', error);
      this.dialogErrorMessage = this.t('joys.createError');
    } finally {
      this.isSubmitting = false;
    }
  }

  get pagedJoys(): Joy[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.joys.slice(start, start + this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
  }

  getCategoryClasses(category: string): string {
    const styles = this.joyService.getCategoryStyles(category as JoyCategory);
    return `inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${styles.bgColor} ${styles.textColor} ${styles.darkBgColor} ${styles.darkTextColor}`;
  }

  getCreatorName(joy: Joy): string {
    return joy.createdBy?.name || joy.createdBy?.email || this.t('common.guest');
  }

  getCreatorInitials(joy: Joy): string {
    return this.getCreatorName(joy)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'GU';
  }

  getCreatorAvatarClasses(joy: Joy): string {
    const colorSeed = joy.createdBy?.uid || joy.createdBy?.email || this.getCreatorName(joy) || joy.id;
    return this.avatarColorService.getInitialAvatarClasses(colorSeed);
  }

  private loadJoys(): void {
    const loadVersion = ++this.activeLoadVersion;
    const loadStartedAt = Date.now();
    this.isLoading = true;
    this.errorMessage = '';
    this.clearLoadingTimeout();
    this.unsubscribeJoys?.();

    this.loadingTimeoutId = setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        this.errorMessage = this.t('joys.timeoutError');
        this.cdr.detectChanges();
      }
    }, 3000);

    this.unsubscribeJoys = this.joyService.listenToJoys(
      (joys) => {
        this.ngZone.run(() => {
          this.completeLoad(loadVersion, loadStartedAt, () => {
            this.joys = joys;
            this.ensureValidPage();
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        });
      },
      (error) => {
        this.ngZone.run(() => {
          this.completeLoad(loadVersion, loadStartedAt, () => {
            console.error('Unable to load joys.', error);
            this.errorMessage = this.t('joys.loadError');
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        });
      }
    );
  }

  private clearLoadingTimeout(): void {
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId);
      this.loadingTimeoutId = null;
    }
  }

  private completeLoad(loadVersion: number, loadStartedAt: number, apply: () => void): void {
    if (loadVersion !== this.activeLoadVersion) {
      return;
    }

    this.clearLoadingTimeout();
    const remainingDelay = Math.max(0, this.minimumLoadingDuration - (Date.now() - loadStartedAt));
    setTimeout(() => {
      if (loadVersion !== this.activeLoadVersion) {
        return;
      }

      apply();
    }, remainingDelay);
  }

  private getCreateJoyActions(): CommonDialogAction[] {
    return [
      {
        label: this.t('joys.cancel'),
        kind: 'secondary',
        disabled: () => this.isSubmitting,
        handler: () => this.commonDialogService.close()
      },
      {
        label: () => (this.isSubmitting ? this.t('joys.creating') : this.t('joys.createAction')),
        icon: () => (this.isSubmitting ? 'progress_activity' : 'auto_awesome'),
        kind: 'primary',
        grow: true,
        disabled: () => this.isSubmitting || !this.isFormValid(),
        handler: () => { void this.createJoy(); }
      }
    ];
  }

  private isFormValid(): boolean {
    return !!(
      this.joyForm.name.trim() &&
      this.joyForm.category &&
      this.joyForm.startDate &&
      this.joyForm.endDate &&
      this.joyForm.startDate <= this.joyForm.endDate
    );
  }

  t(key: string): string {
    return this.translationService.t(key);
  }

  private createEmptyForm(): JoyForm {
    const today = new Date().toISOString().split('T')[0];
    return { name: '', category: 'Others', startDate: today, endDate: today, coverImage: '' };
  }

  isUploadingCover = false;

  async onCoverSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    try {
      this.isUploadingCover = true;
      this.cdr.detectChanges(); // spinner shows immediately
      
      const compressedFile = await this.imageUploadService.compressImage(file, 1600, 1600, 0.85); // main cover 
      const imageUrl = await this.imageUploadService.uploadImage(compressedFile);
      
      this.joyForm.coverImage = imageUrl;
    } catch (error) {
      console.error('Upload failed', error);
      alert(this.t('common.uploadError'));
    } finally {
      this.isUploadingCover = false;
      input.value = ''; // Reset input
      this.cdr.detectChanges();
    }
  }

  private formatJoyDateRange(): string {
    if (this.joyForm.startDate === this.joyForm.endDate) {
      return this.joyForm.startDate;
    }

    return `${this.joyForm.startDate} → ${this.joyForm.endDate}`;
  }

  private ensureValidPage(): void {
    const totalPages = Math.max(1, Math.ceil(this.joys.length / this.pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;
  }
  getAvatarColorClasses(name: string): string {
    return this.avatarColorService.getInitialAvatarClasses(name || this.t('joys.newJoy'));
  }

  getInitials(name: string): string {
    return name?.trim() ? name.trim().charAt(0).toUpperCase() : '?';
  }
}
