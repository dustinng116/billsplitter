import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommonDialogAction, CommonDialogConfig, CommonDialogService } from '../../../services/common-dialog.service';

@Component({
  styleUrl: './common-dialog.component.scss',
  selector: 'joys-common-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './common-dialog.component.html'
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
