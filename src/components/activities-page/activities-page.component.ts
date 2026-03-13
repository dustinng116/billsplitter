import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { type Unsubscribe } from 'firebase/database';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ActivityService } from '../../services/activity.service';
import { TranslationService } from '../../services/translation.service';
import { ActivityLog, ActivityType } from '../../types/activity.interface';

@Component({
  styleUrl: './activities-page.component.scss',
  selector: 'joys-activities-page',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './activities-page.component.html'
})
export class ActivitiesPageComponent implements OnInit, OnDestroy {
  activities: ActivityLog[] = [];
  isLoading = false;
  errorMessage = '';
  private unsubscribeActivities: Unsubscribe | null = null;
  private loadVersion = 0;
  private readonly minimumLoadingDuration = 500;

  constructor(
    private readonly activityService: ActivityService,
    private readonly translationService: TranslationService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  getLocalizedActivityTitle(activity: ActivityLog): string {
    const typeKey = `activities.type.${activity.type}`;
    const metadata = activity.metadata ?? {};

    // prepare params for translation
    const params: Record<string, string | number | boolean> = {};
    if (metadata['joyName']) params['joyName'] = String(metadata['joyName']);
    if (metadata['groupName']) params['groupName'] = String(metadata['groupName']);
    if (metadata['expenseTitle']) params['expenseTitle'] = String(metadata['expenseTitle']);
    if (metadata['friendName']) params['friendName'] = String(metadata['friendName']);
    if (metadata['language']) params['language'] = String(metadata['language']);
    if (metadata['currency']) params['currency'] = String(metadata['currency']);
    if (metadata['theme']) params['theme'] = String(metadata['theme']);

    const translated = this.translationService.t(typeKey, params as any);
    // if translation returns the key back, fall back to stored title
    if (!translated || translated === typeKey) {
      return activity.title;
    }

    return translated;
  }

  getLocalizedActivityDescription(activity: ActivityLog): string {
    // Prefer stored description; could localize further if needed
    return activity.description || '';
  }

  ngOnInit(): void {
    this.loadActivities();
  }

  ngOnDestroy(): void {
    this.unsubscribeActivities?.();
    this.unsubscribeActivities = null;
  }

  formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return this.translationService.t('groupDetail.unknown');
    }
    return date.toLocaleString();
  }

  getActivityIcon(type: ActivityType): string {
    const iconMap: Record<ActivityType, string> = {
      navigation: 'route',
      'create-joy': 'auto_awesome',
      'create-group': 'group_add',
      'update-group': 'settings',
      'add-expense': 'receipt_long',
      'add-friend': 'person_add',
      'update-friend': 'edit',
      'delete-friend': 'delete',
      'change-language': 'language',
      'change-currency': 'payments',
      'change-theme': 'contrast',
      logout: 'logout',
      other: 'timeline'
    };

    return iconMap[type] ?? 'timeline';
  }

  private loadActivities(): void {
    const currentLoad = ++this.loadVersion;
    const loadStartedAt = Date.now();
    this.isLoading = true;
    this.errorMessage = '';
    this.unsubscribeActivities?.();

    this.unsubscribeActivities = this.activityService.listenToActivities(
      (activities) => {
        this.ngZone.run(() => {
          if (currentLoad !== this.loadVersion) return;

          const remaining = Math.max(0, this.minimumLoadingDuration - (Date.now() - loadStartedAt));
          setTimeout(() => {
            if (currentLoad !== this.loadVersion) return;
            this.activities = activities;
            this.isLoading = false;
            this.cdr.detectChanges();
          }, remaining);
        });
      },
      (error) => {
        this.ngZone.run(() => {
          if (currentLoad !== this.loadVersion) return;
          console.error('Unable to load activities.', error);
          this.errorMessage = 'Unable to load activities right now. Please refresh and try again.';
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      }
    );
  }
}
