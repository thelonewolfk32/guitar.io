import type {Settings} from '@coderline/alphatab';

export function applyScoreColors(settings:Settings,dark:boolean) {
  const defaults=new window.alphaTab.Settings().display.resources,color=window.alphaTab.model.Color;
  settings.display.resources.mainGlyphColor=dark?new color(227,229,223):defaults.mainGlyphColor;
  settings.display.resources.secondaryGlyphColor=dark?new color(173,183,177):defaults.secondaryGlyphColor;
  settings.display.resources.staffLineColor=dark?new color(89,98,108):defaults.staffLineColor;
  settings.display.resources.barSeparatorColor=dark?new color(110,118,130):defaults.barSeparatorColor;
}
