import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
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
import { FriendService } from '../../services/friend.service';
import { ActivityService } from '../../services/activity.service';
import { AvatarColorService } from '../../services/avatar-color.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { UserSessionService } from '../../services/user-session.service';
import { Friend, FriendForm } from '../../types/friend.interface';

const MOBILE_SWIPE_ACTION_WIDTH = 88;

@Component({
  styleUrl: './friends-page.component.scss',
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
  templateUrl: './friends-page.component.html'
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
  private userSubscription: Subscription | null = null;
  private lastSessionKey = '__uninitialized__';
  private loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private activeLoadVersion = 0;
  private readonly minimumLoadingDuration = 500;

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
    private readonly userSessionService: UserSessionService,
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
      this.loadFriends();
    });
  }

  ngOnDestroy(): void {
    this.clearLoadingTimeout();
    this.unsubscribeFriends?.();
    this.unsubscribeFriends = null;
    this.userSubscription?.unsubscribe();
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
      this.dialogErrorMessage = this.t('friends.duplicateEmail');
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
      this.dialogErrorMessage = this.t('friends.addError');
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
      this.dialogErrorMessage = this.t('friends.deleteError');
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
    const loadVersion = ++this.activeLoadVersion;
    const loadStartedAt = Date.now();
    this.isLoading = true;
    this.errorMessage = '';
    this.clearLoadingTimeout();
    this.unsubscribeFriends?.();

    this.loadingTimeoutId = setTimeout(() => {
      if (this.isLoading) {
        this.isLoading = false;
        this.errorMessage = this.t('joys.timeoutError');
        this.cdr.detectChanges();
      }
    }, 3000);

    this.unsubscribeFriends = this.friendService.listenToFriends(
      (friends) => {
        this.ngZone.run(() => {
          this.completeLoad(loadVersion, loadStartedAt, () => {
            this.friends = friends;
            this.ensureValidPage();
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        });
      },
      (error) => {
        this.ngZone.run(() => {
          this.completeLoad(loadVersion, loadStartedAt, () => {
            console.error('Unable to load friends.', error);
            this.errorMessage = this.t('friends.loadError');
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
