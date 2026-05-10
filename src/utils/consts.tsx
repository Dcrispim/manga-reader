
export const MAX_CHAP_NUMBER = 6

export const THUMB_SIZE = {
  W: 145.83,
  H: 229.17,
}

export const PRESET_SHADOW = {
  blur: 2,
  size: 1,
  color: '#000',
}

export const abbrevStyles: { [k: string]: string } = {
  h: 'height',

  bgc: 'backgroundColor',
  bg: 'background',
  p: 'padding',
  pb: 'paddingBottom',
  pt: 'paddingTop',
  pl: 'paddingLeft',
  pr: 'paddingRight',
  m: 'margin',
  mb: 'marginBottom',
  mt: 'marginTop',
  ml: 'marginLeft',
  mr: 'marginRight',

  bd: 'border',
  bdw: 'borderWidth',
  bdst: 'borderStyle',
  bdsp: 'borderSpacing',

  bdb: 'borderBottom',
  bdt: 'borderTop',
  bdl: 'borderLeft',
  bdr: 'borderRight',

  bdrd: 'borderRadius',
  bdbrd: 'borderBottomRadius',
  bdtrd: 'borderTopRadius',
  bdlrd: 'borderLeftRadius',
  bdrrd: 'borderRightRadius',

  bdblrd: 'borderBottomLeftRadius',
  bdtlrd: 'borderTopLeftRadius',
  bdtrrd: 'borderTopRightRadius',
  bdbrrd: 'borderBottomRightRadius',

  bdbst: 'borderBottomStyle',
  bdtst: 'borderTopStyle',
  bdlst: 'borderLeftStyle',
  bdrst: 'borderRightStyle',

  bdbw: 'borderBottomWidith',
  bdtw: 'borderTopWidith',
  bdlw: 'borderLeftWidith',
  bdrw: 'borderRightWidith',

  ft: 'font',
  ftfm: 'fontFamily',
  ftwgt: 'fontWeight',

  tx: 'text',
  txh: 'textHeight',
  txtalg: 'textAlign',
  txsh: 'textShadow',

  lnh: 'lineHeight',
}

export const sytlesAbrev = Object.keys(abbrevStyles).reduce(
  (p, c) => ({ ...p, [abbrevStyles[c]]: c }),
  {}
)
export const characters =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export const CSS_UNITS = [
  'cm',
  'mm',
  'in',
  'px',
  'pt',
  'p',
  'em',
  'ex',
  'ch',
  'rem',
  'vw',
  'vh',
  'vmin',
  'vmax',
  '%',
]

export type CSS_UNITS_Type =
  | 'cm'
  | 'mm'
  | 'in'
  | 'px'
  | 'pt'
  | 'p'
  | 'em'
  | 'ex'
  | 'ch'
  | 'rem'
  | 'vw'
  | 'vh'
  | 'vmin'
  | 'vmax'
  | '%'

export const NULL_VALUES = {
  borderTopLeftRadius: ['0%'],
  borderTopRightRadius: ['0%'],
  borderBottomLeftRadius: ['0%'],
  borderBottomRightRadius: ['0%'],
  borderRadius: ['0%'],
  transform: ['rotate(0deg)'],
  border: ['1px solid #0f0'],
  textShadow: ['0px 0px 0px #000'],
}

export const especialsChar: {
  [char: string]: string
} = {
  blank: '',
}

export const CSSProps = [
  'alignContent',
  'alignItems',
  'alignSelf',

  'alignTracks',
  'animationDelay',
  'animationDirection',
  'animationDuration',
  'animationFillMode',
  'animationIterationCount',
  'animationName',
  'animationPlayState',
  'animationTimingFunction',
  'appearance',

  'aspectRatio',

  'backdropFilter',
  'backfaceVisibility',

  'backgroundAttachment',

  'backgroundBlendMode',

  'backgroundClip',

  'backgroundColor',

  'backgroundImage',

  'backgroundOrigin',

  'backgroundPosition',

  'backgroundPositionX',

  'backgroundPositionY',

  'backgroundRepeat',
  'backgroundSize',

  'blockOverflow',

  'blockSize',
  'border',

  'borderBlockColor',

  'borderBlockEndColor',

  'borderBlockEndStyle',

  'borderBlockEndWidth',

  'borderBlockStartColor',

  'borderBlockStartStyle',

  'borderBlockStartWidth',

  'borderBlockStyle',

  'borderBlockWidth',

  'borderBottomColor',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',

  'borderBottomStyle',

  'borderBottomWidth',

  'borderCollapse',

  'borderEndEndRadius',

  'borderEndStartRadius',

  'borderImageOutset',

  'borderImageRepeat',

  'borderImageSlice',

  'borderImageSource',

  'borderImageWidth',

  'borderInlineColor',
  'borderInlineEndColor',
  'borderInlineEndStyle',
  'borderInlineEndWidth',
  'borderInlineStartColor',
  'borderInlineStartStyle',

  'borderInlineStartWidth',

  'borderInlineStyle',

  'borderInlineWidth',

  'borderLeftColor',

  'borderLeftStyle',

  'borderLeftWidth',

  'borderRightColor',

  'borderRightStyle',

  'borderRightWidth',

  'borderSpacing',

  'borderStartEndRadius',

  'borderStartStartRadius',

  'borderTopColor',
  'borderTopLeftRadius',
  'borderTopRightRadius',

  'borderTopStyle',

  'borderTopWidth',

  'bottom',

  'boxDecorationBreak',
  'boxShadow',
  'boxSizing',

  'breakAfter',

  'breakBefore',

  'breakInside',

  'captionSide',

  'caretColor',

  'clear',
  'clipPath',

  'color',

  'colorAdjust',
  'columnCount',
  'columnFill',

  'columnGap',
  'columnRuleColor',
  'columnRuleStyle',
  'columnRuleWidth',
  'columnSpan',
  'columnWidth',

  'contain',

  'content',

  'contentVisibility',

  'counterIncrement',

  'counterReset',

  'counterSet',

  'cursor',

  'direction',

  'display',

  'emptyCells',
  'filter',
  'flexBasis',
  'flexDirection',
  'flexGrow',
  'flexShrink',
  'flexWrap',

  'float',

  'fontFamily',
  'fontFeatureSettings',
  'fontKerning',
  'fontLanguageOverride',

  'fontOpticalSizing',

  'fontSize',

  'fontSizeAdjust',

  'fontSmooth',

  'fontStretch',

  'fontStyle',

  'fontSynthesis',

  'fontVariant',

  'fontVariantCaps',

  'fontVariantEastAsian',
  'fontVariantLigatures',

  'fontVariantNumeric',

  'fontVariantPosition',

  'fontVariationSettings',

  'fontWeight',

  'forcedColorAdjust',
  'gridAutoColumns',

  'gridAutoFlow',
  'gridAutoRows',

  'gridColumnEnd',

  'gridColumnStart',

  'gridRowEnd',

  'gridRowStart',

  'gridTemplateAreas',

  'gridTemplateColumns',

  'gridTemplateRows',

  'hangingPunctuation',

  'height',
  'hyphens',

  'imageOrientation',

  'imageRendering',

  'imageResolution',

  'initialLetter',

  'inlineSize',

  'inset',

  'insetBlock',

  'insetBlockEnd',

  'insetBlockStart',

  'insetInline',

  'insetInlineEnd',

  'insetInlineStart',

  'isolation',
  'justifyContent',

  'justifyItems',

  'justifySelf',

  'justifyTracks',

  'left',

  'letterSpacing',
  'lineBreak',

  'lineHeight',

  'lineHeightStep',

  'listStyleImage',

  'listStylePosition',

  'listStyleType',

  'marginBlock',

  'marginBlockEnd',

  'marginBlockStart',

  'marginBottom',

  'marginInline',
  'marginInlineEnd',
  'marginInlineStart',

  'marginLeft',

  'marginRight',

  'marginTop',

  'maskBorderMode',

  'maskBorderOutset',

  'maskBorderRepeat',

  'maskBorderSlice',

  'maskBorderSource',

  'maskBorderWidth',

  'maskClip',

  'maskComposite',

  'maskImage',

  'maskMode',

  'maskOrigin',

  'maskPosition',

  'maskRepeat',

  'maskSize',

  'maskType',

  'mathStyle',

  'maxBlockSize',

  'maxHeight',
  'maxInlineSize',

  'maxLines',

  'maxWidth',

  'minBlockSize',

  'minHeight',

  'minInlineSize',

  'minWidth',

  'mixBlendMode',
  'motionDistance',
  'motionPath',
  'motionRotation',

  'objectFit',

  'objectPosition',

  'offsetAnchor',
  'offsetDistance',
  'offsetPath',
  'offsetRotate',
  'offsetRotation',

  'opacity',
  'order',

  'orphans',

  'outlineColor',

  'outlineOffset',

  'outlineStyle',

  'outlineWidth',

  'overflowAnchor',

  'overflowBlock',

  'overflowClipBox',

  'overflowInline',
  'overflowWrap',

  'overflowX',

  'overflowY',

  'overscrollBehavior',

  'overscrollBehaviorBlock',

  'overscrollBehaviorInline',

  'overscrollBehaviorX',

  'overscrollBehaviorY',
  'padding',

  'paddingBlock',

  'paddingBlockEnd',

  'paddingBlockStart',

  'paddingBottom',

  'paddingInline',
  'paddingInlineEnd',
  'paddingInlineStart',

  'paddingLeft',

  'paddingRight',

  'paddingTop',

  'pageBreakAfter',

  'pageBreakBefore',

  'pageBreakInside',

  'paintOrder',
  'perspective',
  'perspectiveOrigin',

  'placeContent',

  'pointerEvents',

  'position',

  'quotes',

  'resize',

  'right',

  'rotate',
  'rowGap',

  'rubyAlign',

  'rubyMerge',
  'rubyPosition',

  'scale',

  'scrollBehavior',

  'scrollMargin',

  'scrollMarginBlock',

  'scrollMarginBlockEnd',

  'scrollMarginBlockStart',

  'scrollMarginBottom',

  'scrollMarginInline',

  'scrollMarginInlineEnd',

  'scrollMarginInlineStart',

  'scrollMarginLeft',

  'scrollMarginRight',

  'scrollMarginTop',

  'scrollPadding',

  'scrollPaddingBlock',

  'scrollPaddingBlockEnd',

  'scrollPaddingBlockStart',

  'scrollPaddingBottom',

  'scrollPaddingInline',

  'scrollPaddingInlineEnd',

  'scrollPaddingInlineStart',

  'scrollPaddingLeft',

  'scrollPaddingRight',

  'scrollPaddingTop',

  'scrollSnapAlign',

  'scrollSnapMargin',

  'scrollSnapMarginBottom',

  'scrollSnapMarginLeft',

  'scrollSnapMarginRight',

  'scrollSnapMarginTop',

  'scrollSnapStop',
  'scrollSnapType',

  'scrollbarColor',

  'scrollbarGutter',

  'scrollbarWidth',

  'shapeImageThreshold',

  'shapeMargin',

  'shapeOutside',

  'tabSize',

  'tableLayout',

  'textAlign',

  'textAlignLast',
  'textCombineUpright',
  'textDecorationColor',
  'textDecorationLine',
  'textDecorationSkip',

  'textDecorationSkipInk',
  'textDecorationStyle',

  'textDecorationThickness',

  'textDecorationWidth',

  'textEmphasisColor',

  'textEmphasisPosition',

  'textEmphasisStyle',

  'textIndent',

  'textJustify',
  'textOrientation',

  'textOverflow',

  'textRendering',

  'textShadow',

  'textSizeAdjust',

  'textTransform',

  'textUnderlineOffset',
  'textUnderlinePosition',

  'top',
  'touchAction',
  'transform',

  'transformBox',
  'transformOrigin',
  'transformStyle',
  'transitionDelay',
  'transitionDuration',
  'transitionProperty',
  'transitionTimingFunction',

  'translate',

  'unicodeBidi',
  'userSelect',

  'verticalAlign',

  'visibility',

  'whiteSpace',

  'widows',

  'width',

  'willChange',

  'wordBreak',

  'wordSpacing',

  'wordWrap',
  'writingMode',

  'zIndex',

  'zoom',
]
let b = [
  'algctt',
  'algitems',
  'algself',

  'algtracks',
  'animationdelay',
  'animationdirection',
  'animationduration',
  'animationfillmode',
  'animationiterationcount',
  'animationname',
  'animationplaystate',
  'animationtimingfunction',
  'appearance',

  'aspectratio',

  'backdropfilter',
  'backfacevisibility',

  'bgattachment',

  'bgblendmode',

  'bgclip',

  'bgc',

  'bgimage',

  'bgorg',

  'bgpos',

  'bgposx',

  'bgposy',

  'bgrepeat',
  'bgsz',

  'blkovfw',

  'blksz',

  'bdblkc',

  'bdblkendc',

  'bdblkendsty',

  'bdblkendw',

  'bdblkstartc',

  'bdblkstartsty',

  'bdblkstartw',

  'bdblksty',

  'bdblkw',

  'bdbc',
  'bdblrd',
  'bdbrrd',

  'bdbsty',

  'bdbw',

  'bdcollapse',

  'bdendendrd',

  'bdendstartrd',

  'bdimageoutset',

  'bdimagerepeat',

  'bdimageslice',

  'bdimagesource',

  'bdimagew',

  'bdinlnc',
  'bdinlnendc',
  'bdinlnendsty',
  'bdinlnendw',
  'bdinlnstartc',
  'bdinlnstartsty',

  'bdinlnstartw',

  'bdinlnsty',

  'bdinlnw',

  'bdlc',

  'bdlsty',

  'bdlw',

  'bdrc',

  'bdrsty',

  'bdrw',

  'bdspacing',

  'bdstartendrd',

  'bdstartstartrd',

  'bdtc',
  'bdtlrd',
  'bdtrrd',

  'bdtsty',

  'bdtw',

  'b',

  'bxdecorationbk',
  'bxsdw',
  'bxsizing',

  'bkafter',

  'bkbefore',

  'bkinside',

  'captionside',

  'caretc',

  'clear',
  'clippath',

  'c',

  'cadjust',
  'colcount',
  'colfill',

  'colgap',
  'colrulec',
  'colrulesty',
  'colrulew',
  'colspan',
  'colw',

  'contain',

  'ctt',

  'cttvisibility',

  'counterincrement',

  'counterreset',

  'counterset',

  'cursor',

  'direction',

  'display',

  'emptycells',
  'filter',
  'flexbasis',
  'flexdirection',
  'flexgrow',
  'flexshrink',
  'flexwrap',

  'float',

  'ftfamily',
  'ftfeaturesettings',
  'ftkerning',
  'ftlanguageoverride',

  'ftticalsizing',

  'ftsz',

  'ftszadjust',

  'ftsmooth',

  'ftstretch',

  'ftsty',

  'ftsynthesis',

  'ftvariant',

  'ftvariantcaps',

  'ftvarianteastasian',
  'ftvariantligatures',

  'ftvariantnumeric',

  'ftvariantpos',

  'ftvariationsettings',

  'ftwgt',

  'forcedcadjust',
  'gdatcols',

  'gdatflow',
  'gdatrows',

  'gdcolend',

  'gdcolstart',

  'gdrowend',

  'gdrowstart',

  'gdtemplateareas',

  'gdtemplatecols',

  'gdtemplaterows',

  'hangingpunctuation',

  'h',
  'hyphens',

  'imageorientation',

  'imagerendering',

  'imageresolution',

  'initialletter',

  'inlnsz',

  'inset',

  'insetblk',

  'insetblkend',

  'insetblkstart',

  'insetinln',

  'insetinlnend',

  'insetinlnstart',

  'isolation',
  'justifyctt',

  'justifyitems',

  'justifyself',

  'justifytracks',

  'l',

  'letterspacing',
  'lnbk',

  'lnh',

  'lnhstep',

  'liststyimage',

  'liststypos',

  'liststytype',

  'mblk',

  'mblkend',

  'mblkstart',

  'mb',

  'minln',
  'minlnend',
  'minlnstart',

  'ml',

  'mr',

  'mt',

  'maskbdmode',

  'maskbdoutset',

  'maskbdrepeat',

  'maskbdslice',

  'maskbdsource',

  'maskbdw',

  'maskclip',

  'maskcomposite',

  'maskimage',

  'maskmode',

  'maskorg',

  'maskpos',

  'maskrepeat',

  'masksz',

  'masktype',

  'mathsty',

  'maxblksz',

  'maxh',
  'maxinlnsz',

  'maxlns',

  'maxw',

  'minblksz',

  'minh',

  'mininlnsz',

  'minw',

  'mixblendmode',
  'motiondistance',
  'motionpath',
  'motionrt',

  'objectfit',

  'objectpos',

  'ofstanchor',
  'ofstdistance',
  'ofstpath',
  'ofstrotate',
  'ofstrt',

  'opacity',
  'order',

  'orphans',

  'outlnc',

  'outlnofst',

  'outlnsty',

  'outlnw',

  'ovfwanchor',

  'ovfwblk',

  'ovfwclipbx',

  'ovfwinln',
  'ovfwwrap',

  'ovfwx',

  'ovfwy',

  'overscrollbehavior',

  'overscrollbehaviorblk',

  'overscrollbehaviorinln',

  'overscrollbehaviorx',

  'overscrollbehaviory',

  'pblk',

  'pblkend',

  'pblkstart',

  'pb',

  'pinln',
  'pinlnend',
  'pinlnstart',

  'pl',

  'pr',

  'pt',

  'pgbkafter',

  'pgbkbefore',

  'pgbkinside',

  'paintorder',
  'ppctv',
  'ppctvorg',

  'placectt',

  'pointerevents',

  'pos',

  'quotes',

  'resz',

  'r',

  'rotate',
  'rowgap',

  'rubyalg',

  'rubymerge',
  'rubypos',

  'scale',

  'scrollbehavior',

  'scrollm',

  'scrollmblk',

  'scrollmblkend',

  'scrollmblkstart',

  'scrollmb',

  'scrollminln',

  'scrollminlnend',

  'scrollminlnstart',

  'scrollml',

  'scrollmr',

  'scrollmt',

  'scrollp',

  'scrollpblk',

  'scrollpblkend',

  'scrollpblkstart',

  'scrollpb',

  'scrollpinln',

  'scrollpinlnend',

  'scrollpinlnstart',

  'scrollpl',

  'scrollpr',

  'scrollpt',

  'scrollsnapalg',

  'scrollsnapm',

  'scrollsnapmb',

  'scrollsnapml',

  'scrollsnapmr',

  'scrollsnapmt',

  'scrollsnapst',
  'scrollsnaptype',

  'scrollbarc',

  'scrollbargutter',

  'scrollbarw',

  'shapeimagethreshold',

  'shapem',

  'shapeoutside',

  'tabsz',

  'tablelayout',

  'textalg',

  'textalglast',
  'textcombineupr',
  'textdecorationc',
  'textdecorationln',
  'textdecorationskip',

  'textdecorationskipink',
  'textdecorationsty',

  'textdecorationthickness',

  'textdecorationw',

  'textemphasisc',

  'textemphasispos',

  'textemphasissty',

  'textindent',

  'textjustify',
  'textorientation',

  'textovfw',

  'textrendering',

  'textsdw',

  'textszadjust',

  'texttransform',

  'textunderlnofst',
  'textunderlnpos',

  't',
  'touchaction',
  'transform',

  'transformbx',
  'transformorg',
  'transformsty',
  'transitiondelay',
  'transitionduration',
  'transitionproperty',
  'transitiontimingfunction',

  'translate',

  'unicodebidi',
  'userselect',

  'verticalalg',

  'visibility',

  'whitespace',

  'widows',

  'w',

  'willchange',

  'wordbk',

  'wordspacing',

  'wordwrap',
  'writingmode',

  'zindex',

  'zoom',
]
export const tags = ['p', 'i', 'b']

export const psrtMock = `
$START page1
>>34-78-21-37 {"backgroundColor":"black","fontStyle":"italic"} 1 /assets/mangas/ajin/1/01.png
Sample text for page 1, entry 1.

>>94-33-39-23 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/01.png
Sample text for page 1, entry 2.

>>9-54-36-18 {"backgroundColor":"black","fontStyle":"italic"} 3 /assets/mangas/ajin/1/01.png
Sample text for page 1, entry 3.

>>72-77-22-4 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/01.png
Sample text for page 1, entry 4.

$END page1

$START page2
>>5-32-15-38 {"backgroundColor":"black","fontStyle":"italic"} 1 /assets/mangas/ajin/1/02.png
Sample text for page 2, entry 1.

>>38-34-19-31 {"backgroundColor":"black","fontWeight":"bold"} 2 /assets/mangas/ajin/1/02.png
Sample text for page 2, entry 2.

>>24-0-4-49 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/02.png
Sample text for page 2, entry 3.

>>31-23-25-4 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/02.png
Sample text for page 2, entry 4.

$END page2

$START page3
>>0-21-11-16 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/03.png
Sample text for page 3, entry 1.

>>7-23-26-50 {"backgroundColor":"black","textDecoration":"underline"} 2 /assets/mangas/ajin/1/03.png
Sample text for page 3, entry 2.

>>16-72-28-37 {"backgroundColor":"black","fontWeight":"bold"} 3 /assets/mangas/ajin/1/03.png
Sample text for page 3, entry 3.

>>10-99-16-3 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/03.png
Sample text for page 3, entry 4.

$END page3

$START page4
>>8-20-11-14 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/04.png
Sample text for page 4, entry 1.

>>7-33-13-23 {"backgroundColor":"black","color":"red"} 2 /assets/mangas/ajin/1/04.png
Sample text for page 4, entry 2.

>>93-48-5-23 {"backgroundColor":"black","color":"red"} 3 /assets/mangas/ajin/1/04.png
Sample text for page 4, entry 3.

>>77-56-28-9 {"backgroundColor":"black","textDecoration":"underline"} 4 /assets/mangas/ajin/1/04.png
Sample text for page 4, entry 4.

$END page4

$START page5
>>56-9-5-9 {"backgroundColor":"black","color":"red"} 1 /assets/mangas/ajin/1/05.png
Sample text for page 5, entry 1.

>>3-16-9-15 {"backgroundColor":"black","color":"red"} 2 /assets/mangas/ajin/1/05.png
Sample text for page 5, entry 2.

>>75-86-49-36 {"backgroundColor":"black","fontStyle":"italic"} 3 /assets/mangas/ajin/1/05.png
Sample text for page 5, entry 3.

>>8-13-4-10 {"backgroundColor":"black","textDecoration":"underline"} 4 /assets/mangas/ajin/1/05.png
Sample text for page 5, entry 4.

$END page5

$START page6
>>68-58-29-7 {"backgroundColor":"black","fontStyle":"italic"} 1 /assets/mangas/ajin/1/06.png
Sample text for page 6, entry 1.

>>26-71-42-35 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/06.png
Sample text for page 6, entry 2.

>>99-79-35-48 {"backgroundColor":"black","fontStyle":"italic"} 3 /assets/mangas/ajin/1/06.png
Sample text for page 6, entry 3.

>>17-69-49-48 {"backgroundColor":"black","fontWeight":"bold"} 4 /assets/mangas/ajin/1/06.png
Sample text for page 6, entry 4.

$END page6

$START page7
>>75-90-17-47 {"backgroundColor":"black","fontStyle":"italic"} 1 /assets/mangas/ajin/1/07.png
Sample text for page 7, entry 1.

>>94-21-17-11 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/07.png
Sample text for page 7, entry 2.

>>61-26-36-36 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/07.png
Sample text for page 7, entry 3.

>>41-64-17-40 {"backgroundColor":"black","fontWeight":"bold"} 4 /assets/mangas/ajin/1/07.png
Sample text for page 7, entry 4.

$END page7

$START page8
>>55-64-40-42 {"backgroundColor":"black","fontWeight":"bold"} 1 /assets/mangas/ajin/1/08.png
Sample text for page 8, entry 1.

>>71-80-20-3 {"backgroundColor":"black","color":"red"} 2 /assets/mangas/ajin/1/08.png
Sample text for page 8, entry 2.

>>94-57-36-33 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/08.png
Sample text for page 8, entry 3.

>>10-16-42-13 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/08.png
Sample text for page 8, entry 4.

$END page8

$START page9
>>47-18-22-28 {"backgroundColor":"black","fontStyle":"italic"} 1 /assets/mangas/ajin/1/09.png
Sample text for page 9, entry 1.

>>48-30-46-3 {"backgroundColor":"black","textDecoration":"underline"} 2 /assets/mangas/ajin/1/09.png
Sample text for page 9, entry 2.

>>73-71-1-38 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/09.png
Sample text for page 9, entry 3.

>>5-91-36-37 {"backgroundColor":"black","fontWeight":"bold"} 4 /assets/mangas/ajin/1/09.png
Sample text for page 9, entry 4.

$END page9

$START page10
>>47-13-47-30 {"backgroundColor":"black","color":"red"} 1 /assets/mangas/ajin/1/10.png
Sample text for page 10, entry 1.

>>59-4-46-12 {"backgroundColor":"black","fontWeight":"bold"} 2 /assets/mangas/ajin/1/10.png
Sample text for page 10, entry 2.

>>74-7-11-50 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/10.png
Sample text for page 10, entry 3.

>>87-6-49-41 {"backgroundColor":"black","fontStyle":"italic"} 4 /assets/mangas/ajin/1/10.png
Sample text for page 10, entry 4.

$END page10

$START page11
>>98-42-12-5 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/11.png
Sample text for page 11, entry 1.

>>66-42-43-15 {"backgroundColor":"black","color":"red"} 2 /assets/mangas/ajin/1/11.png
Sample text for page 11, entry 2.

>>29-59-14-44 {"backgroundColor":"black","color":"red"} 3 /assets/mangas/ajin/1/11.png
Sample text for page 11, entry 3.

>>83-17-20-32 {"backgroundColor":"black","fontWeight":"bold"} 4 /assets/mangas/ajin/1/11.png
Sample text for page 11, entry 4.

$END page11

$START page12
>>67-75-8-3 {"backgroundColor":"black","fontStyle":"italic"} 1 /assets/mangas/ajin/1/12.png
Sample text for page 12, entry 1.

>>64-80-47-4 {"backgroundColor":"black","textDecoration":"underline"} 2 /assets/mangas/ajin/1/12.png
Sample text for page 12, entry 2.

>>82-60-47-28 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/12.png
Sample text for page 12, entry 3.

>>30-85-27-45 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/12.png
Sample text for page 12, entry 4.

$END page12

$START page13
>>54-26-42-5 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/13.png
Sample text for page 13, entry 1.

>>43-69-19-44 {"backgroundColor":"black","color":"red"} 2 /assets/mangas/ajin/1/13.png
Sample text for page 13, entry 2.

>>92-75-10-6 {"backgroundColor":"black","color":"red"} 3 /assets/mangas/ajin/1/13.png
Sample text for page 13, entry 3.

>>14-83-19-30 {"backgroundColor":"black","fontWeight":"bold"} 4 /assets/mangas/ajin/1/13.png
Sample text for page 13, entry 4.

$END page13

$START page14
>>69-70-17-9 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/14.png
Sample text for page 14, entry 1.

>>3-84-41-45 {"backgroundColor":"black","fontWeight":"bold"} 2 /assets/mangas/ajin/1/14.png
Sample text for page 14, entry 2.

>>30-61-14-19 {"backgroundColor":"black","fontWeight":"bold"} 3 /assets/mangas/ajin/1/14.png
Sample text for page 14, entry 3.

>>17-53-40-43 {"backgroundColor":"black","fontStyle":"italic"} 4 /assets/mangas/ajin/1/14.png
Sample text for page 14, entry 4.

$END page14

$START page15
>>24-36-40-16 {"backgroundColor":"black","fontStyle":"italic"} 1 /assets/mangas/ajin/1/15.png
Sample text for page 15, entry 1.

>>95-31-49-30 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/15.png
Sample text for page 15, entry 2.

>>11-57-42-44 {"backgroundColor":"black","fontWeight":"bold"} 3 /assets/mangas/ajin/1/15.png
Sample text for page 15, entry 3.

>>55-36-10-3 {"backgroundColor":"black","fontStyle":"italic"} 4 /assets/mangas/ajin/1/15.png
Sample text for page 15, entry 4.

$END page15

$START page16
>>85-29-1-15 {"backgroundColor":"black","color":"red"} 1 /assets/mangas/ajin/1/16.png
Sample text for page 16, entry 1.

>>29-23-40-22 {"backgroundColor":"black","color":"red"} 2 /assets/mangas/ajin/1/16.png
Sample text for page 16, entry 2.

>>72-23-23-10 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/16.png
Sample text for page 16, entry 3.

>>77-75-22-20 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/16.png
Sample text for page 16, entry 4.

$END page16

$START page17
>>94-0-11-15 {"backgroundColor":"black","fontStyle":"italic"} 1 /assets/mangas/ajin/1/17.png
Sample text for page 17, entry 1.

>>49-42-11-4 {"backgroundColor":"black","color":"red"} 2 /assets/mangas/ajin/1/17.png
Sample text for page 17, entry 2.

>>14-51-39-24 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/17.png
Sample text for page 17, entry 3.

>>83-31-6-38 {"backgroundColor":"black","fontWeight":"bold"} 4 /assets/mangas/ajin/1/17.png
Sample text for page 17, entry 4.

$END page17

$START page18
>>30-82-35-11 {"backgroundColor":"black","fontStyle":"italic"} 1 /assets/mangas/ajin/1/18.png
Sample text for page 18, entry 1.

>>42-79-29-3 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/18.png
Sample text for page 18, entry 2.

>>80-89-5-45 {"backgroundColor":"black","color":"red"} 3 /assets/mangas/ajin/1/18.png
Sample text for page 18, entry 3.

>>29-35-35-41 {"backgroundColor":"black","textDecoration":"underline"} 4 /assets/mangas/ajin/1/18.png
Sample text for page 18, entry 4.

$END page18

$START page19
>>92-73-18-41 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/19.png
Sample text for page 19, entry 1.

>>55-14-19-20 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/19.png
Sample text for page 19, entry 2.

>>74-21-10-17 {"backgroundColor":"black","fontWeight":"bold"} 3 /assets/mangas/ajin/1/19.png
Sample text for page 19, entry 3.

>>80-67-14-8 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/19.png
Sample text for page 19, entry 4.

$END page19

$START page20
>>71-88-31-31 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/20.png
Sample text for page 20, entry 1.

>>7-14-44-27 {"backgroundColor":"black","textDecoration":"underline"} 2 /assets/mangas/ajin/1/20.png
Sample text for page 20, entry 2.

>>29-33-31-45 {"backgroundColor":"black","fontWeight":"bold"} 3 /assets/mangas/ajin/1/20.png
Sample text for page 20, entry 3.

>>42-21-14-13 {"backgroundColor":"black","textDecoration":"underline"} 4 /assets/mangas/ajin/1/20.png
Sample text for page 20, entry 4.

$END page20

$START page21
>>0-45-18-50 {"backgroundColor":"black","fontWeight":"bold"} 1 /assets/mangas/ajin/1/21.png
Sample text for page 21, entry 1.

>>72-50-20-40 {"backgroundColor":"black","fontWeight":"bold"} 2 /assets/mangas/ajin/1/21.png
Sample text for page 21, entry 2.

>>16-27-30-43 {"backgroundColor":"black","fontStyle":"italic"} 3 /assets/mangas/ajin/1/21.png
Sample text for page 21, entry 3.

>>68-6-2-39 {"backgroundColor":"black","textDecoration":"underline"} 4 /assets/mangas/ajin/1/21.png
Sample text for page 21, entry 4.

$END page21

$START page22
>>54-83-7-46 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/22.png
Sample text for page 22, entry 1.

>>69-50-3-29 {"backgroundColor":"black","fontWeight":"bold"} 2 /assets/mangas/ajin/1/22.png
Sample text for page 22, entry 2.

>>82-22-20-20 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/22.png
Sample text for page 22, entry 3.

>>81-61-44-36 {"backgroundColor":"black","textDecoration":"underline"} 4 /assets/mangas/ajin/1/22.png
Sample text for page 22, entry 4.

$END page22

$START page23
>>14-47-3-8 {"backgroundColor":"black","fontWeight":"bold"} 1 /assets/mangas/ajin/1/23.png
Sample text for page 23, entry 1.

>>45-36-39-6 {"backgroundColor":"black","fontWeight":"bold"} 2 /assets/mangas/ajin/1/23.png
Sample text for page 23, entry 2.

>>99-80-26-11 {"backgroundColor":"black","fontStyle":"italic"} 3 /assets/mangas/ajin/1/23.png
Sample text for page 23, entry 3.

>>6-9-32-20 {"backgroundColor":"black","fontStyle":"italic"} 4 /assets/mangas/ajin/1/23.png
Sample text for page 23, entry 4.

$END page23

$START page24
>>70-98-36-46 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/24.png
Sample text for page 24, entry 1.

>>95-20-9-42 {"backgroundColor":"black","fontWeight":"bold"} 2 /assets/mangas/ajin/1/24.png
Sample text for page 24, entry 2.

>>77-92-23-43 {"backgroundColor":"black","color":"red"} 3 /assets/mangas/ajin/1/24.png
Sample text for page 24, entry 3.

>>62-66-34-8 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/24.png
Sample text for page 24, entry 4.

$END page24

$START page25
>>52-0-18-20 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/25.png
Sample text for page 25, entry 1.

>>20-16-18-24 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/25.png
Sample text for page 25, entry 2.

>>47-62-40-43 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/25.png
Sample text for page 25, entry 3.

>>8-33-2-19 {"backgroundColor":"black","textDecoration":"underline"} 4 /assets/mangas/ajin/1/25.png
Sample text for page 25, entry 4.

$END page25

$START page26
>>16-48-38-19 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/26.png
Sample text for page 26, entry 1.

>>32-81-28-21 {"backgroundColor":"black","color":"red"} 2 /assets/mangas/ajin/1/26.png
Sample text for page 26, entry 2.

>>68-90-6-23 {"backgroundColor":"black","fontStyle":"italic"} 3 /assets/mangas/ajin/1/26.png
Sample text for page 26, entry 3.

>>10-79-3-12 {"backgroundColor":"black","fontStyle":"italic"} 4 /assets/mangas/ajin/1/26.png
Sample text for page 26, entry 4.

$END page26

$START page27
>>7-40-46-40 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/27.png
Sample text for page 27, entry 1.

>>42-87-24-28 {"backgroundColor":"black","textDecoration":"underline"} 2 /assets/mangas/ajin/1/27.png
Sample text for page 27, entry 2.

>>90-50-15-9 {"backgroundColor":"black","fontStyle":"italic"} 3 /assets/mangas/ajin/1/27.png
Sample text for page 27, entry 3.

>>31-42-17-42 {"backgroundColor":"black","fontStyle":"italic"} 4 /assets/mangas/ajin/1/27.png
Sample text for page 27, entry 4.

$END page27

$START page28
>>89-96-26-38 {"backgroundColor":"black","fontStyle":"italic"} 1 /assets/mangas/ajin/1/28.png
Sample text for page 28, entry 1.

>>73-84-44-46 {"backgroundColor":"black","color":"red"} 2 /assets/mangas/ajin/1/28.png
Sample text for page 28, entry 2.

>>54-94-34-31 {"backgroundColor":"black","fontWeight":"bold"} 3 /assets/mangas/ajin/1/28.png
Sample text for page 28, entry 3.

>>41-25-37-47 {"backgroundColor":"black","fontWeight":"bold"} 4 /assets/mangas/ajin/1/28.png
Sample text for page 28, entry 4.

$END page28

$START page29
>>65-19-7-49 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/29.png
Sample text for page 29, entry 1.

>>55-50-40-41 {"backgroundColor":"black","color":"red"} 2 /assets/mangas/ajin/1/29.png
Sample text for page 29, entry 2.

>>92-44-28-12 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/29.png
Sample text for page 29, entry 3.

>>69-81-29-23 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/29.png
Sample text for page 29, entry 4.

$END page29

$START page30
>>75-78-13-13 {"backgroundColor":"black","fontStyle":"italic"} 1 /assets/mangas/ajin/1/30.png
Sample text for page 30, entry 1.

>>29-1-20-33 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/30.png
Sample text for page 30, entry 2.

>>91-26-33-7 {"backgroundColor":"black","color":"red"} 3 /assets/mangas/ajin/1/30.png
Sample text for page 30, entry 3.

>>43-46-22-50 {"backgroundColor":"black","fontStyle":"italic"} 4 /assets/mangas/ajin/1/30.png
Sample text for page 30, entry 4.

$END page30

$START page31
>>41-87-50-43 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/31.png
Sample text for page 31, entry 1.

>>65-36-28-50 {"backgroundColor":"black","color":"red"} 2 /assets/mangas/ajin/1/31.png
Sample text for page 31, entry 2.

>>18-85-21-19 {"backgroundColor":"black","color":"red"} 3 /assets/mangas/ajin/1/31.png
Sample text for page 31, entry 3.

>>83-59-27-25 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/31.png
Sample text for page 31, entry 4.

$END page31

$START page32
>>18-1-26-48 {"backgroundColor":"black","fontWeight":"bold"} 1 /assets/mangas/ajin/1/32.png
Sample text for page 32, entry 1.

>>14-18-27-44 {"backgroundColor":"black","textDecoration":"underline"} 2 /assets/mangas/ajin/1/32.png
Sample text for page 32, entry 2.

>>49-66-36-3 {"backgroundColor":"black","fontWeight":"bold"} 3 /assets/mangas/ajin/1/32.png
Sample text for page 32, entry 3.

>>47-56-17-12 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/32.png
Sample text for page 32, entry 4.

$END page32

$START page33
>>33-9-12-10 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/33.png
Sample text for page 33, entry 1.

>>67-1-38-47 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/33.png
Sample text for page 33, entry 2.

>>27-52-42-35 {"backgroundColor":"black","color":"red"} 3 /assets/mangas/ajin/1/33.png
Sample text for page 33, entry 3.

>>33-76-20-12 {"backgroundColor":"black","fontStyle":"italic"} 4 /assets/mangas/ajin/1/33.png
Sample text for page 33, entry 4.

$END page33

$START page34
>>60-70-50-19 {"backgroundColor":"black","fontWeight":"bold"} 1 /assets/mangas/ajin/1/34.png
Sample text for page 34, entry 1.

>>34-61-38-40 {"backgroundColor":"black","color":"red"} 2 /assets/mangas/ajin/1/34.png
Sample text for page 34, entry 2.

>>65-7-5-10 {"backgroundColor":"black","fontWeight":"bold"} 3 /assets/mangas/ajin/1/34.png
Sample text for page 34, entry 3.

>>32-31-50-16 {"backgroundColor":"black","textDecoration":"underline"} 4 /assets/mangas/ajin/1/34.png
Sample text for page 34, entry 4.

$END page34

$START page35
>>67-0-9-46 {"backgroundColor":"black","fontStyle":"italic"} 1 /assets/mangas/ajin/1/35.png
Sample text for page 35, entry 1.

>>78-19-34-19 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/35.png
Sample text for page 35, entry 2.

>>24-2-45-19 {"backgroundColor":"black","fontWeight":"bold"} 3 /assets/mangas/ajin/1/35.png
Sample text for page 35, entry 3.

>>45-14-37-27 {"backgroundColor":"black","textDecoration":"underline"} 4 /assets/mangas/ajin/1/35.png
Sample text for page 35, entry 4.

$END page35

$START page36
>>22-77-20-23 {"backgroundColor":"black","fontWeight":"bold"} 1 /assets/mangas/ajin/1/36.png
Sample text for page 36, entry 1.

>>76-47-23-28 {"backgroundColor":"black","fontWeight":"bold"} 2 /assets/mangas/ajin/1/36.png
Sample text for page 36, entry 2.

>>24-69-33-3 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/36.png
Sample text for page 36, entry 3.

>>67-32-22-24 {"backgroundColor":"black","textDecoration":"underline"} 4 /assets/mangas/ajin/1/36.png
Sample text for page 36, entry 4.

$END page36

$START page37
>>95-68-33-11 {"backgroundColor":"black","fontStyle":"italic"} 1 /assets/mangas/ajin/1/37.png
Sample text for page 37, entry 1.

>>5-64-49-23 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/37.png
Sample text for page 37, entry 2.

>>50-54-15-14 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/37.png
Sample text for page 37, entry 3.

>>89-89-17-43 {"backgroundColor":"black","textDecoration":"underline"} 4 /assets/mangas/ajin/1/37.png
Sample text for page 37, entry 4.

$END page37

$START page38
>>50-29-23-35 {"backgroundColor":"black","fontWeight":"bold"} 1 /assets/mangas/ajin/1/38.png
Sample text for page 38, entry 1.

>>37-30-41-34 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/38.png
Sample text for page 38, entry 2.

>>1-61-9-45 {"backgroundColor":"black","color":"red"} 3 /assets/mangas/ajin/1/38.png
Sample text for page 38, entry 3.

>>99-13-11-10 {"backgroundColor":"black","textDecoration":"underline"} 4 /assets/mangas/ajin/1/38.png
Sample text for page 38, entry 4.

$END page38

$START page39
>>36-82-34-1 {"backgroundColor":"black","fontStyle":"italic"} 1 /assets/mangas/ajin/1/39.png
Sample text for page 39, entry 1.

>>48-9-50-21 {"backgroundColor":"black","textDecoration":"underline"} 2 /assets/mangas/ajin/1/39.png
Sample text for page 39, entry 2.

>>6-42-44-14 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/39.png
Sample text for page 39, entry 3.

>>57-47-46-39 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/39.png
Sample text for page 39, entry 4.

$END page39

$START page40
>>87-55-39-31 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/40.png
Sample text for page 40, entry 1.

>>44-39-3-27 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/40.png
Sample text for page 40, entry 2.

>>56-50-37-18 {"backgroundColor":"black","fontWeight":"bold"} 3 /assets/mangas/ajin/1/40.png
Sample text for page 40, entry 3.

>>41-14-22-9 {"backgroundColor":"black","fontWeight":"bold"} 4 /assets/mangas/ajin/1/40.png
Sample text for page 40, entry 4.

$END page40

$START page41
>>7-78-15-49 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/41.png
Sample text for page 41, entry 1.

>>61-78-39-3 {"backgroundColor":"black","fontWeight":"bold"} 2 /assets/mangas/ajin/1/41.png
Sample text for page 41, entry 2.

>>83-4-31-4 {"backgroundColor":"black","fontWeight":"bold"} 3 /assets/mangas/ajin/1/41.png
Sample text for page 41, entry 3.

>>8-45-37-27 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/41.png
Sample text for page 41, entry 4.

$END page41

$START page42
>>3-32-21-3 {"backgroundColor":"black","color":"red"} 1 /assets/mangas/ajin/1/42.png
Sample text for page 42, entry 1.

>>49-9-21-22 {"backgroundColor":"black","color":"red"} 2 /assets/mangas/ajin/1/42.png
Sample text for page 42, entry 2.

>>13-69-49-22 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/42.png
Sample text for page 42, entry 3.

>>11-25-37-22 {"backgroundColor":"black","fontWeight":"bold"} 4 /assets/mangas/ajin/1/42.png
Sample text for page 42, entry 4.

$END page42

$START page43
>>48-4-34-10 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/43.png
Sample text for page 43, entry 1.

>>75-55-40-31 {"backgroundColor":"black","fontWeight":"bold"} 2 /assets/mangas/ajin/1/43.png
Sample text for page 43, entry 2.

>>40-17-37-15 {"backgroundColor":"black","fontWeight":"bold"} 3 /assets/mangas/ajin/1/43.png
Sample text for page 43, entry 3.

>>75-26-22-10 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/43.png
Sample text for page 43, entry 4.

$END page43

$START page44
>>46-67-8-38 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/44.png
Sample text for page 44, entry 1.

>>29-15-43-40 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/44.png
Sample text for page 44, entry 2.

>>95-47-25-21 {"backgroundColor":"black","fontStyle":"italic"} 3 /assets/mangas/ajin/1/44.png
Sample text for page 44, entry 3.

>>37-91-15-18 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/44.png
Sample text for page 44, entry 4.

$END page44

$START page45
>>45-61-17-9 {"backgroundColor":"black","fontStyle":"italic"} 1 /assets/mangas/ajin/1/45.png
Sample text for page 45, entry 1.

>>48-36-2-30 {"backgroundColor":"black","fontWeight":"bold"} 2 /assets/mangas/ajin/1/45.png
Sample text for page 45, entry 2.

>>24-27-20-25 {"backgroundColor":"black","color":"red"} 3 /assets/mangas/ajin/1/45.png
Sample text for page 45, entry 3.

>>59-80-10-21 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/45.png
Sample text for page 45, entry 4.

$END page45

$START page46
>>0-15-29-49 {"backgroundColor":"black","textDecoration":"underline"} 1 /assets/mangas/ajin/1/46.png
Sample text for page 46, entry 1.

>>80-25-30-38 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/46.png
Sample text for page 46, entry 2.

>>98-41-9-11 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/46.png
Sample text for page 46, entry 3.

>>29-64-19-41 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/46.png
Sample text for page 46, entry 4.

$END page46

$START page47
>>9-83-20-25 {"backgroundColor":"black","fontWeight":"bold"} 1 /assets/mangas/ajin/1/47.png
Sample text for page 47, entry 1.

>>4-78-37-10 {"backgroundColor":"black","color":"red"} 2 /assets/mangas/ajin/1/47.png
Sample text for page 47, entry 2.

>>98-11-33-43 {"backgroundColor":"black","textDecoration":"underline"} 3 /assets/mangas/ajin/1/47.png
Sample text for page 47, entry 3.

>>35-83-43-27 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/47.png
Sample text for page 47, entry 4.

$END page47

$START page48
>>57-78-38-18 {"backgroundColor":"black","fontWeight":"bold"} 1 /assets/mangas/ajin/1/48.png
Sample text for page 48, entry 1.

>>26-98-24-39 {"backgroundColor":"black","color":"red"} 2 /assets/mangas/ajin/1/48.png
Sample text for page 48, entry 2.

>>60-74-10-41 {"backgroundColor":"black","fontWeight":"bold"} 3 /assets/mangas/ajin/1/48.png
Sample text for page 48, entry 3.

>>16-80-49-37 {"backgroundColor":"black","fontWeight":"bold"} 4 /assets/mangas/ajin/1/48.png
Sample text for page 48, entry 4.

$END page48

$START page49
>>86-38-20-37 {"backgroundColor":"black","color":"red"} 1 /assets/mangas/ajin/1/49.png
Sample text for page 49, entry 1.

>>39-86-13-39 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/49.png
Sample text for page 49, entry 2.

>>94-76-8-40 {"backgroundColor":"black","fontWeight":"bold"} 3 /assets/mangas/ajin/1/49.png
Sample text for page 49, entry 3.

>>60-58-8-7 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/49.png
Sample text for page 49, entry 4.

$END page49

$START page50
>>20-11-47-8 {"backgroundColor":"black","color":"red"} 1 /assets/mangas/ajin/1/50.png
Sample text for page 50, entry 1.

>>68-82-39-37 {"backgroundColor":"black","fontStyle":"italic"} 2 /assets/mangas/ajin/1/50.png
Sample text for page 50, entry 2.

>>68-55-2-38 {"backgroundColor":"black","color":"red"} 3 /assets/mangas/ajin/1/50.png
Sample text for page 50, entry 3.

>>46-83-1-8 {"backgroundColor":"black","color":"red"} 4 /assets/mangas/ajin/1/50.png
Sample text for page 50, entry 4.

$END page50
`
