import { Directive, HostListener, ElementRef, OnInit } from '@angular/core'; 

@Directive({
  selector: '[appCurrencyFormat]',
  standalone: true
}) 

export class CurrencyInputDirective {
  private el: HTMLInputElement;

  constructor(private elementRef: ElementRef) {
    this.el = this.elementRef.nativeElement;
  }

  @HostListener('input', ['$event.target.value'])
  onInput(value: string): void {
    console.log(value)
    // Remove all non-digit characters
    value = value.replace(/\D/g, '');
    // Format the number using a simple regex
    let formatted = value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    // Set the formatted value
    this.el.value = formatted;
  }
}
