import { ChangeDetectorRef, Component, EventEmitter, HostListener, NgZone, OnDestroy, OnInit, Output, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { type Unsubscribe } from 'firebase/database';
import { CommonDialogAction, CommonDialogService } from '../../services/common-dialog.service';
import { JoyService } from '../../services/joy.service';
import { FriendService } from '../../services/friend.service';
import { ActivityService } from '../../services/activity.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { Friend } from '../../types/friend.interface';
import { JoyGroup, JoyGroupMember } from '../../types/joy.interface';

interface GroupCategory {
  id: string;
  name: string;
  icon: string;
}

interface GroupMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  initials: string;
}

interface NewGroupForm {
  name: string;
  category: string;
  customCategoryName: string;
  photo?: string;
  members: GroupMember[];
}

type GroupMemberIdentityFields = 'id' | 'name' | 'email' | 'phone' | 'avatar' | 'initials';
type EditableMemberIdentity = Pick<GroupMember, GroupMemberIdentityFields>;
type PersistedMemberIdentity = Pick<JoyGroupMember, GroupMemberIdentityFields>;

@Component({
  selector: 'joys-new-group-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <ng-template #dialogContent>
      <div class="space-y-6">
          <div *ngIf="!targetJoyId" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
            {{ 'newGroup.selectJoyFirst' | translate }}
          </div>
          <!-- Group Photo Upload -->
          <section class="flex flex-col items-center gap-3">
            <div class="relative group">
              <div 
                class="h-24 w-24 rounded-full border-4 border-slate-50 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 bg-center bg-cover flex items-center justify-center overflow-hidden cursor-pointer"
                [style.background-image]="groupForm.photo ? 'url(' + groupForm.photo + ')' : 'url(https://images.pexels.com/photos/1181396/pexels-photo-1181396.jpeg?auto=compress&cs=tinysrgb&w=300)'"
                (click)="onPhotoClick()"
              >
                <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span class="material-symbols-outlined text-white text-2xl">photo_camera</span>
                </div>
              </div>
              <div class="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center text-white border-2 border-white dark:border-slate-900 shadow-sm">
                <span class="material-symbols-outlined text-sm">edit</span>
              </div>
            </div>
            <div class="text-center">
              <p class="text-base font-semibold">{{ 'newGroup.groupPhoto' | translate }}</p>
              <p class="text-sm text-slate-500 dark:text-slate-400">{{ 'newGroup.photoHint' | translate }}</p>
            </div>
          </section>

          <!-- Group Name Input -->
          <section class="space-y-4">
            <div class="flex flex-col gap-2">
              <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'newGroup.groupName' | translate }}</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">group</span>
                <input 
                  [(ngModel)]="groupForm.name"
                  class="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all outline-none" 
                  placeholder="e.g., Europe Summer Trip 2024" 
                  type="text"
                />
              </div>
            </div>
          </section>

          <!-- Group Category Selection -->
          <section class="space-y-4">
            <div class="border-t border-slate-100 dark:border-slate-800 pt-4">
              <h3 class="text-base font-bold mb-3">{{ 'newGroup.groupCategory' | translate }}</h3>
              <div *ngIf="isMobileViewport; else desktopCategoryGrid" class="relative">
                <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">category</span>
                <select
                  [(ngModel)]="groupForm.category"
                  class="w-full appearance-none rounded-xl border-transparent bg-slate-50 py-3 pl-12 pr-10 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option *ngFor="let category of categories" [value]="category.id">{{ category.name }}</option>
                </select>
                <span class="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">expand_more</span>
              </div>

              <ng-template #desktopCategoryGrid>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button 
                    *ngFor="let category of categories"
                    (click)="selectCategory(category.id)"
                    [class]="getCategoryButtonClasses(category.id)"
                    type="button"
                  >
                    <span class="material-symbols-outlined" [class]="getCategoryIconClasses(category.id)">{{ category.icon }}</span>
                    <span class="text-sm font-medium" [class]="getCategoryTextClasses(category.id)">{{ category.name }}</span>
                  </button>
                </div>
              </ng-template>

              <div *ngIf="isOtherCategorySelected()" class="mt-4 flex flex-col gap-2">
                <label class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'newGroup.customCategoryLabel' | translate }}</label>
                <input
                  [(ngModel)]="groupForm.customCategoryName"
                  type="text"
                  [placeholder]="'newGroup.customCategoryPlaceholder' | translate"
                  class="w-full rounded-xl border-transparent bg-slate-50 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:bg-slate-800 dark:text-slate-100"
                />
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ 'newGroup.customCategoryHint' | translate }}</p>
              </div>
            </div>
          </section>

          <!-- Invite Members -->
          <section class="space-y-4">
            <div class="border-t border-slate-100 dark:border-slate-800 pt-4">
              <h3 class="text-base font-bold mb-3">{{ 'newGroup.inviteMembers' | translate }}</h3>
              <div class="flex items-center justify-between mb-4">
                <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'newGroup.addMembers' | translate }}</p>
                <span class="text-xs text-slate-500 dark:text-slate-400">{{ groupForm.members.length }}/10 {{ 'newGroup.added' | translate }}</span>
              </div>

              <div *ngIf="areFriendsLoading" class="mb-3 text-xs text-slate-500 dark:text-slate-400">
                {{ 'newGroup.loadingFriends' | translate }}
              </div>

              <!-- Chips mode when total friends < 10 -->
              <div *ngIf="showMemberChips" class="mb-4 flex flex-wrap gap-2">
                <button
                  *ngFor="let member of availableMembers"
                  type="button"
                  (click)="toggleMember(member)"
                  [class]="getMemberChipClasses(member)"
                >
                  <span class="text-[10px] font-bold leading-none">{{ member.initials }}</span>
                  <span class="text-xs font-semibold">{{ member.name }}</span>
                  <span *ngIf="isMemberSelected(member.id)" class="material-symbols-outlined text-sm">check</span>
                </button>
              </div>

              <!-- Search mode when total friends >= 10 -->
              <div *ngIf="!showMemberChips" class="relative">
                <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">alternate_email</span>
                <input 
                  [(ngModel)]="memberSearchQuery"
                  (input)="onMemberSearch()"
                  class="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                  [placeholder]="'newGroup.searchByNameOrEmail' | translate" 
                  type="text"
                />
              </div>

              <!-- Search Results -->
              <div *ngIf="!showMemberChips && memberSearchQuery && filteredMembers.length > 0" class="space-y-2 max-h-32 overflow-y-auto mt-4">
                <button 
                  *ngFor="let member of filteredMembers"
                  (click)="addMember(member)"
                  class="w-full flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                  type="button"
                >
                  <div class="h-8 w-8 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">
                    {{ member.initials }}
                  </div>
                  <div>
                    <p class="text-sm font-medium">{{ member.name }}</p>
                    <p class="text-xs text-slate-500">{{ member.email }}</p>
                  </div>
                </button>
              </div>

              <!-- Selected Members -->
              <div class="flex flex-wrap gap-2 mt-4">
                <div 
                  *ngFor="let member of groupForm.members"
                  class="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 pl-2 pr-3 py-1 border border-slate-200 dark:border-slate-700"
                >
                  <div class="h-6 w-6 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">
                    {{ member.initials }}
                  </div>
                  <span class="text-sm font-medium">{{ member.name }}{{ getCurrentUserLabel(member.id) }}</span>
                  <button 
                    *ngIf="member.id !== 'current-user'"
                    (click)="removeMember(member.id)"
                    class="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    type="button"
                  >
                    <span class="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
      </div>
    </ng-template>
  `
})
export class NewGroupDialogComponent implements OnInit, OnDestroy {
  @Output() closeDialog = new EventEmitter<void>();
  @Output() groupCreated = new EventEmitter<any>();
  @Output() groupUpdated = new EventEmitter<any>();
  @ViewChild('dialogContent', { static: true }) dialogContent!: TemplateRef<unknown>;

  memberSearchQuery = '';
  targetJoyId = '';
  isSubmitting = false;
  areFriendsLoading = false;
  isMobileViewport = false;
  dialogMode: 'create' | 'edit' = 'create';
  editingGroupId = '';
  private editingGroupSnapshot: JoyGroup | null = null;
  
  groupForm: NewGroupForm = {
    name: '',
    category: 'trip',
    customCategoryName: '',
    photo: '',
    members: []
  };

  categories: GroupCategory[] = [
    { id: 'trip', name: 'Trip', icon: 'flight' },
    { id: 'home', name: 'Home', icon: 'home' },
    { id: 'dinner', name: 'Dinner', icon: 'restaurant' },
    { id: 'entertainment', name: 'Entertainment', icon: 'movie' },
    { id: 'shopping', name: 'Shopping', icon: 'shopping_bag' },
    { id: 'work', name: 'Work', icon: 'work' },
    { id: 'family', name: 'Family', icon: 'family_restroom' },
    { id: 'sport', name: 'Sport', icon: 'sports_soccer' },
    { id: 'other', name: 'Other', icon: 'more_horiz' }
  ];

  availableMembers: GroupMember[] = [];

  filteredMembers: GroupMember[] = [];
  private unsubscribeFriends: Unsubscribe | null = null;

  get showMemberChips(): boolean {
    return this.availableMembers.length > 0 && this.availableMembers.length < 10;
  }

  constructor(
    private readonly commonDialogService: CommonDialogService,
    private readonly joyService: JoyService,
    private readonly friendService: FriendService,
    private readonly activityService: ActivityService,
    private readonly translationService: TranslationService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.checkViewport();
    this.initializeForm();
    this.listenToFriendSuggestions();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.checkViewport();
  }

  ngOnDestroy(): void {
    this.unsubscribeFriends?.();
    this.unsubscribeFriends = null;
  }

  initializeForm() {
    this.initializeFormWithGroup();
  }

  open(joyId = '') {
    this.dialogMode = 'create';
    this.editingGroupId = '';
    this.editingGroupSnapshot = null;
    this.targetJoyId = joyId;
    this.initializeFormWithGroup();

    this.commonDialogService.open({
      title: this.t('newGroup.createDialogTitle'),
      icon: 'group_add',
      content: this.dialogContent,
      bodyClass: 'p-6',
      panelClass: 'min-h-[600px]',
      actions: this.getDialogActions(),
      onClose: () => this.handleDialogClosed()
    });
  }

  openForEdit(joyId: string, group: JoyGroup) {
    this.dialogMode = 'edit';
    this.editingGroupId = group.id;
    this.editingGroupSnapshot = group;
    this.targetJoyId = joyId;
    this.initializeFormWithGroup(group);

    this.commonDialogService.open({
      title: this.t('newGroup.editDialogTitle'),
      icon: 'settings',
      content: this.dialogContent,
      bodyClass: 'p-6',
      panelClass: 'min-h-[600px]',
      actions: this.getDialogActions(),
      onClose: () => this.handleDialogClosed()
    });
  }

  private initializeFormWithGroup(group?: JoyGroup) {
    const { category, customCategoryName } = this.resolveCategorySelection(group?.category ?? 'trip');
    this.groupForm = {
      name: group?.name ?? '',
      category,
      customCategoryName,
      photo: group?.photo ?? '',
      members: (group?.members ?? []).map((member) => this.toEditableMember(member))
    };
    this.memberSearchQuery = '';
    this.filteredMembers = [];
  }

  close() {
    this.commonDialogService.close();
  }

  private handleDialogClosed() {
    this.closeDialog.emit();
    this.dialogMode = 'create';
    this.editingGroupId = '';
    this.editingGroupSnapshot = null;
    this.initializeFormWithGroup();
  }

  get isEditMode(): boolean {
    return this.dialogMode === 'edit';
  }

  private getDialogActions(): CommonDialogAction[] {
    return [
      {
        label: this.t('friends.cancel'),
        kind: 'secondary',
        disabled: () => this.isSubmitting,
        handler: () => this.close()
      },
      {
        label: () => this.getSubmitActionLabel(),
        icon: () => this.getSubmitActionIcon(),
        kind: 'primary',
        grow: true,
        disabled: () => this.isSubmitting || !this.isFormValid() || !this.targetJoyId,
        handler: () => {
          void this.onSubmitGroup();
        }
      }
    ];
  }

  private getSubmitActionLabel(): string {
    if (this.isEditMode) {
      return this.isSubmitting ? this.t('newGroup.savingChanges') : this.t('newGroup.saveChanges');
    }

    return this.isSubmitting ? this.t('newGroup.creating') : this.t('newGroup.createGroup');
  }

  private getSubmitActionIcon(): string {
    if (this.isSubmitting) {
      return 'progress_activity';
    }

    return this.isEditMode ? 'save' : 'group_add';
  }

  onPhotoClick() {
    console.log('Photo upload clicked');
  }

  selectCategory(categoryId: string) {
    this.groupForm.category = categoryId;
    if (categoryId !== 'other') {
      this.groupForm.customCategoryName = '';
    }
  }

  isOtherCategorySelected(): boolean {
    return this.groupForm.category === 'other';
  }

  getCategoryButtonClasses(categoryId: string): string {
    const baseClasses = 'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all';
    if (this.groupForm.category === categoryId) {
      return `${baseClasses} border-primary bg-primary/5`;
    }
    return `${baseClasses} border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700`;
  }

  getCategoryIconClasses(categoryId: string): string {
    return this.groupForm.category === categoryId ? 'text-primary' : 'text-slate-500';
  }

  getCategoryTextClasses(categoryId: string): string {
    return this.groupForm.category === categoryId ? 'text-primary' : 'text-slate-600 dark:text-slate-400';
  }

  onMemberSearch() {
    if (!this.memberSearchQuery.trim()) {
      this.filteredMembers = [];
      return;
    }

    const query = this.memberSearchQuery.toLowerCase();
    this.filteredMembers = this.availableMembers.filter(member => 
      !this.groupForm.members.some(groupMember => groupMember.id === member.id) &&
      (member.name.toLowerCase().includes(query) || member.email.toLowerCase().includes(query))
    );
  }

  addMember(member: GroupMember) {
    if (this.groupForm.members.length >= 10) {
      return;
    }

    this.groupForm.members.push(member);
    this.memberSearchQuery = '';
    this.filteredMembers = [];
  }

  removeMember(memberId: string) {
    this.groupForm.members = this.groupForm.members.filter(member => member.id !== memberId);
  }

  toggleMember(member: GroupMember): void {
    if (this.isMemberSelected(member.id)) {
      this.removeMember(member.id);
      return;
    }
    this.addMember(member);
  }

  isMemberSelected(memberId: string): boolean {
    return this.groupForm.members.some(member => member.id === memberId);
  }

  getMemberChipClasses(member: GroupMember): string {
    const selected = this.isMemberSelected(member.id);
    const base = 'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all';
    if (selected) {
      return `${base} border-primary bg-primary/10 text-primary`;
    }
    return `${base} border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300`;
  }

  isFormValid(): boolean {
    return !!(
      this.groupForm.name.trim() &&
      this.groupForm.category &&
      this.groupForm.members.length > 0
    );
  }

  async onSubmitGroup() {
    if (this.isEditMode) {
      await this.onUpdateGroup();
      return;
    }

    await this.onCreateGroup();
  }

  async onCreateGroup() {
    if (!this.isFormValid() || !this.targetJoyId) return;

    this.isSubmitting = true;
    const groupPayload = {
      name: this.groupForm.name,
      category: this.getResolvedCategoryName(),
      photo: this.groupForm.photo || 'https://images.pexels.com/photos/1181396/pexels-photo-1181396.jpeg?auto=compress&cs=tinysrgb&w=300',
      members: this.groupForm.members.map((member) => this.buildMemberIdentity(member)),
      createdAt: new Date().toISOString(),
      totalSpent: 0,
      yourBalance: 0,
      balanceType: 'settled' as const
    };

    try {
      const newGroup = await this.joyService.addGroupToJoy(this.targetJoyId, groupPayload);
      await this.activityService.logActivity({
        type: 'create-group',
        title: 'Created new group',
        description: `Created group "${newGroup.name}"`,
        joyId: this.targetJoyId,
        groupId: newGroup.id,
        metadata: { groupName: newGroup.name }
      });
      this.groupCreated.emit(newGroup);
      this.close();
    } catch (error) {
      console.error('Failed to create group for joy.', error);
    } finally {
      this.isSubmitting = false;
    }
  }

  async onUpdateGroup() {
    if (!this.isFormValid() || !this.targetJoyId || !this.editingGroupId || !this.editingGroupSnapshot) return;

    this.isSubmitting = true;
    const groupPayload = {
      ...this.editingGroupSnapshot,
      name: this.groupForm.name.trim(),
      category: this.getResolvedCategoryName(),
      photo: this.groupForm.photo || 'https://images.pexels.com/photos/1181396/pexels-photo-1181396.jpeg?auto=compress&cs=tinysrgb&w=300',
      members: this.groupForm.members.map((member) => this.buildMemberIdentity(member))
    };

    try {
      const updatedGroup = await this.joyService.updateJoyGroup(this.targetJoyId, this.editingGroupId, {
        name: groupPayload.name,
        category: groupPayload.category,
        photo: groupPayload.photo,
        members: groupPayload.members,
        createdAt: groupPayload.createdAt,
        totalSpent: groupPayload.totalSpent,
        yourBalance: groupPayload.yourBalance,
        balanceType: groupPayload.balanceType
      });
      await this.activityService.logActivity({
        type: 'update-group',
        title: 'Saved group details',
        description: `Updated group "${updatedGroup.name}" settings`,
        joyId: this.targetJoyId,
        groupId: this.editingGroupId,
        metadata: { groupName: updatedGroup.name }
      });
      this.groupUpdated.emit(updatedGroup);
      this.close();
    } catch (error) {
      console.error('Failed to update group for joy.', error);
    } finally {
      this.isSubmitting = false;
    }
  }

  private listenToFriendSuggestions(): void {
    this.areFriendsLoading = true;
    this.unsubscribeFriends?.();

    this.unsubscribeFriends = this.friendService.listenToFriends(
      (friends) => {
        this.ngZone.run(() => {
          this.availableMembers = friends.map((friend) => this.toGroupMember(friend));
          this.areFriendsLoading = false;
          if (this.memberSearchQuery.trim()) {
            this.onMemberSearch();
          }
          this.cdr.detectChanges();
        });
      },
      (error) => {
        this.ngZone.run(() => {
          console.error('Unable to load friends for member autocomplete.', error);
          this.availableMembers = [];
          this.filteredMembers = [];
          this.areFriendsLoading = false;
          this.cdr.detectChanges();
        });
      }
    );
  }

  private toGroupMember(friend: Friend): GroupMember {
    return {
      id: friend.id,
      name: friend.name,
      email: friend.email,
      phone: friend.phone || undefined,
      initials: this.getInitials(friend.name)
    };
  }

  private toEditableMember(member: JoyGroupMember): GroupMember {
    return {
      ...this.buildMemberIdentity(member)
    };
  }

  private buildMemberIdentity(member: EditableMemberIdentity): PersistedMemberIdentity {
    const sanitizedMember: PersistedMemberIdentity = {
      id: member.id,
      name: member.name,
      email: member.email,
      initials: member.initials || this.getInitials(member.name)
    };

    if (member.avatar?.trim()) {
      sanitizedMember.avatar = member.avatar;
    }

    if (member.phone?.trim()) {
      sanitizedMember.phone = member.phone;
    }

    return sanitizedMember;
  }

  private resolveCategorySelection(categoryName: string): { category: string; customCategoryName: string } {
    const normalizedCategory = categoryName.trim().toLowerCase();
    const matchedCategory = this.categories.find((category) => category.id === normalizedCategory);

    if (matchedCategory) {
      return { category: matchedCategory.id, customCategoryName: '' };
    }

    if (!normalizedCategory || normalizedCategory === 'others') {
      return { category: 'other', customCategoryName: '' };
    }

    return { category: 'other', customCategoryName: categoryName };
  }

  private getInitials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'FR';
  }

  getCurrentUserLabel(memberId: string): string {
    return memberId === 'current-user' ? ` (${this.t('newGroup.you')})` : '';
  }

  getResolvedCategoryName(): string {
    if (this.groupForm.category !== 'other') {
      return this.groupForm.category;
    }

    return this.groupForm.customCategoryName.trim() || 'Others';
  }

  t(key: string): string {
    return this.translationService.t(key);
  }

  private checkViewport(): void {
    const win = (globalThis as any).window;
    this.isMobileViewport = !!win && win.innerWidth < 1024;
  }
}