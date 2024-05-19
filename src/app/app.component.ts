import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CalculatorComponent } from './calculator/calculator.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MapUserGroupComponent } from './calculator/dialog/map-user-group/map-user-group.component';
@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  imports: [RouterOutlet, CalculatorComponent, MapUserGroupComponent, TranslateModule],
})
export class AppComponent implements OnInit {
  title = 'bill-splitter';
  copyrightYear = new Date().getFullYear();
  currentLanguage: string | null = null;

  constructor(public translate: TranslateService) {
    translate.addLangs(['en', 'vi']);
    translate.setDefaultLang('en'); 
    this.currentLanguage = localStorage.getItem('languageSite') || null;
    if(!this.currentLanguage)localStorage.setItem('languageSite', 'vi');
    const browserLang = translate.getBrowserLang();
    translate.use(browserLang?.match(/en|vi/) ? browserLang : 'vi'); 
  }
  ngOnInit() {
    this.currentLanguage = localStorage.getItem('languageSite') || null;
    if (this.currentLanguage) {
      this.translate.use(this.currentLanguage);
    } else {
      const browserLang = this.translate.getBrowserLang();
      this.translate.use(browserLang?.match(/en|vi/) ? browserLang : 'vi');
      browserLang?.match(/en|vi/)
        ? (this.currentLanguage = browserLang)
        : (this.currentLanguage = 'vi');
    }
  }
  changeLang(lang: any) {
    this.translate.use(lang);
    this.currentLanguage = lang;
    localStorage.setItem('languageSite', lang);
  }
}
