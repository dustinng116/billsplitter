import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'vndCurrency'
})
export class VndCurrencyPipe implements PipeTransform {

  transform(value: any, format: boolean = true): any {
    if (!value || isNaN(value)) return value;
    return format ? value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }) : value;
  }
}
