import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { type Unsubscribe } from 'firebase/database';
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
import { FriendService } from '../../services/friend.service';
import { ActivityService } from '../../services/activity.service';
import { AvatarColorService } from '../../services/avatar-color.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { Friend, FriendForm } from '../../types/friend.interface';

const MOBILE_SWIPE_ACTION_WIDTH = 88;

@Component({
  selector: 'joys-friends-page',
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
  template: `
    <div class="p-4 lg:p-8 w-full">
      <div class="flex flex-col gap-8 w-full">

        <!-- Mobile header: action row + title below (matches dashboard / group-detail) -->
        <header class="md:hidden pb-0">
          <div class="flex items-center justify-end mb-2"> 
          </div>
          <h1 class="text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">{{ 'friends.title' | translate }}</h1>
          <p class="mt-1 max-w-lg text-base leading-relaxed text-slate-500 dark:text-slate-400">{{ 'friends.subtitle' | translate }}</p>
        </header>

        <!-- Desktop header: title left, full button right -->
        <div class="hidden md:flex flex-row items-end justify-between gap-4">
          <div class="flex flex-col gap-2">
            <h1 class="text-3xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">{{ 'friends.title' | translate }}</h1>
            <p class="max-w-lg text-base leading-relaxed text-slate-500 dark:text-slate-400">{{ 'friends.subtitle' | translate }}</p>
          </div>
          <button
            type="button"
            (click)="openAddFriendDialog()"
            [disabled]="isLoading"
            class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
          >
            <span class="material-symbols-outlined text-[18px]">person_add</span>
            <span>{{ 'friends.add' | translate }}</span>
          </button>
        </div>

        <div *ngIf="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {{ errorMessage }}
        </div>

        <div *ngIf="isLoading" class="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">
          <span class="material-symbols-outlined animate-spin text-base">progress_activity</span>
          {{ 'friends.loading' | translate }}
        </div>

        <joys-common-table
          [data]="pagedFriends"
          [displayedColumns]="displayedColumns"
          [rowClass]="'transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50'"
          [emptyText]="t('friends.empty')"
        >
          <ng-container appColumnDef="name">
            <ng-template appHeaderCellDef>{{ 'friends.name' | translate }}</ng-template>
            <ng-template appCellDef let-friend>
              <div *ngIf="editingFriendId !== friend.id" class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold" [ngClass]="getAvatarColorClasses(friend.name)">
                  {{ getInitials(friend.name) }}
                </div>
                <span class="font-semibold text-slate-900 dark:text-slate-100">{{ friend.name }}</span>
              </div>
              <input *ngIf="editingFriendId === friend.id"
                [(ngModel)]="editForm.name"
                type="text"
                placeholder="Full name"
                class="w-full min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </ng-template>
          </ng-container>

          <ng-container appColumnDef="email" cellClass="text-sm text-slate-600 dark:text-slate-300">
            <ng-template appHeaderCellDef>{{ 'friends.email' | translate }}</ng-template>
            <ng-template appCellDef let-friend>
              <span *ngIf="editingFriendId !== friend.id">{{ friend.email }}</span>
              <input *ngIf="editingFriendId === friend.id"
                [(ngModel)]="editForm.email"
                type="email"
                placeholder="name@email.com"
                class="w-full min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </ng-template>
          </ng-container>

          <ng-container appColumnDef="phone" cellClass="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <ng-template appHeaderCellDef>{{ 'friends.phone' | translate }}</ng-template>
            <ng-template appCellDef let-friend>
              <span *ngIf="editingFriendId !== friend.id">{{ friend.phone }}</span>
              <input *ngIf="editingFriendId === friend.id"
                [(ngModel)]="editForm.phone"
                (ngModelChange)="onEditPhoneInput($event)"
                type="tel"
                inputmode="numeric"
                pattern="[0-9]*"
                placeholder="0123456789"
                class="w-full min-w-[130px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </ng-template>
          </ng-container>

          <ng-container appColumnDef="action" headerClass="w-28 text-right" cellClass="text-right">
            <ng-template appHeaderCellDef></ng-template>
            <ng-template appCellDef let-friend>
              <div *ngIf="editingFriendId !== friend.id" class="flex items-center justify-end gap-1">
                <button
                  type="button"
                  (click)="startEdit(friend)"
                  class="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20"
                  [attr.aria-label]="'Edit ' + friend.name"
                  [title]="'friends.editFriend' | translate"
                >
                  <span class="material-symbols-outlined text-lg">edit</span>
                </button>
                <button
                  type="button"
                  (click)="openDeleteFriendDialog(friend)"
                  class="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  [attr.aria-label]="'Delete ' + friend.name"
                  [title]="'friends.deleteFriend' | translate"
                >
                  <span class="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
              <div *ngIf="editingFriendId === friend.id" class="flex items-center justify-end gap-1">
                <button
                  type="button"
                  (click)="saveEdit(friend)"
                  [disabled]="isSaving"
                  class="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                  [title]="'friends.saveChanges' | translate"
                >
                  <span class="material-symbols-outlined text-lg" [class.animate-spin]="isSaving">{{ isSaving ? 'progress_activity' : 'check' }}</span>
                </button>
                <button
                  type="button"
                  (click)="cancelEdit()"
                  [disabled]="isSaving"
                  class="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-700"
                  [title]="'friends.cancel' | translate"
                >
                  <span class="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </ng-template>
          </ng-container>

          <ng-template appMobileRowDef let-friend>
            <div class="relative overflow-hidden rounded-lg border bg-white shadow-sm transition-all dark:bg-slate-900"
              [class]="editingFriendId === friend.id ? 'border-primary ring-2 ring-primary/20 dark:border-primary' : 'border-slate-100 dark:border-slate-800'">
              <button
                *ngIf="editingFriendId !== friend.id"
                type="button"
                (click)="openDeleteFriendDialog(friend)"
                class="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-red-500 text-white transition-all duration-200 hover:bg-red-600"
                [style.opacity]="getSwipeDeleteOpacity(friend.id)"
                [style.transform]="getSwipeDeleteTransform(friend.id)"
                [class.pointer-events-none]="!isSwipeDeleteActionEnabled(friend.id)"
                [attr.aria-label]="'Delete ' + friend.name"
              >
                <span class="material-symbols-outlined text-base">delete</span>
              </button>

              <div
                class="relative z-10 p-3 transition-transform duration-200 ease-out"
                [style.transform]="getSwipeTransform(friend.id)"
                (click)="onMobileFriendCardClick(friend)"
                (touchstart)="onFriendTouchStart(friend.id, $event)"
                (touchmove)="onFriendTouchMove(friend.id, $event)"
                (touchend)="onFriendTouchEnd(friend.id)"
                (touchcancel)="onFriendTouchCancel()"
              >
              <ng-container *ngIf="editingFriendId !== friend.id">
                <div class="flex items-start justify-between gap-2.5">
                  <div class="flex min-w-0 items-start gap-2.5">
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" [ngClass]="getAvatarColorClasses(friend.name)">
                      {{ getInitials(friend.name) }}
                    </div>
                    <div class="min-w-0 space-y-0.5">
                      <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{{ friend.name }}</div>
                      <div class="truncate text-xs text-slate-600 dark:text-slate-300">{{ friend.email }}</div>
                      <div class="truncate text-xs text-slate-500 dark:text-slate-400">{{ friend.phone }}</div>
                    </div>
                  </div>
                  <div class="flex shrink-0 items-center gap-0.5">
                    <button type="button" (click)="startEdit(friend); $event.stopPropagation()"
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20">
                      <span class="material-symbols-outlined text-base">edit</span>
                    </button>
                  </div>
                </div>
              </ng-container>
              <ng-container *ngIf="editingFriendId === friend.id">
                <div class="space-y-2">
                  <input [(ngModel)]="editForm.name" type="text" placeholder="Full name"
                    class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
                  <input [(ngModel)]="editForm.email" type="email" placeholder="name@email.com"
                    class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
                  <input [(ngModel)]="editForm.phone" (ngModelChange)="onEditPhoneInput($event)" type="tel" inputmode="numeric" pattern="[0-9]*" placeholder="0123456789"
                    class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
                  <div class="flex justify-end gap-1.5 pt-1">
                    <button type="button" (click)="cancelEdit(); $event.stopPropagation()" [disabled]="isSaving"
                      class="flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">
                      <span class="material-symbols-outlined text-sm">close</span> {{ 'friends.cancel' | translate }}
                    </button>
                    <button type="button" (click)="saveEdit(friend, $event)" [disabled]="isSaving"
                      class="flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50">
                      <span class="material-symbols-outlined text-sm" [class.animate-spin]="isSaving">{{ isSaving ? 'progress_activity' : 'check' }}</span>
                      {{ isSaving ? ('friends.saving' | translate) : ('friends.save' | translate) }}
                    </button>
                  </div>
                </div>
              </ng-container>
              </div>
            </div>
          </ng-template>

          <ng-template appNoDataDef>
            <div class="flex flex-col items-center gap-2">
              <span class="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">group_off</span>
              <p class="font-medium text-slate-500 dark:text-slate-400">{{ 'friends.noData' | translate }}</p>
            </div>
          </ng-template>

          <div pagination>
            <joys-common-pagination
              [page]="currentPage"
              [pageSize]="pageSize"
              [totalItems]="friends.length"
              itemLabel="friends"
              (pageChange)="onPageChange($event)"
            ></joys-common-pagination>
          </div>
        </joys-common-table>
      </div>

    </div>

    <ng-template #addFriendDialog>
      <div class="space-y-6">
        <div class="grid gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'friends.name' | translate }}</label>
            <input
              [(ngModel)]="friendForm.name"
              [disabled]="isSubmitting"
              type="text"
              placeholder="e.g., Sarah Miller"
              class="w-full rounded-xl border-transparent bg-slate-50 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'friends.email' | translate }}</label>
            <input
              [(ngModel)]="friendForm.email"
              [disabled]="isSubmitting"
              type="email"
              placeholder="name@email.com"
              class="w-full rounded-xl border-transparent bg-slate-50 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'friends.phone' | translate }}</label>
            <input
              [(ngModel)]="friendForm.phone"
              (ngModelChange)="onFriendPhoneInput($event)"
              [disabled]="isSubmitting"
              type="tel"
              inputmode="numeric"
              pattern="[0-9]*"
              placeholder="0123456789"
              class="w-full rounded-xl border-transparent bg-slate-50 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800"
            />
          </div>
        </div>

        <p *ngIf="dialogErrorMessage" class="text-sm text-red-600 dark:text-red-300">{{ dialogErrorMessage }}</p>
      </div>
    </ng-template>

    <ng-template #deleteFriendDialog>
      <div class="space-y-4">
        <p class="text-base text-slate-600 dark:text-slate-300">
          {{ 'friends.removePromptPrefix' | translate }} <span class="font-semibold text-slate-900 dark:text-slate-100">{{ pendingDeleteFriend?.name }}</span> {{ 'friends.removePromptSuffix' | translate }}
        </p>
        <div *ngIf="pendingDeleteFriend" class="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
          <div class="font-semibold text-slate-900 dark:text-slate-100">{{ pendingDeleteFriend.name }}</div>
          <div class="text-slate-600 dark:text-slate-300">{{ pendingDeleteFriend.email }}</div>
          <div class="text-slate-500 dark:text-slate-400">{{ pendingDeleteFriend.phone }}</div>
        </div>
        <p *ngIf="dialogErrorMessage" class="text-sm text-red-600 dark:text-red-300">{{ dialogErrorMessage }}</p>
      </div>
    </ng-template>
  `
})
export class FriendsPageComponent implements OnInit, OnDestroy {
  @ViewChild('addFriendDialog', { static: true }) addFriendDialog!: TemplateRef<unknown>;
  @ViewChild('deleteFriendDialog', { static: true }) deleteFriendDialog!: TemplateRef<unknown>;

  readonly displayedColumns = ['name', 'email', 'phone', 'action'] as const;
  readonly pageSize = 10;
  currentPage = 1;
  isLoading = false;
  isSubmitting = false;
  isDeleting = false;
  errorMessage = '';
  dialogErrorMessage = '';
  private unsubscribeFriends: Unsubscribe | null = null;

  friends: Friend[] = [];

  friendForm: FriendForm = this.createEmptyFriendForm();
  pendingDeleteFriend: Friend | null = null;
  editingFriendId: string | null = null;
  editForm: FriendForm = this.createEmptyFriendForm();
  isSaving = false;
  private openedSwipeFriendId = '';
  private draggingFriendId = '';
  private touchStartX = 0;
  private currentSwipeOffset = 0;

  constructor(
    private readonly commonDialogService: CommonDialogService,
    private readonly friendService: FriendService,
    private readonly activityService: ActivityService,
    private readonly avatarColorService: AvatarColorService,
    private readonly translationService: TranslationService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadFriends();
  }

  ngOnDestroy(): void {
    this.unsubscribeFriends?.();
    this.unsubscribeFriends = null;
  }

  openAddFriendDialog() {
    this.friendForm = this.createEmptyFriendForm();
    this.dialogErrorMessage = '';
    this.commonDialogService.open({
      title: this.t('friends.addDialogTitle'),
      icon: 'person_add',
      content: this.addFriendDialog,
      bodyClass: 'p-6',
      actions: this.getAddFriendActions(),
      onClose: () => {
        this.dialogErrorMessage = '';
        this.isSubmitting = false;
        this.friendForm = this.createEmptyFriendForm();
      }
    });
  }

  openDeleteFriendDialog(friend: Friend) {
    this.closeSwipeActions();
    this.pendingDeleteFriend = friend;
    this.dialogErrorMessage = '';
    this.commonDialogService.open({
      title: this.t('friends.deleteDialogTitle'),
      icon: 'delete',
      content: this.deleteFriendDialog,
      bodyClass: 'p-6',
      panelClass: 'max-w-lg',
      actions: this.getDeleteFriendActions(),
      onClose: () => {
        this.dialogErrorMessage = '';
        this.isDeleting = false;
        this.pendingDeleteFriend = null;
      }
    });
  }

  async addFriend(): Promise<void> {
    if (!this.isFriendFormValid()) {
      return;
    }

    if (this.hasDuplicateEmail()) {
      this.dialogErrorMessage = 'A friend with this email already exists.';
      return;
    }

    this.isSubmitting = true;
    this.dialogErrorMessage = '';
    this.friendForm.phone = this.sanitizePhone(this.friendForm.phone);

    try {
      const newFriend = await this.friendService.addFriend(this.friendForm);
      await this.activityService.logActivity({
        type: 'add-friend',
        title: 'Added friend',
        description: `Added friend "${newFriend.name}"`,
        metadata: { friendName: newFriend.name, friendEmail: newFriend.email }
      });
      this.friends = [newFriend, ...this.friends].sort((leftFriend, rightFriend) => leftFriend.name.localeCompare(rightFriend.name));
      this.currentPage = 1;
      this.commonDialogService.close();
    } catch (error) {
      console.error('Unable to add friend.', error);
      this.dialogErrorMessage = 'Unable to add friend right now. Please try again.';
    } finally {
      this.isSubmitting = false;
    }
  }

  async confirmDeleteFriend(): Promise<void> {
    if (!this.pendingDeleteFriend) {
      return;
    }

    this.isDeleting = true;
    this.dialogErrorMessage = '';

    try {
      await this.friendService.deleteFriend(this.pendingDeleteFriend.id);
      await this.activityService.logActivity({
        type: 'delete-friend',
        title: 'Deleted friend',
        description: `Deleted friend "${this.pendingDeleteFriend.name}"`,
        metadata: { friendName: this.pendingDeleteFriend.name, friendEmail: this.pendingDeleteFriend.email }
      });
      this.friends = this.friends.filter((friend) => friend.id !== this.pendingDeleteFriend?.id);
      this.ensureValidPage();
      this.commonDialogService.close();
    } catch (error) {
      console.error('Unable to delete friend.', error);
      this.dialogErrorMessage = 'Unable to delete friend right now. Please try again.';
    } finally {
      this.isDeleting = false;
    }
  }

  startEdit(friend: Friend): void {
    this.closeSwipeActions();
    this.editingFriendId = friend.id;
    this.editForm = { name: friend.name, email: friend.email, phone: this.sanitizePhone(friend.phone) };
  }

  cancelEdit(): void {
    this.editingFriendId = null;
    this.editForm = this.createEmptyFriendForm();
  }

  async saveEdit(friend: Friend, event?: Event): Promise<void> {
    event?.stopPropagation();
    const updatedForm: FriendForm = {
      name: this.editForm.name.trim(),
      email: this.editForm.email.trim(),
      phone: this.sanitizePhone(this.editForm.phone)
    };

    if (!updatedForm.name || !updatedForm.email || !updatedForm.phone) {
      return;
    }

    this.isSaving = true;
    try {
      await this.friendService.updateFriend(friend.id, updatedForm);

      const normalizedEmail = updatedForm.email.toLowerCase();
      this.friends = this.friends.map((item) =>
        item.id === friend.id
          ? { ...item, name: updatedForm.name, email: normalizedEmail, phone: updatedForm.phone }
          : item
      );

      this.editingFriendId = null;
      this.editForm = this.createEmptyFriendForm();
      this.closeSwipeActions();
      this.cdr.detectChanges();

      void this.activityService.logActivity({
        type: 'update-friend',
        title: 'Updated friend',
        description: `Updated friend "${updatedForm.name}"`,
        metadata: { friendId: friend.id, friendName: updatedForm.name }
      }).catch((logError) => {
        console.error('Unable to log friend update activity.', logError);
      });
    } catch (error) {
      console.error('Unable to update friend.', error);
    } finally {
      this.isSaving = false;
    }
  }

  get pagedFriends(): Friend[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.friends.slice(startIndex, startIndex + this.pageSize);
  }

  onPageChange(page: number) {
    this.currentPage = page;
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  getAvatarColorClasses(seed: string): string {
    return this.avatarColorService.getInitialAvatarClasses(seed);
  }

  onFriendPhoneInput(value: string): void {
    this.friendForm.phone = this.sanitizePhone(value);
  }

  onEditPhoneInput(value: string): void {
    this.editForm.phone = this.sanitizePhone(value);
  }

  onMobileFriendCardClick(friend: Friend): void {
    if (this.editingFriendId === friend.id || this.draggingFriendId) {
      return;
    }

    if (this.openedSwipeFriendId === friend.id) {
      this.closeSwipeActions();
    }
  }

  getSwipeTransform(friendId: string): string {
    if (this.draggingFriendId === friendId) {
      return `translateX(${this.currentSwipeOffset}px)`;
    }

    if (this.openedSwipeFriendId === friendId) {
      return `translateX(-${MOBILE_SWIPE_ACTION_WIDTH}px)`;
    }

    return 'translateX(0px)';
  }

  getSwipeDeleteOpacity(friendId: string): string {
    return this.getSwipeRevealProgress(friendId).toFixed(2);
  }

  getSwipeDeleteTransform(friendId: string): string {
    const progress = this.getSwipeRevealProgress(friendId);
    const offset = (1 - progress) * 24;
    return `translateX(${offset}px)`;
  }

  isSwipeDeleteActionEnabled(friendId: string): boolean {
    return this.openedSwipeFriendId === friendId;
  }

  onFriendTouchStart(friendId: string, event: TouchEvent): void {
    if (this.editingFriendId === friendId) {
      return;
    }

    if (this.openedSwipeFriendId && this.openedSwipeFriendId !== friendId) {
      this.closeSwipeActions();
    }

    this.draggingFriendId = friendId;
    this.touchStartX = event.touches[0]?.clientX ?? 0;
    this.currentSwipeOffset = this.openedSwipeFriendId === friendId ? -MOBILE_SWIPE_ACTION_WIDTH : 0;
  }

  onFriendTouchMove(friendId: string, event: TouchEvent): void {
    if (this.draggingFriendId !== friendId) {
      return;
    }

    const currentX = event.touches[0]?.clientX ?? this.touchStartX;
    const deltaX = currentX - this.touchStartX;
    const baseOffset = this.openedSwipeFriendId === friendId ? -MOBILE_SWIPE_ACTION_WIDTH : 0;
    this.currentSwipeOffset = Math.max(-MOBILE_SWIPE_ACTION_WIDTH, Math.min(0, baseOffset + deltaX));
  }

  onFriendTouchEnd(friendId: string): void {
    if (this.draggingFriendId !== friendId) {
      return;
    }

    if (this.currentSwipeOffset <= -(MOBILE_SWIPE_ACTION_WIDTH / 2)) {
      this.openedSwipeFriendId = friendId;
    } else {
      this.openedSwipeFriendId = '';
    }

    this.draggingFriendId = '';
    this.currentSwipeOffset = 0;
  }

  onFriendTouchCancel(): void {
    this.draggingFriendId = '';
    this.currentSwipeOffset = 0;
  }

  private getAddFriendActions(): CommonDialogAction[] {
    return [
      {
        label: this.t('friends.cancel'),
        kind: 'secondary',
        disabled: () => this.isSubmitting,
        handler: () => this.commonDialogService.close()
      },
      {
        label: () => (this.isSubmitting ? this.t('friends.adding') : this.t('friends.add')),
        icon: () => (this.isSubmitting ? 'progress_activity' : 'person_add'),
        kind: 'primary',
        grow: true,
        disabled: () => this.isSubmitting || !this.isFriendFormValid(),
        handler: () => {
          void this.addFriend();
        }
      }
    ];
  }

  private getDeleteFriendActions(): CommonDialogAction[] {
    return [
      {
        label: this.t('friends.cancel'),
        kind: 'secondary',
        disabled: () => this.isDeleting,
        handler: () => this.commonDialogService.close()
      },
      {
        label: () => (this.isDeleting ? this.t('friends.deleting') : this.t('friends.delete')),
        icon: () => (this.isDeleting ? 'progress_activity' : 'delete'),
        kind: 'danger',
        grow: true,
        disabled: () => this.isDeleting,
        handler: () => {
          void this.confirmDeleteFriend();
        }
      }
    ];
  }

  private loadFriends(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.unsubscribeFriends?.();

    const loadingTimeout = setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        this.errorMessage = 'Connection timed out. Please check your network and Firebase rules, then refresh.';
        this.cdr.detectChanges();
      }
    }, 3000);

    this.unsubscribeFriends = this.friendService.listenToFriends(
      (friends) => {
        this.ngZone.run(() => {
          clearTimeout(loadingTimeout);
          this.friends = friends;
          this.ensureValidPage();
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      (error) => {
        this.ngZone.run(() => {
          clearTimeout(loadingTimeout);
          console.error('Unable to load friends.', error);
          this.errorMessage = 'Unable to load friends right now. Please refresh and try again.';
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      }
    );
  }

  private isFriendFormValid(): boolean {
    return !!(
      this.friendForm.name.trim() &&
      this.friendForm.email.trim() &&
      this.friendForm.phone.trim() &&
      this.friendForm.email.includes('@')
    );
  }

  private hasDuplicateEmail(): boolean {
    const normalizedEmail = this.friendForm.email.trim().toLowerCase();
    return this.friends.some((friend) => friend.email.trim().toLowerCase() === normalizedEmail);
  }

  private createEmptyFriendForm(): FriendForm {
    return {
      name: '',
      email: '',
      phone: ''
    };
  }

  private sanitizePhone(value: string): string {
    return String(value ?? '').replaceAll(/\D+/g, '');
  }

  private closeSwipeActions(): void {
    this.openedSwipeFriendId = '';
    this.draggingFriendId = '';
    this.currentSwipeOffset = 0;
  }

  private getSwipeRevealProgress(friendId: string): number {
    if (this.openedSwipeFriendId === friendId) {
      return 1;
    }

    if (this.draggingFriendId !== friendId || this.currentSwipeOffset >= 0) {
      return 0;
    }

    return Math.min(1, Math.abs(this.currentSwipeOffset) / MOBILE_SWIPE_ACTION_WIDTH);
  }

  private ensureValidPage() {
    const totalPages = Math.max(1, Math.ceil(this.friends.length / this.pageSize));
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }
  }

  t(key: string): string {
    return this.translationService.t(key);
  }
}
