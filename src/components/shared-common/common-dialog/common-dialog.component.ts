import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommonDialogAction, CommonDialogConfig, CommonDialogService } from '../../../services/common-dialog.service';

@Component({
  selector: 'joys-common-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="dialog() as activeDialog">
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        (click)="onBackdropClick($event, activeDialog)"
      >
        <div
          class="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900"
          [ngClass]="getPanelClasses(activeDialog)"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="activeDialog.title"
        >
          <header class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 sm:px-6 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
            <div class="flex items-center gap-3">
              <div *ngIf="activeDialog.icon" class="rounded-lg bg-primary/10 p-2 text-primary">
                <span class="material-symbols-outlined block">{{ activeDialog.icon }}</span>
              </div>
              <h1 class="text-xl font-bold tracking-tight">{{ activeDialog.title }}</h1>
            </div>

            <button
              *ngIf="activeDialog.showCloseButton !== false"
              type="button"
              (click)="dialogService.close()"
              class="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span class="material-symbols-outlined block">close</span>
            </button>
          </header>

          <main class="flex-1 overflow-y-auto" [ngClass]="activeDialog.bodyClass || 'p-6'">
            <ng-container
              [ngTemplateOutlet]="activeDialog.content"
              [ngTemplateOutletContext]="activeDialog.context || {}"
            ></ng-container>
          </main>

          <footer
            *ngIf="activeDialog.actions?.length"
            class="border-t border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900"
            [ngClass]="activeDialog.footerClass"
          >
            <div class="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                *ngFor="let action of activeDialog.actions"
                type="button"
                [disabled]="isActionDisabled(action)"
                [ngClass]="getActionClasses(action)"
                (click)="onActionClick(action)"
              >
                <span *ngIf="getActionIcon(action) as actionIcon" class="material-symbols-outlined text-lg">{{ actionIcon }}</span>
                {{ getActionLabel(action) }}
              </button>
            </div>
          </footer>
        </div>
      </div>
    </ng-container>
  `
})
export class CommonDialogComponent {
  readonly dialog = this.dialogService.dialog;

  constructor(public readonly dialogService: CommonDialogService) {}

  onBackdropClick(event: Event, activeDialog: CommonDialogConfig) {
    if (activeDialog.closeOnBackdrop !== false && event.target === event.currentTarget) {
      this.dialogService.close();
    }
  }

  onActionClick(action: CommonDialogAction) {
    if (this.isActionDisabled(action)) {
      return;
    }

    action.handler?.();

    if (action.autoClose) {
      this.dialogService.close();
    }
  }

  isActionDisabled(action: CommonDialogAction): boolean {
    return typeof action.disabled === 'function' ? action.disabled() : !!action.disabled;
  }

  getActionLabel(action: CommonDialogAction): string {
    return typeof action.label === 'function' ? action.label() : action.label;
  }

  getActionIcon(action: CommonDialogAction): string | undefined {
    return typeof action.icon === 'function' ? action.icon() : action.icon;
  }

  getPanelClasses(dialog: CommonDialogConfig): string[] {
    return ['max-w-2xl', dialog.panelClass || ''].filter(Boolean);
  }

  getActionClasses(action: CommonDialogAction): string[] {
    const baseClasses = 'flex items-center justify-center gap-2 rounded-xl py-3.5 sm:py-4 font-bold transition-all';
    const growthClasses = action.grow ? 'flex-[2]' : 'flex-1';

    const variantClasses: Record<string, string> = {
      primary: 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:bg-slate-300 disabled:cursor-not-allowed',
      secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
      danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed'
    };

    return [baseClasses, growthClasses, variantClasses[action.kind || 'secondary'] || variantClasses['secondary'], action.className || ''];
  }
}
