export const unitStyleProp = {}

export abstract class StyleUnit {
  abstract toString(): string

  static parse(value: string) {
    throw new Error('not implemented!')
  }

  static stringify(objectValue: object) {
    throw new Error('not implemented!')
  }

  constructor() {
    if (this.constructor === StyleUnit) {
      throw new Error("Can't instantiate StyleUnit class directly!")
    }
  }
}
export type ShadowType = {
  color: string
  x: number
  y: number
  blur: number
  unit: string
}

export const splitValueAndUnit = (
  input: string | string
): { value: number; unit: string } => {
  if (typeof input === 'number') return { value: input, unit: '' }

  if (!input) return { value: 0, unit: '' }
  const match = input.match(/^(\d+\.?\d*)([a-zA-Z%]+)$/)

  if (match) {
    return {
      value: parseFloat(match[1]), // Extract and convert the numeric part to a float
      unit: match[2], // Extract the unit part
    }
  }

  return {
    value: parseFloat(input),
    unit: '',
  }
}


export class StyleSingleUnit extends StyleUnit {
  value: number
  unit: string
  toString(): string {
    return `${this.value}${this.unit}`
  }
  static parse(unitValue: string) {
    const value = parseFloat(unitValue)
    const unit = unitValue.replaceAll(parseFloat.toString(), '')
    return {
      value,
      unit,
    }
  }
  set(styleValue: string | { value?: number; unit?: string }) {
    const { value, unit } =
      typeof styleValue === 'string'
        ? StyleSingleUnit.parse(styleValue)
        : styleValue

    this.value = value !== undefined ? value : this.value
    this.unit = unit !== undefined ? unit : this.unit
  }
  /**
   *
   */
  constructor(value: number, unit: string = '%') {
    super()
    this.value = value
    this.unit = unit
  }
}

export class StyleRotate extends StyleUnit {
  angle: number
  unit: 'deg' | 'rad' | 'grad' | 'turn'
  constructor(angle: number, unit: 'deg' | 'rad' | 'grad' | 'turn' = 'deg') {
    super()
    this.angle = angle
    this.unit = unit
  }

  toString() {
    return `rotate(${this.angle}${this.unit})`
  }
  set(styleValue: string): object {
    throw new Error('Method not implemented.')
  }
}
