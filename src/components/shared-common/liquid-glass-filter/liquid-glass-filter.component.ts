import {
  Component, Input, OnChanges, OnInit, SimpleChanges,
  ChangeDetectionStrategy, ChangeDetectorRef, Inject, PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { LiquidGlassService, BezelType } from '../../../services/liquid-glass.service';

/**
 * LiquidGlassFilterComponent
 * ─────────────────────────────────────────────────────────────────────────────
 * Angular port of vue-web-liquid-glass/src/components/Filter.vue
 *
 * Renders a hidden <svg> with an SVG filter that uses:
 *   1. A canvas-generated displacement map (Snell's law refraction physics)
 *   2. A canvas-generated specular rim-light map
 *
 * Usage in template:
 *   <joys-liquid-glass-filter [filterId]="'my-filter'" [width]="400" [height]="72" />
 *   <nav [style.filter]="'url(#my-filter)'">...</nav>
 *
 * Cross-browser note:
 *   CSS `filter` (not backdrop-filter) is used here so it works in Safari/Firefox.
 *   For Chrome-only backdrop refraction use backdrop-filter: url(#id).
 */
@Component({
  selector: 'joys-liquid-glass-filter',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg style="display:none; position:absolute; width:0; height:0; overflow:hidden;"
         aria-hidden="true">
      <defs>
        <filter [id]="filterId" color-interpolation-filters="sRGB"
                x="-8%" y="-8%" width="116%" height="116%">

          <!-- Step 1: Slight soften of source before displacement -->
          <feGaussianBlur in="SourceGraphic" [attr.stdDeviation]="blur" result="blurred" />

          <!-- Step 2: Physics displacement map (Snell's law, convex lens bezel) -->
          <feImage *ngIf="displacementUrl"
                   [attr.href]="displacementUrl"
                   x="0" y="0"
                   [attr.width]="width"
                   [attr.height]="height"
                   preserveAspectRatio="none"
                   result="d_map" />

          <!-- Step 3: Displace backdrop pixels at the glass edge -->
          <feDisplacementMap in="blurred" in2="d_map"
                             [attr.scale]="scale"
                             xChannelSelector="R"
                             yChannelSelector="G"
                             result="displaced" />

          <!-- Step 4: Boost colour saturation (vivid glass look) -->
          <feColorMatrix in="displaced" type="saturate"
                         [attr.values]="specularSaturation.toString()"
                         result="saturated" />

          <!-- Step 5: Specular rim-light image -->
          <feImage *ngIf="specularUrl"
                   [attr.href]="specularUrl"
                   x="0" y="0"
                   [attr.width]="width"
                   [attr.height]="height"
                   preserveAspectRatio="none"
                   result="specular_raw" />

          <!-- Step 6: Control specular brightness via alpha slope -->
          <feComponentTransfer in="specular_raw" result="specular_layer">
            <feFuncA type="linear" [attr.slope]="specularOpacity" />
          </feComponentTransfer>

          <!-- Step 7: Screen-blend specular rim onto the displaced glass surface.
               This makes the top-edge highlight "glow" while the interior stays
               fully visible showing the refracted blurred backdrop. -->
          <feBlend in="saturated" in2="specular_layer" mode="screen" />
        </filter>
      </defs>
    </svg>
  `,

})
export class LiquidGlassFilterComponent implements OnInit, OnChanges {
  @Input() filterId  = 'lg-filter';
  @Input() width     = 300;
  @Input() height    = 72;
  @Input() bezelWidth      = 32;
  @Input() glassThickness  = 120;
  @Input() refractiveIndex = 1.5;
  @Input() bezelType: BezelType = 'convex_squircle';
  @Input() scaleRatio      = 1;
  @Input() specularOpacity = 0.45;
  @Input() specularSaturation = 1.4;
  @Input() blur            = 0.3;

  displacementUrl = '';
  specularUrl     = '';
  scale           = 0;

  private isBrowser: boolean;

  constructor(
    private readonly lgService: LiquidGlassService,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() { this.regenerate(); }

  ngOnChanges(changes: SimpleChanges) {
    if ('width' in changes || 'height' in changes || 'bezelWidth' in changes ||
        'glassThickness' in changes || 'bezelType' in changes) {
      this.regenerate();
    }
  }

  private regenerate() {
    if (!this.isBrowser) return;

    // Run off the main thread tick so the component's DOM dimensions are settled
    setTimeout(() => {
      const assets = this.lgService.generate({
        width:           this.width,
        height:          this.height,
        bezelWidth:      this.bezelWidth,
        glassThickness:  this.glassThickness,
        refractiveIndex: this.refractiveIndex,
        bezelType:       this.bezelType,
        scaleRatio:      this.scaleRatio,
      });
      this.displacementUrl = assets.displacementUrl;
      this.specularUrl     = assets.specularUrl;
      this.scale           = assets.scale;
      this.cdr.detectChanges();
    }, 0);
  }
}
