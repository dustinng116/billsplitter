import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';

interface CheckboxGroup {
  groupName: string;
  isChecked: boolean;
}

interface RowData {
  name: string;
  groups: CheckboxGroup[];
}
@Component({
  selector: 'app-map-user-group',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose, 
    TranslateModule,
  ],
  templateUrl: './map-user-group.component.html',
  styleUrl: './map-user-group.component.css',
})
export class MapUserGroupComponent {
  rows: RowData[] = [];

  toggleCheckbox(row: RowData, group: CheckboxGroup): void {
    group.isChecked = !group.isChecked;
  }

  constructor(
    public dialogRef: MatDialogRef<MapUserGroupComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}
  ngOnInit() {
    this.rows = [...this.data];
  }
}
