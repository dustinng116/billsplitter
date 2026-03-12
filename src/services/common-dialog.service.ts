import { Injectable, TemplateRef, signal } from '@angular/core';

export type CommonDialogActionKind = 'primary' | 'secondary' | 'danger';

export interface CommonDialogAction {
  label: string | (() => string);
  icon?: string | (() => string | undefined);
  kind?: CommonDialogActionKind;
  handler?: () => void;
  disabled?: boolean | (() => boolean);
  className?: string;
  grow?: boolean;
  autoClose?: boolean;
}

export interface CommonDialogConfig<TContext = unknown> {
  title: string;
  icon?: string;
  content: TemplateRef<TContext>;
  context?: TContext;
  panelClass?: string;
  bodyClass?: string;
  footerClass?: string;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  actions?: CommonDialogAction[];
  onClose?: () => void;
}

@Injectable({ providedIn: 'root' })
export class CommonDialogService {
  private readonly dialogState = signal<CommonDialogConfig | null>(null);

  readonly dialog = this.dialogState.asReadonly();

  open<TContext = unknown>(config: CommonDialogConfig<TContext>) {
    this.dialogState.set({
      closeOnBackdrop: true,
      showCloseButton: true,
      actions: [],
      ...config
    });
  }

  close() {
    const currentDialog = this.dialogState();
    if (!currentDialog) {
      return;
    }

    this.dialogState.set(null);
    currentDialog.onClose?.();
  }

  isOpen(): boolean {
    return this.dialogState() !== null;
  }
}
