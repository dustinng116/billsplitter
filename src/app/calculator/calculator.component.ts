import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { CommonModule } from '@angular/common';
import { VndCurrencyPipe } from '../shared/pipes/vnd-currency.pipe';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CurrencyInputDirective } from '../shared/pipes/currency-input.directive';
import { ToastrService } from 'ngx-toastr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MapUserGroupComponent } from './dialog/map-user-group/map-user-group.component';
import { group } from '@angular/animations';

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    MatTableModule,
    MatSelectModule,
    MatSnackBarModule,
    MatCheckboxModule,
    MatDialogModule, 
    TranslateModule,
  ],
  templateUrl: './calculator.component.html',
  styleUrl: './calculator.component.css',
  providers: [VndCurrencyPipe],
})
export class CalculatorComponent {
  public form: FormGroup;
  public submittedData: any = [];
  public baseHeader = ['name'];
  public generatedHeader: string[] = [];
  public finalHeader: string[] = [];
  public total = {
    name: 'tableSplitter.total',
    value: '',
    type: 'total',
  };
  public avgTotal = {
    name: 'tableSplitter.avgTotal',
    value: '',
    type: 'avgTotal',
  };
  isAddListMember = false;
  listMember: string[] = [];
  matrixMemberAndGroup: any[] = [];
  placeHolderListMember: string = `Ex: John, Will, Alex, Jessica\n or\nJohn\nWill\nAlex\nJessica`;
  @ViewChild('typeInput') typeInput: any;
  @ViewChild('amountInput') amountInput: any;

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private toastr: ToastrService,
    private translateService: TranslateService,
    public dialog: MatDialog
  ) {
    this.form = this.fb.group({
      listMember: this.fb.control(''),
      typeOfGroup: this.fb.array([], Validators.required),
      fields: this.fb.array([]),
    });
    this.addNewField();
  }

  get fields() {
    return this.form.get('fields') as FormArray;
  }
  get typeOfGroup(): FormArray {
    return this.form.get('typeOfGroup') as FormArray;
  }

  addGroup(name: string, value: string): void {
    const abbrName = this.convertVNToCamelNotation(name);
    let isDuplicated = false;
    if (name && value) {
      this.typeOfGroup.value.forEach((group: any) => {
        if (group.abbrName === abbrName) {
          this.translateService.get('noti.duplicateGroup').subscribe((msg) => {
            this.toastr.warning(msg, undefined, {
              positionClass: 'toast-bottom-right',
            });
          });
          isDuplicated = true;
          return;
        }
      });
      if (isDuplicated) return;
      this.resetGroupInput();
      this.typeOfGroup.push(
        this.fb.control({
          nameGroup: name,
          abbrName,
          value,
        })
      );
      this.resetGroupInput();
      this.translateService.get('noti.addGroupSuccess').subscribe((msg) => {
        this.toastr.success(msg, undefined, {
          positionClass: 'toast-bottom-right',
        });
      });
    } else {
      this.translateService.get('noti.errorInputGroup').subscribe((msg) => {
        this.toastr.warning(msg, undefined, {
          positionClass: 'toast-bottom-right',
        });
      });
    }
  }
  resetGroupInput() {
    this.typeInput.nativeElement.value = null;
    this.amountInput.nativeElement.value = null;
  }
  checkAddListMember() {
    this.isAddListMember = !this.isAddListMember;
  }
  mapUserWithBill(): void {
    if (!this.form.get('listMember')?.value) {
      this.translateService.get('noti.textareaEmpty').subscribe((msg) => {
        this.toastr.warning(msg, undefined, {
          positionClass: 'toast-bottom-right',
        });
      });
      return;
    }
    const lines = this.form.get('listMember')?.value.split('\n');
    let matrixMemberAndGroup: any = [];
    this.listMember = lines;

    if (this.matrixMemberAndGroup?.length === 0) {
      // Case new bill
      this.listMember.forEach((memberInList: any) => {
        let memberRow: any = {
          name: memberInList,
          groups: [],
          value: 0,
        };
        this.listGroup.forEach((group: any) => {
          let grDetail = {
            groupName: group.abbrName,
            isChecked: false,
          };
          memberRow.groups.push(grDetail);
        });
        matrixMemberAndGroup.push(memberRow);
      });
      this.openDialog(matrixMemberAndGroup);
    } else {
      matrixMemberAndGroup = [...this.matrixMemberAndGroup];
      this.listMember.forEach((memberInList: any) => {
        // Case user deleted from the list
        let isUserDeleted = matrixMemberAndGroup.some(
          (ele: any) => memberInList !== ele.name
        );
        // --------------------------TODO-----------------------
        console.log(isUserDeleted);
        console.log(this.listMember, matrixMemberAndGroup);
        // Case new user added
        let isUserExistInMatrix = matrixMemberAndGroup.some(
          (ele: any) => memberInList === ele.name
        );
        if (!isUserExistInMatrix) {
          let memberRow: any = {
            name: memberInList,
            groups: [],
            value: 0,
          };
          this.listGroup.forEach((group: any) => {
            let grDetail = {
              groupName: group.abbrName,
              isChecked: false,
            };
            memberRow.groups.push(grDetail);
          });
          matrixMemberAndGroup.push(memberRow);
        }
      });

      // Case new group added
      matrixMemberAndGroup.forEach((memberInList: any) => {
        this.listGroup.forEach((group: any) => {
          let isExist = memberInList?.groups.some(
            (gr: any) => gr.groupName === group.abbrName
          );
          if (!isExist) {
            let grDetail = {
              groupName: group.abbrName,
              isChecked: false,
            };
            memberInList.groups.push(grDetail);
          }
        });
      });

      this.openDialog(matrixMemberAndGroup);
    }
  }
  openDialog(data: any) {
    const dialogRef = this.dialog.open(MapUserGroupComponent, {
      width: '60rem',
      data: [...data],
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result.length > 0) {
        this.matrixMemberAndGroup = [...result];
      }
    });
  }
  addNewField() {
    const fieldGroup = this.fb.group({
      name: '',
      value: '',
      type: this.fb.control('', { updateOn: 'blur' }),
    });

    this.fields.push(fieldGroup);
  }
  removeField(index: number) {
    this.fields.removeAt(index);
  }
  removeTable() {
    this.clearData();
  }
  get listGroup() {
    return Object.assign([], this.typeOfGroup.value);
  }
  getNameHeader(abbrName: string) {
    let nameGroup: string = '';
    this.listGroup.forEach((ele: any) => {
      if (abbrName === ele.abbrName) return (nameGroup = ele.nameGroup);
    });
    return nameGroup;
  }
  getNumberMember(abbrName: string) {
    let numberMember: number = 0;
    this.listGroup.forEach((ele: any) => {
      if (abbrName === ele.abbrName) return (numberMember = ele.value);
    });
    return numberMember;
  }
  onSubmit() {
    this.clearData();
    setTimeout(() => {
      this.listGroup.forEach((ele: any) => {
        const grName = ele.abbrName;
        this.generatedHeader.push(grName);
      });
      this.finalHeader = [...this.baseHeader, ...this.generatedHeader];

      this.submittedData = [...this.form.value.fields];
      this.submittedData.push(this.total);
      this.submittedData.push(this.avgTotal);
    }, 0);
  }
  clearData() {
    this.submittedData = [];
    this.generatedHeader = [];
    this.finalHeader = [];
    this.matrixMemberAndGroup = [];
  }
  convertVNToCamelNotation(nameOfGroup: string): string {
    return nameOfGroup
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(' ')
      .map((word, index) => {
        if (word.length == 1) return word;
        else return index === 0 ? word : word[0].toUpperCase() + word.slice(1);
      })
      .join('');
  }
  openSnackBar(message: string, action: string = 'Close') {
    this.snackBar.open(message, action, {
      duration: 3000, // Duration the snack bar will be shown
      horizontalPosition: 'right', // Horizontal position
      verticalPosition: 'top', // Vertical position
    });
  }
  getTotalValue(index: number) {
    const arrayByAbbrName = this.filterItemsByAbbrName(
      this.generatedHeader[index]
    );
    return arrayByAbbrName
      .map((t: any) => t.value)
      .reduce((acc: any, value: any) => acc + value, 0);
  }
  filterItemsByAbbrName(abbrName: string) {
    return this.form.value.fields.filter(
      (item: any) =>
        item.type && typeof item.type === 'string' && item.type === abbrName
    );
  }
  getAmountMemberByAbbrName(abbrName: string) {
    return this.listGroup.find((ele: any) => ele.abbrName === abbrName);
  }

  getAvgInGroup(index: number) {
    const numberOfMember = this.getAmountMemberByAbbrName(
      this.generatedHeader[index]
    )?.value;

    return Math.round(this.getTotalValue(index) / numberOfMember);
  }

  getTotalValuePerMember(row: any) {
    let total = row.value;
    row.groups.forEach((ele: any, index: number) => {
      if (ele.isChecked) {
        total += this.getAvgInGroup(index);
      }
    });
    return total;
  }
  shouldStick(row: any): boolean {
    return row.type === 'total' || row.type === 'avgTotal';
  }
}
