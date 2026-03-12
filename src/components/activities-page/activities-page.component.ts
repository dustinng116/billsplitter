import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { type Unsubscribe } from 'firebase/database';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ActivityService } from '../../services/activity.service';
import { TranslationService } from '../../services/translation.service';
import { ActivityLog, ActivityType } from '../../types/activity.interface';

@Component({
  selector: 'joys-activities-page',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="p-4 lg:p-8 w-full">
      <div class="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">{{ 'activities.title' | translate }}</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ 'activities.subtitle' | translate }}</p>
        </div>

        <div *ngIf="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {{ errorMessage }}
        </div>

        <div *ngIf="isLoading" class="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">
          <span class="material-symbols-outlined animate-spin text-base">progress_activity</span>
          {{ 'activities.loading' | translate }}
        </div>

        <div *ngIf="!isLoading && activities.length" class="space-y-3">
          <article
            *ngFor="let activity of activities"
            class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div class="flex items-start gap-3">
              <div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span class="material-symbols-outlined text-[18px]">{{ getActivityIcon(activity.type) }}</span>
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">{{ activity.title }}</h3>
                  <time class="text-xs text-slate-400">{{ formatDateTime(activity.createdAt) }}</time>
                </div>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">{{ activity.description }}</p>
              </div>
            </div>
          </article>
        </div>

        <div *ngIf="!isLoading && !activities.length" class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <span class="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">timeline</span>
          <h3 class="mt-3 text-xl font-bold">{{ 'activities.emptyTitle' | translate }}</h3>
          <p class="mt-1 text-slate-500 dark:text-slate-400">{{ 'activities.emptyDesc' | translate }}</p>
        </div>
      </div>
    </div>
  `
})
export class ActivitiesPageComponent implements OnInit, OnDestroy {
  activities: ActivityLog[] = [];
  isLoading = false;
  errorMessage = '';
  private unsubscribeActivities: Unsubscribe | null = null;

  constructor(
    private readonly activityService: ActivityService,
    private readonly translationService: TranslationService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

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
    this.isLoading = true;
    this.errorMessage = '';
    this.unsubscribeActivities?.();

    this.unsubscribeActivities = this.activityService.listenToActivities(
      (activities) => {
        this.ngZone.run(() => {
          this.activities = activities;
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      (error) => {
        this.ngZone.run(() => {
          console.error('Unable to load activities.', error);
          this.errorMessage = 'Unable to load activities right now. Please refresh and try again.';
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      }
    );
  }
}
