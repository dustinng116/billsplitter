import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapUserGroupComponent } from './map-user-group.component';

describe('MapUserGroupComponent', () => {
  let component: MapUserGroupComponent;
  let fixture: ComponentFixture<MapUserGroupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapUserGroupComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MapUserGroupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
